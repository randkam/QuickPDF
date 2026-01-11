## QuickPDF

A lightweight PDF toolkit with a modern React + Material UI front-end and a Flask API + isolated PDF worker. Merge files, swap two pages, keep a subset, or remove unwanted pages—then download the processed PDF instantly.

### Features
- Merge multiple PDFs in order
- Swap, keep, or remove pages with inline validation
- Download-ready responses from the API
- Clean, step-by-step UI with helpful tips

### Stack
- Frontend: React (CRA) + Material UI
- Backend: Flask, flask-cors
- Worker: RQ worker + PyPDF2 (PDF parsing is isolated from the backend)
- Nginx: serves the React build + reverse proxy for `/api/*`

## Getting Started

### Prerequisites
- Docker + Docker Compose (recommended)

Optional for local dev (no Docker):
- Python 3.10+ (virtualenv recommended)
- Node.js 18+ and npm

### 1) Run with Docker (recommended)
```bash
cd "/Users/rand/Desktop/side pj/QuickPDF"
docker compose up --build
```

This starts:
- Nginx on `http://localhost:8080`
- Backend API on `/api/*` (proxied via nginx)
- Worker (internal only) that handles PDFs

Env vars:
- See `env.example` (this repo can't create `.env.example` due to tooling restrictions).

### 2) Local dev (no Docker)

#### Back-end (API)
```bash
cd "/Users/rand/Desktop/side pj/QuickPDF/backend"
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py                     # Starts on http://127.0.0.1:5000 (API at /api/*)
```

#### Worker (required for PDF ops)
Run the worker in a separate terminal:
```bash
cd "/Users/rand/Desktop/side pj/QuickPDF/worker"
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
REDIS_URL="redis://localhost:6379/0" RQ_QUEUE_NAME="pdf" rq worker -u "$REDIS_URL" "$RQ_QUEUE_NAME"
```

#### Front-end (UI)
```bash
cd "/Users/rand/Desktop/side pj/QuickPDF/frontend"
npm install
REACT_APP_API_URL="http://127.0.0.1:5000/api" npm start   # http://localhost:3000
```

## How to Use
1) Pick an operation (Merge, Swap, Keep, or Remove).  
2) Upload your PDF (or PDFs for merge).  
3) For page-based operations, add page numbers (comma-separated).  
4) Run the operation and use the provided download link.

## API
- `POST /api/jobs` – Create an async job (multipart form-data)
- `GET /api/jobs/<job_id>` – Poll job status
- `GET /api/jobs/<job_id>/download` – Download result when done
- `GET /api/health` – Service heartbeat

## HTTPS (Let's Encrypt, production)
Use `docker-compose.prod.yml` and update `nginx/nginx.prod.conf`:
- Replace `your-domain` in the cert paths with your real domain
- Set the `server_name` values

First certificate issuance (example):
```bash
docker compose -f docker-compose.prod.yml up -d --build nginx backend worker redis
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d your-domain \
  --email you@example.com --agree-tos --no-eff-email
docker compose -f docker-compose.prod.yml up -d
```

## Project Structure
```
backend/            # Flask API (does NOT open PDFs)
worker/             # PDF worker (PyPDF2 lives here)
frontend/           # React UI
nginx/              # Reverse proxy config
docker-compose.yml
uploads/            # Local dev uploads/output (Docker uses ./data/uploads)
```

## Troubleshooting
- CORS/network issues: confirm `REACT_APP_API_URL` matches the API origin.
- Empty downloads: ensure pages are valid and the original PDF is not encrypted.
- Permissions: make sure `uploads/` is writable (`mkdir -p uploads` if needed).
