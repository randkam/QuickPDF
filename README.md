## QuickPDF

A lightweight PDF toolkit with a modern React + Material UI front-end and a Flask + PyPDF2 back-end. Merge files, swap two pages, keep a subset, or remove unwanted pages—then download the processed PDF instantly.

### Features
- Merge multiple PDFs in order
- Swap, keep, or remove pages with inline validation
- Download-ready responses from the API
- Clean, step-by-step UI with helpful tips

### Stack
- Frontend: React (CRA) + Material UI
- Backend: Flask, PyPDF2, flask-cors

## Getting Started

### Prerequisites
- Python 3.10+ (virtualenv recommended)
- Node.js 18+ and npm

### 1) Back-end (API)
```bash
cd "/Users/rand/Desktop/side pj/QuickPDF"
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r app/requirements.txt
python run.py                     # Starts on http://127.0.0.1:5000
```

Optional environment variables:
- `SECRET_KEY` – Flask secret key
- `UPLOAD_FOLDER` – absolute path for uploads/output (default: `./uploads`)

### 2) Front-end (UI)
```bash
cd "/Users/rand/Desktop/side pj/QuickPDF/pdf-operations"
npm install
npm start                         # Starts on http://localhost:3000
```
If your API is on a different host/port, set `REACT_APP_API_URL` before `npm start` (e.g., `REACT_APP_API_URL=http://127.0.0.1:5000`).

## How to Use
1) Pick an operation (Merge, Swap, Keep, or Remove).  
2) Upload your PDF (or PDFs for merge).  
3) For page-based operations, add page numbers (comma-separated).  
4) Run the operation and use the provided download link.

## API
- `POST /upload`  
  - Form fields:  
    - `operation`: `merge | swap | keep | remove`  
    - `file`: PDF file(s). For merge, send multiple `file` entries.  
    - `pages`: comma-separated pages (required for swap/keep/remove).  
  - Returns: JSON with `message` and `download_url`.
- `GET /download/<filename>` – Download the processed PDF.
- `GET /health` – Service heartbeat.

## Project Structure
```
app/                # Flask API
pdf-operations/     # React UI
run.py              # API entrypoint
uploads/            # Saved/processed PDFs
```

## Troubleshooting
- CORS/network issues: confirm `REACT_APP_API_URL` matches the API origin.
- Empty downloads: ensure pages are valid and the original PDF is not encrypted.
- Permissions: make sure `uploads/` is writable (`mkdir -p uploads` if needed).
