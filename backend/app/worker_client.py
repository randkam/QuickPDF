from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests
from flask import current_app


class WorkerError(RuntimeError):
    pass


@dataclass(frozen=True)
class WorkerResult:
    output_filename: str


def process_pdf(payload: dict[str, Any], *, timeout_s: int = 120) -> WorkerResult:
    """
    Ask the worker service to process PDFs that are already saved on disk.
    Backend should never open or parse PDFs; the worker does that.
    """
    worker_url = current_app.config["WORKER_URL"].rstrip("/")
    url = f"{worker_url}/process"

    try:
        resp = requests.post(url, json=payload, timeout=timeout_s)
    except requests.RequestException as exc:  # noqa: BLE001
        raise WorkerError("Worker is unreachable.") from exc

    if not resp.ok:
        detail = None
        try:
            detail = resp.json()
        except Exception:  # noqa: BLE001
            detail = {"message": resp.text}
        raise WorkerError(detail.get("message") or "Worker failed to process the PDF.")

    data: dict[str, Any] = resp.json()
    output_filename = str(data.get("output_filename") or "").strip()
    if not output_filename:
        raise WorkerError("Worker returned an invalid response (missing output_filename).")

    return WorkerResult(output_filename=output_filename)


