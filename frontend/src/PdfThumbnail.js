import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, CircularProgress, Typography } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker with local file
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.js`;

/**
 * PdfThumbnail - Displays a thumbnail preview of a PDF's first page
 * 
 * @param {File|string} file - PDF File object or URL
 * @param {Function} onExpand - Callback when user clicks to expand preview
 * @param {number} width - Thumbnail width in pixels (default: 80)
 * @param {boolean} showPageCount - Whether to show page count badge
 */
const PdfThumbnail = ({ file, onExpand, width = 80, showPageCount = true }) => {
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const onDocumentLoadSuccess = ({ numPages: pages }) => {
    setNumPages(pages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err) => {
    console.error('PDF load error:', err);
    setError('Failed to load PDF');
    setLoading(false);
  };

  // Convert File object to URL if needed
  const pdfUrl = file instanceof File ? URL.createObjectURL(file) : file;

  return (
    <Box
      sx={{
        position: 'relative',
        width: width,
        minWidth: width,
        height: width * 1.414, // A4 aspect ratio
        borderRadius: 1.5,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '2px solid rgba(249, 199, 132, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onExpand ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': onExpand ? {
          borderColor: 'rgba(255, 140, 66, 0.6)',
          transform: 'scale(1.05)',
          boxShadow: '0 4px 12px rgba(255, 140, 66, 0.25)',
          '& .expand-overlay': {
            opacity: 1,
          },
        } : {},
      }}
      onClick={onExpand}
    >
      {loading && (
        <CircularProgress
          size={24}
          sx={{ color: 'var(--sandy-brown)' }}
        />
      )}

      {error && (
        <Typography
          variant="caption"
          sx={{
            color: 'error.main',
            textAlign: 'center',
            padding: 1,
            fontSize: '0.65rem',
          }}
        >
          Preview unavailable
        </Typography>
      )}

      {!error && (
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          error=""
        >
          <Page
            pageNumber={1}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading=""
            error=""
          />
        </Document>
      )}

      {/* Page count badge */}
      {showPageCount && numPages && !error && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            backgroundColor: 'rgba(255, 140, 66, 0.95)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: 1,
            fontSize: '0.65rem',
            fontWeight: 700,
            lineHeight: 1.2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {numPages} {numPages === 1 ? 'page' : 'pages'}
        </Box>
      )}

      {/* Expand overlay on hover */}
      {onExpand && !loading && !error && (
        <Box
          className="expand-overlay"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
          }}
        >
          <ZoomInIcon sx={{ color: 'white', fontSize: 32 }} />
        </Box>
      )}
    </Box>
  );
};

export default PdfThumbnail;
