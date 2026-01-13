import os
from pathlib import Path


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "supersecretkey")
    # Comma-separated list of allowed origins (recommended for prod),
    # e.g. "https://quick-pdf.netlify.app,https://quickpdfapi.top"
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "")

    # Where uploaded + processed files are stored.
    # In Docker we set this to /data/uploads (shared volume between backend+worker).
    DEFAULT_UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", str(DEFAULT_UPLOAD_DIR))

    # Flask will reject requests larger than this (bytes). Adjust as needed.
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", str(50 * 1024 * 1024)))  # 50MB

    ALLOWED_EXTENSIONS = {"pdf"}

    # Basic safety limits (tune as needed)
    MAX_PDF_PAGES = int(os.environ.get("MAX_PDF_PAGES", "200"))
    MAX_MERGE_FILES = int(os.environ.get("MAX_MERGE_FILES", "10"))
    MAX_MERGE_TOTAL_PAGES = int(os.environ.get("MAX_MERGE_TOTAL_PAGES", "400"))
    MAX_OPERATION_PAGES = int(os.environ.get("MAX_OPERATION_PAGES", "50"))

    # Basic IP rate limits (fixed window)
    RATE_LIMIT_WINDOW_S = int(os.environ.get("RATE_LIMIT_WINDOW_S", "60"))
    RATE_LIMIT_JOBS_PER_WINDOW = int(os.environ.get("RATE_LIMIT_JOBS_PER_WINDOW", "20"))
    RATE_LIMIT_POLL_PER_WINDOW = int(os.environ.get("RATE_LIMIT_POLL_PER_WINDOW", "120"))
    RATE_LIMIT_DOWNLOAD_PER_WINDOW = int(os.environ.get("RATE_LIMIT_DOWNLOAD_PER_WINDOW", "60"))

    # Internal worker URL (docker-compose service name by default)
    WORKER_URL = os.environ.get("WORKER_URL", "http://worker:8001")

    # Job queue directory (shared volume between backend+worker in Docker).
    DEFAULT_JOBS_DIR = Path(__file__).resolve().parents[1] / "jobs"
    JOBS_DIR = os.environ.get("JOBS_DIR", str(DEFAULT_JOBS_DIR))

    # RQ / Redis
    REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    RQ_QUEUE_NAME = os.environ.get("RQ_QUEUE_NAME", "pdf")

    # Worker safety defaults (seconds)
    RQ_JOB_TIMEOUT_S = int(os.environ.get("RQ_JOB_TIMEOUT_S", "180"))


