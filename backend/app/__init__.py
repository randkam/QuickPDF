from pathlib import Path
from urllib.parse import urlsplit

from flask import Flask, request
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    def _normalize_origin(raw: str) -> str | None:
        """
        Normalize an origin string to the exact shape browsers send in the Origin header:
        "{scheme}://{host}[:port]" with no trailing slash, path, query, or fragment.
        """
        candidate = (raw or "").strip().rstrip("/")
        if not candidate:
            return None

        parts = urlsplit(candidate)
        if parts.scheme.lower() not in {"http", "https"}:
            return None
        if not parts.netloc:
            return None
        if parts.path not in {"", "/"} or parts.query or parts.fragment:
            return None

        # Origin comparison should be case-insensitive for scheme/host.
        # Keep the port (if any) because the browser includes it in Origin.
        return f"{parts.scheme.lower()}://{parts.netloc.lower()}"

    # CORS
    # - If CORS_ORIGINS is unset/empty, allow all origins (convenient for dev).
    # - If set, treat as comma-separated list of allowed origins (recommended for prod),
    #   e.g. "https://your-site.netlify.app,https://your-custom-domain.com"
    cors_origins_raw = (app.config.get("CORS_ORIGINS") or "").strip()
    if cors_origins_raw:
        normalized = [_normalize_origin(o) for o in cors_origins_raw.split(",")]
        origins = sorted({o for o in normalized if o})
        if not origins:
            raise RuntimeError("CORS_ORIGINS was set but contained no valid origins.")
        CORS(
            app,
            resources={r"^/api/.*": {"origins": origins}},
            methods=["GET", "POST", "OPTIONS"],
            # Include Range headers because pdf.js (react-pdf) commonly uses HTTP Range requests.
            allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Download-Token", "Range", "If-Range"],
            # Expose range-related headers for pdf.js preview/download handling.
            expose_headers=["Content-Disposition", "Accept-Ranges", "Content-Range", "Content-Length"],
            supports_credentials=False,
            max_age=600,
            vary_header=True,
            always_send=True,
            send_wildcard=False,
        )
    else:
        # Dev convenience: allow all origins.
        # NOTE: We intentionally do NOT enable credentials here; "*" is invalid with credentials.
        CORS(
            app,
            resources={r"^/.*": {"origins": "*"}},
            methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Download-Token", "Range", "If-Range"],
            expose_headers=["Content-Disposition", "Accept-Ranges", "Content-Range", "Content-Length"],
            supports_credentials=False,
            max_age=0,
            vary_header=True,
            always_send=True,
            send_wildcard=True,
        )

    @app.after_request
    def _ensure_cors_vary_headers(resp):
        """
        Prevent proxy/CDN caching from mixing CORS responses across origins.

        Without a correct Vary, a cache can store a response with:
          Access-Control-Allow-Origin: https://quickpdf.me
        and later serve it to:
          Origin: https://quick-pdf.netlify.app
        which will hard-fail CORS in browsers.
        """
        if request.path.startswith("/api/") and request.headers.get("Origin"):
            vary = resp.headers.get("Vary", "")
            parts = {p.strip() for p in vary.split(",") if p.strip()} if vary else set()
            parts.update({"Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"})
            resp.headers["Vary"] = ", ".join(sorted(parts))

        # Preflight responses are safe to cache in the browser (Max-Age),
        # but should generally not be cached by shared intermediaries.
        if request.method == "OPTIONS" and request.path.startswith("/api/"):
            resp.headers.setdefault("Cache-Control", "no-store")

        return resp

    # Respect X-Forwarded-* headers from nginx so request.remote_addr is meaningful.
    # docker-compose/nginx sets X-Forwarded-For and X-Forwarded-Proto.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)  # type: ignore[assignment]

    @app.errorhandler(RequestEntityTooLarge)
    def _handle_file_too_large(_exc: Exception):
        return {"message": "Upload too large."}, 413

    # Ensure uploads directory exists and is absolute
    upload_dir = Path(app.config["UPLOAD_FOLDER"]).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.config["UPLOAD_FOLDER"] = str(upload_dir)

    # Ensure jobs directories exist and are absolute
    jobs_dir = Path(app.config["JOBS_DIR"]).resolve()
    jobs_dir.mkdir(parents=True, exist_ok=True)
    app.config["JOBS_DIR"] = str(jobs_dir)

    from .routes import main

    # API lives under /api (nginx proxies /api -> backend)
    app.register_blueprint(main, url_prefix="/api")

    return app


