import os
from flask import Blueprint, request, render_template
from werkzeug.utils import secure_filename
from .pdf_utils import swapPages, keepPages, removePages, mergePDFs

main = Blueprint('main', __name__)

UPLOAD_FOLDER = 'uploads/'
ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/upload', methods=['POST'])
def upload_file():
    operation = request.form.get('operation')
    pages = request.form.get('pages')

    # Handle merge operation separately
    if operation == 'merge':
        merge_files = request.files.getlist('file')
        if not merge_files or all(f.filename == '' for f in merge_files):
            return "No files selected for merge"
        
        saved_files = []
        for f in merge_files:
            if f and allowed_file(f.filename):
                filename = secure_filename(f.filename)
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                f.save(filepath)
                saved_files.append(filepath)
        
        if not saved_files:
            return "No valid files provided for merge"

        # Prepare arguments for merging
        class Args:
            def __init__(self, inputs, output):
                self.inputs = inputs
                self.output = output

        output_filepath = os.path.join(UPLOAD_FOLDER, 'output_merged.pdf')
        args = Args(inputs=saved_files, output=output_filepath)
        mergePDFs(args)
        return f"PDFs merged. Output saved as {output_filepath}"
    
    # For non-merge operations, expect a single file upload
    if 'file' not in request.files:
        return "No file part"
    
    file = request.files['file']
    if file.filename == '':
        return "No selected file"
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        # Prepare arguments for the PDF operations (pages expected to be comma-separated)
        class Args:
            def __init__(self, input, output, pages):
                self.input = input
                self.output = output
                self.pages = pages

        output_filepath = os.path.join(UPLOAD_FOLDER, f'output_{filename}')
        # For operations that use pages, split the pages string if provided
        args = Args(input=filepath, output=output_filepath, pages=pages.split(',') if pages else [])
        
        if operation == 'swap':
            swapPages(args)
            return f"Pages swapped in {filename}. Output saved as {output_filepath}"
        elif operation == 'keep':
            keepPages(args)
            return f"Pages kept from {filename}. Output saved as {output_filepath}"
        elif operation == 'remove':
            removePages(args)
            return f"Pages removed from {filename}. Output saved as {output_filepath}"
        else:
            return "Invalid operation"

    return "Invalid file type"
