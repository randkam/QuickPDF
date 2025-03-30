import React, { useState } from 'react';

const PdfOperations = () => {
    const [file, setFile] = useState(null);
    const [operation, setOperation] = useState('');
    const [pages, setPages] = useState('');

    const handleFileChange = (event) => {
        setFile(event.target.files[0]);
    };

    const handleOperationChange = (event) => {
        setOperation(event.target.value);
    };

    const handlePagesChange = (event) => {
        setPages(event.target.value);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!file) {
            alert("Please select a file!");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("operation", operation);
        formData.append("pages", pages);

        const response = await fetch("http://127.0.0.1:5000/upload", {
            method: "POST",
            body: formData
        });

        const result = await response.text();
        alert(result);
    };

    return (
        <div>
            <h1>PDF Operations</h1>
            <form onSubmit={handleSubmit}>
                <input type="file" onChange={handleFileChange} />
                <select value={operation} onChange={handleOperationChange}>
                    <option value="">Select Operation</option>
                    <option value="swap">Swap Pages</option>
                    <option value="merge">Merge PDFs</option>
                    <option value="keep">Keep Pages</option>
                    <option value="remove">Remove Pages</option>
                </select>
                <input
                    type="text"
                    placeholder="Enter page numbers (comma-separated)"
                    value={pages}
                    onChange={handlePagesChange}
                />
                <button type="submit">Submit</button>
            </form>
        </div>
    );
};

export default PdfOperations;