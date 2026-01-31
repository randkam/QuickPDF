from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from flask import current_app


def _now_ts() -> float:
    return time.time()


@dataclass(frozen=True)
class JobPaths:
    root: Path

    def job_file(self, job_id: str) -> Path:
        return self.root / f"{job_id}.json"


def get_job_paths() -> JobPaths:
    jobs_dir = Path(current_app.config["JOBS_DIR"]).resolve()
    return JobPaths(root=jobs_dir)


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def create_job_record(
    *,
    job_id: str,
    operation: str,
    input_filenames: list[str],
    output_filename: str,
    output_download_name: str,
    pages: list[str] | None,
    download_token_hash: str,
) -> dict[str, Any]:
    ts = _now_ts()
    job: dict[str, Any] = {
        "job_id": job_id,
        "status": "queued",
        "operation": operation,
        "input_filenames": input_filenames,
        "output_filename": output_filename,
        "output_download_name": output_download_name,
        "pages": pages or [],
        "error_message": None,
        "download_token_hash": download_token_hash,
        "downloads": 0,
        "downloaded_at": None,
        "created_at": ts,
        "updated_at": ts,
    }
    return job


def enqueue_job(job: dict[str, Any]) -> None:
    paths = get_job_paths()
    job_id = str(job["job_id"])
    atomic_write_json(paths.job_file(job_id), job)
    # Enqueueing to Redis/RQ is handled separately in the API layer.


