import os
import uuid
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_from_directory, url_for
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader

from .config import Config
from .jobs_store import create_job_record, enqueue_job, get_job_paths, read_json
from .queue import get_queue
from .rate_limit import RateLimit, rate_limited

main = Blueprint("main", __name__)


def allowed_file(filename: str) -> bool:
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", Config.ALLOWED_EXTENSIONS)
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed


def _clean_pages(pages_raw: str | None) -> list[str]:
    """Normalize page input into a clean list of positive integers as strings."""
    if not pages_raw:
        return []

    pages = [page.strip() for page in pages_raw.split(",") if page.strip()]
    if any(not page.isdigit() or int(page) < 1 for page in pages):
        raise ValueError("Pages must be positive numbers (e.g. 1,2,3).")
    return pages


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
    # Magic header check (don't trust filename extension)
    try:
        upload.stream.seek(0)
        header = upload.stream.read(5)
        upload.stream.seek(0)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Unreadable upload stream.") from exc

    if header != b"%PDF-":
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
        for upload in merge_files:
            if not upload or upload.filename == "":
                continue

            try:
                pages_in_file = _ensure_real_pdf_and_count_pages(upload)
            except ValueError as exc:
                for p in saved_paths:
                    try:
                        p.unlink(missing_ok=True)
                    except Exception:
                        pass
                return jsonify({"message": str(exc)}), 400

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

    # On-disk output name (unique; avoids collisions)
    output_filename = f"{job_id}_{output_download_name}"

    job = create_job_record(
        job_id=job_id,
        operation=operation,
        input_filenames=input_filenames,
        output_filename=output_filename,
        output_download_name=output_download_name,
        pages=pages,
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

    return jsonify({"job_id": job_id}), 202


@main.route("/jobs/<job_id>", methods=["GET"])
@rate_limited(lambda: RateLimit(
    key="jobs_get",
    limit=int(current_app.config.get("RATE_LIMIT_POLL_PER_WINDOW", Config.RATE_LIMIT_POLL_PER_WINDOW)),
    window_s=int(current_app.config.get("RATE_LIMIT_WINDOW_S", Config.RATE_LIMIT_WINDOW_S)),
))
def get_job(job_id: str):
    paths = get_job_paths()
    job_file = paths.job_file(job_id)
    if not job_file.is_file():
        return jsonify({"message": "Job not found."}), 404

    job = read_json(job_file)
    status = str(job.get("status") or "").strip()
    if status == "done":
        # Return a relative path so it always works behind proxies (nginx on :8080, etc).
        job["download_url"] = url_for("main.download_job_result", job_id=job_id, _external=False)
    return jsonify(job)


@main.route("/jobs/<job_id>/download", methods=["GET"])
@rate_limited(lambda: RateLimit(
    key="jobs_download",
    limit=int(current_app.config.get("RATE_LIMIT_DOWNLOAD_PER_WINDOW", Config.RATE_LIMIT_DOWNLOAD_PER_WINDOW)),
    window_s=int(current_app.config.get("RATE_LIMIT_WINDOW_S", Config.RATE_LIMIT_WINDOW_S)),
))
def download_job_result(job_id: str):
    paths = get_job_paths()
    job_file = paths.job_file(job_id)
    if not job_file.is_file():
        return jsonify({"message": "Job not found."}), 404

    job = read_json(job_file)
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

    return send_from_directory(upload_dir, output_filename, as_attachment=True, download_name=download_name)


@main.route("/upload", methods=["POST"])
def upload_file():
    # Legacy endpoint: kept to avoid confusing 404s, but no longer supported since the worker
    # is now an RQ worker (not an HTTP processing service).
    return jsonify({"message": "This endpoint is deprecated. Use POST /api/jobs instead."}), 410


@main.route("/download/<path:filename>", methods=["GET"])
def download_file(filename: str):
    upload_dir = current_app.config["UPLOAD_FOLDER"]
    file_path = os.path.join(upload_dir, filename)
    if not os.path.isfile(file_path):
        return jsonify({"message": "File not found."}), 404
    return send_from_directory(upload_dir, filename, as_attachment=True)


