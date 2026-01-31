import os
import re
import time
import uuid
import hashlib
import hmac
import secrets
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_from_directory, url_for
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader

from .config import Config
from .jobs_store import atomic_write_json, create_job_record, enqueue_job, get_job_paths, read_json
from .queue import get_queue
from .rate_limit import RateLimit, rate_limited

main = Blueprint("main", __name__)


def allowed_file(filename: str) -> bool:
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", Config.ALLOWED_EXTENSIONS)
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _job_ttl_s() -> int:
    ttl = current_app.config.get("JOB_TTL_S", getattr(Config, "JOB_TTL_S", 3600))
    try:
        ttl_i = int(ttl)
    except Exception:
        ttl_i = 3600
    return max(60, ttl_i)  # never less than 60s


def _delete_output_after_download() -> bool:
    return bool(current_app.config.get("DELETE_OUTPUT_AFTER_DOWNLOAD", getattr(Config, "DELETE_OUTPUT_AFTER_DOWNLOAD", True)))


def _job_is_expired(job: dict) -> bool:
    created_at = job.get("created_at")
    try:
        created_ts = float(created_at)
    except Exception:
        return False
    return (time.time() - created_ts) > _job_ttl_s()


def _cleanup_job_artifacts(*, job_file: Path, job: dict) -> None:
    # Best-effort removal of output file + job record.
    try:
        upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
        output_filename = str(job.get("output_filename") or "").strip()
        if output_filename:
            out_path = upload_dir / output_filename
            try:
                out_path.unlink(missing_ok=True)
            except Exception:
                pass
    except Exception:
        pass

    try:
        job_file.unlink(missing_ok=True)
    except Exception:
        pass


def _load_job_or_404(job_id: str):
    paths = get_job_paths()
    job_file = paths.job_file(job_id)
    if not job_file.is_file():
        return None, job_file, (jsonify({"message": "Job not found."}), 404)

    job = read_json(job_file)
    if _job_is_expired(job):
        _cleanup_job_artifacts(job_file=job_file, job=job)
        return None, job_file, (jsonify({"message": "Job expired."}), 404)

    return job, job_file, None


def _clean_pages(pages_raw: str | None) -> list[str]:
    """
    Normalize page input into a clean list of positive integers as strings.

    Supports:
    - Comma or whitespace separated values: "1,2,3" or "1 2 3"
    - Ranges: "2-6" (inclusive)
    - Mixed: "1,3,5-8"
    """
    if not pages_raw:
        return []

    raw = str(pages_raw).strip()
    if not raw:
        return []

    tokens = [t for t in re.split(r"[,\s]+", raw) if t]
    pages_out: list[str] = []
    seen: set[str] = set()

    def add_page(n: int) -> None:
        if n < 1:
            raise ValueError("Pages must be positive numbers.")
        s = str(n)
        if s not in seen:
            pages_out.append(s)
            seen.add(s)

    for token in tokens:
        token = token.strip()
        if not token:
            continue

        if token.isdigit():
            add_page(int(token))
            continue

        m = re.fullmatch(r"(\d+)-(\d+)", token)
        if m:
            start = int(m.group(1))
            end = int(m.group(2))
            if start < 1 or end < 1:
                raise ValueError("Pages must be positive numbers.")
            if end < start:
                raise ValueError('Ranges must be ascending (e.g. "2-6").')
            for n in range(start, end + 1):
                add_page(n)
            continue

        raise ValueError('Pages must be numbers and ranges (e.g. "1,3,5-8").')

    return pages_out


def _make_output_name(prefix: str = "output", *, ext: str = "pdf") -> str:
    return f"{prefix}_{uuid.uuid4().hex}.{ext}"


def _clean_output_name(raw: str | None, *, default_base: str) -> str:
    """
    Return a safe PDF filename for download.

    Rules:
    - User specifies the base name (no dots allowed).
    - We always append ".pdf".
    """
    base = (raw or "").strip()
    if not base:
        base = default_base

    # Disallow dots entirely (forces a hard-coded .pdf suffix).
    if "." in base:
        raise ValueError('Output name cannot contain ".". The ".pdf" extension is added automatically.')

    base = secure_filename(base)
    if not base:
        base = secure_filename(default_base) or "output"

    # secure_filename can keep dots in some edge cases if default_base had them
    if "." in base:
        raise ValueError('Output name cannot contain ".". The ".pdf" extension is added automatically.')

    return f"{base}.pdf"


def _ensure_real_pdf_and_count_pages(upload) -> int:
    """
    Validate that the upload looks like a real PDF and return page count.
    This is intentionally lightweight and defensive; the worker also re-validates.
    """
    # Magic header check (don't trust filename extension).
    #
    # Important: some real PDFs can have leading bytes (e.g. BOM, whitespace, or
    # other non-PDF preamble). Per PDF spec, the header should appear within the
    # first 1024 bytes, so we scan a small prefix rather than requiring byte 0.
    try:
        upload.stream.seek(0)
        prefix = upload.stream.read(1024)
        upload.stream.seek(0)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Unreadable upload stream.") from exc

    if not prefix or b"%PDF-" not in prefix:
        raise ValueError("File is not a valid PDF.")

    try:
        reader = PdfReader(upload.stream)
        num_pages = len(reader.pages)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("File is not a valid PDF.") from exc
    finally:
        try:
            upload.stream.seek(0)
        except Exception:
            pass

    if num_pages <= 0:
        raise ValueError("File is not a valid PDF.")
    return num_pages


def _uuid_pdf_name() -> str:
    return f"{uuid.uuid4().hex}.pdf"


@main.route("/health")
def health():
    return jsonify({"status": "ok"})


@main.route("/jobs", methods=["POST"])
@rate_limited(lambda: RateLimit(
    key="jobs_post",
    limit=int(current_app.config.get("RATE_LIMIT_JOBS_PER_WINDOW", Config.RATE_LIMIT_JOBS_PER_WINDOW)),
    window_s=int(current_app.config.get("RATE_LIMIT_WINDOW_S", Config.RATE_LIMIT_WINDOW_S)),
))
def create_job():
    """
    Create an async job.
    Important: this endpoint must NOT run PDF logic directly.
    It validates, saves uploads, enqueues, and returns job_id.
    """
    upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
    operation = (request.form.get("operation") or "").strip().lower()
    pages_raw = request.form.get("pages")

    if operation not in {"swap", "merge", "keep", "remove"}:
        return jsonify({"message": "Please choose a valid operation."}), 400

    try:
        pages = _clean_pages(pages_raw)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    max_operation_pages = int(current_app.config.get("MAX_OPERATION_PAGES", Config.MAX_OPERATION_PAGES))
    if operation in {"keep", "remove"} and len(pages) > max_operation_pages:
        return jsonify({"message": f"Too many pages selected (max {max_operation_pages})."}), 400

    # Validate page requirements for non-merge operations
    if operation != "merge" and not pages:
        return jsonify({"message": "Provide at least one page number for this operation."}), 400
    if operation == "swap" and len(pages) != 2:
        return jsonify({"message": "Swap requires exactly two page numbers."}), 400

    # User-facing output name (download filename) - validate early to avoid orphaned uploads.
    try:
        output_download_name = _clean_output_name(request.form.get("output_name"), default_base="output")
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    # Save uploads (validate real PDF + enforce page limits)
    input_filenames: list[str] = []
    saved_paths: list[Path] = []
    max_pdf_pages = int(current_app.config.get("MAX_PDF_PAGES", Config.MAX_PDF_PAGES))
    max_merge_files = int(current_app.config.get("MAX_MERGE_FILES", Config.MAX_MERGE_FILES))
    max_merge_total_pages = int(current_app.config.get("MAX_MERGE_TOTAL_PAGES", Config.MAX_MERGE_TOTAL_PAGES))

    if operation == "merge":
        merge_files = request.files.getlist("file")
        if not merge_files or all(f.filename == "" for f in merge_files):
            return jsonify({"message": "Please select PDF files to merge."}), 400
        if len([f for f in merge_files if f and f.filename != ""]) > max_merge_files:
            return jsonify({"message": f"Too many files (max {max_merge_files})."}), 400

        total_pages = 0
        # Only consider non-empty uploads, and keep a stable index so the UI can
        # highlight a specific file on validation errors.
        effective_merge_files = [f for f in merge_files if f and f.filename != ""]
        for upload_index, upload in enumerate(effective_merge_files):

            try:
                pages_in_file = _ensure_real_pdf_and_count_pages(upload)
            except ValueError as exc:
                for p in saved_paths:
                    try:
                        p.unlink(missing_ok=True)
                    except Exception:
                        pass
                return (
                    jsonify(
                        {
                            "message": str(exc),
                            "invalid_file": upload.filename,
                            "invalid_index": upload_index,
                        }
                    ),
                    400,
                )

            if pages_in_file > max_pdf_pages:
                for p in saved_paths:
                    try:
                        p.unlink(missing_ok=True)
                    except Exception:
                        pass
                return jsonify({"message": f"PDF exceeds max pages ({max_pdf_pages})."}), 400

            total_pages += pages_in_file
            if total_pages > max_merge_total_pages:
                for p in saved_paths:
                    try:
                        p.unlink(missing_ok=True)
                    except Exception:
                        pass
                return jsonify({"message": f"Merged PDF exceeds max total pages ({max_merge_total_pages})."}), 400

            stored = _uuid_pdf_name()
            path = upload_dir / stored
            upload.save(str(path))
            saved_paths.append(path)
            input_filenames.append(stored)

        if not input_filenames:
            return jsonify({"message": "No valid PDF files found."}), 400
    else:
        if "file" not in request.files:
            return jsonify({"message": "No file found in request."}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"message": "No file selected."}), 400
        if not file:
            return jsonify({"message": "No file selected."}), 400

        try:
            num_pages = _ensure_real_pdf_and_count_pages(file)
        except ValueError as exc:
            return jsonify({"message": str(exc)}), 400

        if num_pages > max_pdf_pages:
            return jsonify({"message": f"PDF exceeds max pages ({max_pdf_pages})."}), 400

        if pages:
            try:
                max_requested = max(int(p) for p in pages)
            except Exception:
                return jsonify({"message": "Invalid pages."}), 400
            if max_requested > num_pages:
                return jsonify({"message": f"Page selection exceeds PDF page count ({num_pages})."}), 400

        stored = _uuid_pdf_name()
        path = upload_dir / stored
        file.save(str(path))
        saved_paths.append(path)
        input_filenames.append(stored)

    job_id = uuid.uuid4().hex

    # One-time download token (returned only once, not stored in plaintext).
    download_token = secrets.token_urlsafe(32)
    download_token_hash = _sha256_hex(download_token)

    # On-disk output name (unique; avoids collisions)
    output_filename = f"{job_id}_{output_download_name}"

    job = create_job_record(
        job_id=job_id,
        operation=operation,
        input_filenames=input_filenames,
        output_filename=output_filename,
        output_download_name=output_download_name,
        pages=pages,
        download_token_hash=download_token_hash,
    )
    enqueue_job(job)

    # Enqueue to Redis/RQ. Worker runs the PDF logic.
    try:
        q = get_queue()
        q.enqueue("tasks.process_job", job_id, job_timeout=int(current_app.config["RQ_JOB_TIMEOUT_S"]))
    except Exception:  # noqa: BLE001
        current_app.logger.exception("Failed to enqueue job to RQ.")
        # Best-effort cleanup: remove saved uploads and job record.
        for p in saved_paths:
            try:
                p.unlink(missing_ok=True)
            except Exception:
                pass
        try:
            paths = get_job_paths()
            paths.job_file(job_id).unlink(missing_ok=True)
        except Exception:
            pass
        return jsonify({"message": "Queue unavailable. Try again later."}), 503

    return jsonify({"job_id": job_id, "download_token": download_token}), 202


@main.route("/jobs/<job_id>", methods=["GET"])
@rate_limited(lambda: RateLimit(
    key="jobs_get",
    limit=int(current_app.config.get("RATE_LIMIT_POLL_PER_WINDOW", Config.RATE_LIMIT_POLL_PER_WINDOW)),
    window_s=int(current_app.config.get("RATE_LIMIT_WINDOW_S", Config.RATE_LIMIT_WINDOW_S)),
))
def get_job(job_id: str):
    job, _job_file, err = _load_job_or_404(job_id)
    if err:
        return err
    assert job is not None
    status = str(job.get("status") or "").strip()
    if status == "done":
        # Return a relative path so it always works behind proxies (nginx on :8080, etc).
        job["download_url"] = url_for("main.download_job_result", job_id=job_id, _external=False)
    # Never return token/hash to callers.
    job.pop("download_token_hash", None)
    return jsonify(job)


@main.route("/jobs/<job_id>/download", methods=["GET"])
@rate_limited(lambda: RateLimit(
    key="jobs_download",
    limit=int(current_app.config.get("RATE_LIMIT_DOWNLOAD_PER_WINDOW", Config.RATE_LIMIT_DOWNLOAD_PER_WINDOW)),
    window_s=int(current_app.config.get("RATE_LIMIT_WINDOW_S", Config.RATE_LIMIT_WINDOW_S)),
))
def download_job_result(job_id: str):
    job, job_file, err = _load_job_or_404(job_id)
    if err:
        return err
    assert job is not None

    # Require download token (query param or header).
    token = (request.args.get("token") or "").strip() or (request.headers.get("X-Download-Token") or "").strip()
    if not token:
        return jsonify({"message": "Missing download token."}), 403
    expected_hash = str(job.get("download_token_hash") or "").strip()
    if not expected_hash or not hmac.compare_digest(_sha256_hex(token), expected_hash):
        return jsonify({"message": "Invalid download token."}), 403

    status = str(job.get("status") or "").strip()
    if status != "done":
        return jsonify({"message": "Job is not complete yet."}), 409

    output_filename = str(job.get("output_filename") or "").strip()
    download_name = str(job.get("output_download_name") or output_filename).strip() or output_filename
    if not output_filename:
        return jsonify({"message": "Job has no output."}), 500

    upload_dir = current_app.config["UPLOAD_FOLDER"]
    file_path = os.path.join(upload_dir, output_filename)
    if not os.path.isfile(file_path):
        return jsonify({"message": "Output file not found."}), 404

    # Some clients (like react-pdf) will issue multiple requests (range/metadata)
    # for previewing. We support a "consume" flag for the user-initiated download
    # action; previews should omit it.
    # Multi-download support:
    # - Valid token can download multiple times until TTL expiry.
    # - We keep best-effort stats only (no one-time consumption).
    downloads = int(job.get("downloads") or 0)
    job["downloads"] = downloads + 1
    job["downloaded_at"] = time.time()
    job["updated_at"] = time.time()
    atomic_write_json(job_file, job)

    return send_from_directory(upload_dir, output_filename, as_attachment=True, download_name=download_name)


@main.route("/upload", methods=["POST"])
def upload_file():
    # Legacy endpoint: kept to avoid confusing 404s, but no longer supported since the worker
    # is now an RQ worker (not an HTTP processing service).
    return jsonify({"message": "This endpoint is deprecated. Use POST /api/jobs instead."}), 410


