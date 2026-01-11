from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from PyPDF2 import PdfReader, PdfWriter


def _now_ts() -> float:
    return time.time()


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


def _read_job(job_file: Path) -> dict[str, Any]:
    return json.loads(job_file.read_text(encoding="utf-8"))


def _resolve_filename_under(root: Path, filename: str) -> Path:
    if not filename or "/" in filename or "\\" in filename:
        raise ValueError("Invalid filename.")
    p = (root / filename).resolve()
    root = root.resolve()
    if root not in p.parents and p != root:
        raise ValueError("Invalid filename.")
    return p


def _swap_pages(input_path: Path, output_path: Path, pages: list[str]) -> None:
    pages_to_swap = [int(p) - 1 for p in pages]
    with input_path.open("rb") as f:
        reader = PdfReader(f)
        writer = PdfWriter()

        swapped = {
            pages_to_swap[0]: reader.pages[pages_to_swap[1]],
            pages_to_swap[1]: reader.pages[pages_to_swap[0]],
        }

        for i in range(len(reader.pages)):
            writer.add_page(swapped.get(i, reader.pages[i]))

        with output_path.open("wb") as out:
            writer.write(out)


def _max_pdf_pages() -> int:
    return int(os.environ.get("MAX_PDF_PAGES", "200"))


def _max_merge_total_pages() -> int:
    return int(os.environ.get("MAX_MERGE_TOTAL_PAGES", "400"))


def _max_merge_files() -> int:
    return int(os.environ.get("MAX_MERGE_FILES", "10"))


def _max_operation_pages() -> int:
    return int(os.environ.get("MAX_OPERATION_PAGES", "50"))


def _pdf_num_pages(path: Path) -> int:
    with path.open("rb") as f:
        reader = PdfReader(f)
        return len(reader.pages)


def _keep_pages(input_path: Path, output_path: Path, pages: list[str]) -> None:
    pages_to_keep = {int(p) - 1 for p in pages}
    with input_path.open("rb") as f:
        reader = PdfReader(f)
        writer = PdfWriter()

        if len(pages_to_keep) > len(reader.pages):
            raise ValueError("Number of pages to retain is more than number of pages in PDF")

        for i in range(len(reader.pages)):
            if i in pages_to_keep:
                writer.add_page(reader.pages[i])

        with output_path.open("wb") as out:
            writer.write(out)


def _remove_pages(input_path: Path, output_path: Path, pages: list[str]) -> None:
    pages_to_remove = {int(p) - 1 for p in pages}
    with input_path.open("rb") as f:
        reader = PdfReader(f)
        writer = PdfWriter()

        if len(pages_to_remove) > len(reader.pages):
            raise ValueError("Number of pages to delete is more than number of pages in PDF")

        for i in range(len(reader.pages)):
            if i not in pages_to_remove:
                writer.add_page(reader.pages[i])

        with output_path.open("wb") as out:
            writer.write(out)


def _merge_pdfs(input_paths: list[Path], output_path: Path) -> None:
    writer = PdfWriter()
    max_pdf_pages = _max_pdf_pages()
    max_total = _max_merge_total_pages()
    total = 0
    for p in input_paths:
        with p.open("rb") as f:
            reader = PdfReader(f)
            n = len(reader.pages)
            if n > max_pdf_pages:
                raise ValueError(f"PDF exceeds max pages ({max_pdf_pages}).")
            total += n
            if total > max_total:
                raise ValueError(f"Merged PDF exceeds max total pages ({max_total}).")
            for page in reader.pages:
                writer.add_page(page)

    with output_path.open("wb") as out:
        writer.write(out)


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except Exception:
        # best-effort cleanup
        pass


def process_job(job_id: str) -> None:
    """
    RQ task entrypoint.
    Reads the job record from JOBS_DIR, processes PDFs under UPLOAD_FOLDER,
    and updates the job status/result.
    """
    uploads_dir = Path(os.environ.get("UPLOAD_FOLDER", "/data/uploads")).resolve()
    jobs_dir = Path(os.environ.get("JOBS_DIR", "/data/jobs")).resolve()
    cleanup_inputs = os.environ.get("CLEANUP_INPUTS", "1").strip() not in {"0", "false", "False", "no", "NO"}

    job_file = jobs_dir / f"{job_id}.json"
    if not job_file.exists():
        raise RuntimeError("Job record missing.")

    job = _read_job(job_file)
    operation = str(job.get("operation") or "").strip().lower()
    pages = job.get("pages") or []
    output_filename = str(job.get("output_filename") or "").strip()
    input_filenames = job.get("input_filenames") or []

    job.update({"status": "processing", "error_message": None, "updated_at": _now_ts()})
    _atomic_write_json(job_file, job)

    # Resolve paths early so we can always cleanup (best-effort).
    output_path: Path | None = None
    input_paths: list[Path] = []

    try:
        if operation not in {"swap", "keep", "remove", "merge"}:
            raise ValueError("Invalid operation.")
        if not output_filename:
            raise ValueError("Missing output_filename.")
        if not isinstance(input_filenames, list) or not input_filenames:
            raise ValueError("Missing input_filenames.")

        output_path = _resolve_filename_under(uploads_dir, output_filename)

        if operation == "merge":
            if len(input_filenames) > _max_merge_files():
                raise ValueError(f"Too many files (max {_max_merge_files()}).")
            input_paths = [_resolve_filename_under(uploads_dir, str(name)) for name in input_filenames]
            _merge_pdfs(input_paths, output_path)
        else:
            if not isinstance(pages, list) or not all(isinstance(p, str) for p in pages):
                raise ValueError("Invalid pages.")
            if not pages:
                raise ValueError("Missing pages.")
            if operation in {"keep", "remove"} and len(pages) > _max_operation_pages():
                raise ValueError(f"Too many pages selected (max {_max_operation_pages()}).")

            input_paths = [_resolve_filename_under(uploads_dir, str(input_filenames[0]))]
            input_path = input_paths[0]

            # Enforce max PDF pages and validate selection is within range.
            num_pages = _pdf_num_pages(input_path)
            if num_pages > _max_pdf_pages():
                raise ValueError(f"PDF exceeds max pages ({_max_pdf_pages()}).")
            try:
                max_requested = max(int(p) for p in pages)
            except Exception as exc:
                raise ValueError("Invalid pages.") from exc
            if max_requested > num_pages:
                raise ValueError(f"Page selection exceeds PDF page count ({num_pages}).")

            if operation == "swap":
                if len(pages) != 2:
                    raise ValueError("Swap requires exactly two pages.")
                _swap_pages(input_path, output_path, pages)
            elif operation == "keep":
                _keep_pages(input_path, output_path, pages)
            elif operation == "remove":
                _remove_pages(input_path, output_path, pages)

        job.update({"status": "done", "error_message": None, "updated_at": _now_ts()})
        _atomic_write_json(job_file, job)
    except Exception as exc:
        job.update({"status": "error", "error_message": str(exc) or "Worker failed.", "updated_at": _now_ts()})
        _atomic_write_json(job_file, job)
        # Cleanup partial output on failure (best-effort).
        if output_path is not None:
            _safe_unlink(output_path)
        raise
    finally:
        # Always cleanup uploaded temp inputs (best-effort).
        if cleanup_inputs:
            for p in input_paths:
                _safe_unlink(p)


