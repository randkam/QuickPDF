import os
from flask import Blueprint, current_app, jsonify, request, send_from_directory, url_for
from werkzeug.utils import secure_filename
from .pdf_utils import swapPages, keepPages, removePages, mergePDFs
from .config import Config

main = Blueprint('main', __name__)


def allowed_file(filename: str) -> bool:
    allowed = current_app.config.get('ALLOWED_EXTENSIONS', Config.ALLOWED_EXTENSIONS)
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed


def _build_download_url(filename: str) -> str:
    """Return an absolute download URL for the generated file."""
    return url_for('main.download_file', filename=filename, _external=True)


def _clean_pages(pages_raw: str | None) -> list[str]:
    """Normalize page input into a clean list of positive integers as strings."""
    if not pages_raw:
        return []

    pages = [page.strip() for page in pages_raw.split(',') if page.strip()]
    if any(not page.isdigit() or int(page) < 1 for page in pages):
        raise ValueError("Pages must be positive numbers (e.g. 1,2,3).")
    return pages


@main.route('/health')
def health():
    return jsonify({"status": "ok"})


@main.route('/upload', methods=['POST'])
def upload_file():
    upload_dir = current_app.config['UPLOAD_FOLDER']
    operation = (request.form.get('operation') or '').strip().lower()
    pages_raw = request.form.get('pages')

    if operation not in {'swap', 'merge', 'keep', 'remove'}:
        return jsonify({"message": "Please choose a valid operation."}), 400

    try:
        pages = _clean_pages(pages_raw)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    # Validate page requirements for non-merge operations
    if operation != 'merge' and not pages:
        return jsonify({"message": "Provide at least one page number for this operation."}), 400
    if operation == 'swap' and len(pages) != 2:
        return jsonify({"message": "Swap requires exactly two page numbers."}), 400

    try:
        if operation == 'merge':
            merge_files = request.files.getlist('file')
            if not merge_files or all(f.filename == '' for f in merge_files):
                return jsonify({"message": "Please select PDF files to merge."}), 400

            saved_files = []
            for upload in merge_files:
                if upload and allowed_file(upload.filename):
                    filename = secure_filename(upload.filename)
                    filepath = os.path.join(upload_dir, filename)
                    upload.save(filepath)
                    saved_files.append(filepath)

            if not saved_files:
                return jsonify({"message": "No valid PDF files found."}), 400

            class Args:
                def __init__(self, inputs, output):
                    self.inputs = inputs
                    self.output = output

            output_name = 'output_merged.pdf'
            output_filepath = os.path.join(upload_dir, output_name)
            args = Args(inputs=saved_files, output=output_filepath)
            mergePDFs(args)

            return jsonify({
                "message": "PDFs merged successfully.",
                "download_url": _build_download_url(output_name),
            })

        # For non-merge operations we expect a single file
        if 'file' not in request.files:
            return jsonify({"message": "No file found in request."}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"message": "No file selected."}), 400
        if not (file and allowed_file(file.filename)):
            return jsonify({"message": "Only PDF files are supported."}), 400

        filename = secure_filename(file.filename)
        input_filepath = os.path.join(upload_dir, filename)
        file.save(input_filepath)

        output_name = f'output_{filename}'
        output_filepath = os.path.join(upload_dir, output_name)

        class Args:
            def __init__(self, input, output, pages):
                self.input = input
                self.output = output
                self.pages = pages

        args = Args(input=input_filepath, output=output_filepath, pages=pages)

        if operation == 'swap':
            swapPages(args)
            message = "Pages swapped successfully."
        elif operation == 'keep':
            keepPages(args)
            message = "Selected pages kept successfully."
        elif operation == 'remove':
            removePages(args)
            message = "Selected pages removed successfully."
        else:
            return jsonify({"message": "Invalid operation."}), 400

        return jsonify({
            "message": message,
            "download_url": _build_download_url(output_name),
        })

    except Exception as exc:  # noqa: BLE001 - surface unexpected failures to the user
        current_app.logger.exception("PDF operation failed: %s", exc)
        return jsonify({"message": "Something went wrong while processing the PDF."}), 500


@main.route('/download/<path:filename>', methods=['GET'])
def download_file(filename):
    upload_dir = current_app.config['UPLOAD_FOLDER']
    file_path = os.path.join(upload_dir, filename)
    if not os.path.isfile(file_path):
        return jsonify({"message": "File not found."}), 404
    return send_from_directory(upload_dir, filename, as_attachment=True)
