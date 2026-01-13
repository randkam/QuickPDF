from pathlib import Path

from flask import Flask
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    # CORS
    # - If CORS_ORIGINS is unset/empty, allow all origins (convenient for dev).
    # - If set, treat as comma-separated list of allowed origins (recommended for prod),
    #   e.g. "https://your-site.netlify.app,https://your-custom-domain.com"
    cors_origins_raw = (app.config.get("CORS_ORIGINS") or "").strip()
    if cors_origins_raw:
        origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]
        CORS(app, resources={r"/api/*": {"origins": origins}})
    else:
        CORS(app)  # Allow all (dev)

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


