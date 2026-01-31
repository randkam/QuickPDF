import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Button,
  CircularProgress,
  Stack,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker with local file
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.js`;

/**
 * PdfPreviewModal - Full-featured PDF preview dialog
 * 
 * @param {boolean} open - Whether the modal is open
 * @param {Function} onClose - Callback to close the modal
 * @param {File|string} file - PDF File object or URL
 * @param {string} fileName - Name to display in the header
 */
const PdfPreviewModal = ({ open, onClose, file, fileName = 'PDF Preview' }) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reset state when modal opens with new file
  React.useEffect(() => {
    if (open && file) {
      setCurrentPage(1);
      setPageInputValue('1');
      setScale(1.0);
      setLoading(true);
      setError(null);
    }
  }, [open, file]);

  // Update input value when page changes
  React.useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open || !numPages) return;

    const handleKeyDown = (e) => {
      // Ignore if user is typing in the page input
      if (e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          setCurrentPage((prev) => Math.max(1, prev - 1));
          break;
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          setCurrentPage((prev) => Math.min(numPages, prev + 1));
          break;
        case 'Home':
          e.preventDefault();
          setCurrentPage(1);
          break;
        case 'End':
          e.preventDefault();
          setCurrentPage(numPages);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, numPages]);

  const onDocumentLoadSuccess = ({ numPages: pages }) => {
    setNumPages(pages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err) => {
    console.error('PDF load error:', err);
    setError('Failed to load PDF preview');
    setLoading(false);
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(numPages || 1, prev + 1));
  };

  const handlePageInputChange = (e) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const pageNum = parseInt(pageInputValue, 10);
    if (pageNum && pageNum >= 1 && pageNum <= numPages) {
      setCurrentPage(pageNum);
    } else {
      // Reset to current page if invalid
      setPageInputValue(String(currentPage));
    }
  };

  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInputValue, 10);
    if (!pageNum || pageNum < 1 || pageNum > numPages) {
      setPageInputValue(String(currentPage));
    }
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(2.5, prev + 0.25));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.25));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  // Convert File object to URL if needed
  const pdfUrl = file instanceof File ? URL.createObjectURL(file) : file;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={false}
      PaperProps={{
        sx: {
          backgroundColor: 'rgba(10, 12, 20, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
          backdropFilter: 'blur(10px)',
          height: '90vh',
          maxHeight: '90vh',
          m: { xs: 1, sm: 2 },
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          pr: 6,
          fontSize: { xs: '1rem', sm: '1.1rem' },
          borderBottom: '1px solid rgba(249, 199, 132, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '0.95rem', sm: '1.1rem' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileName}
          </Typography>
          {numPages && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
            >
              {numPages} {numPages === 1 ? 'page' : 'pages'}
            </Typography>
          )}
        </Box>
        <IconButton
          aria-label="Close preview"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'var(--apricot-cream)',
            '&:hover': {
              color: 'var(--pumpkin-spice)',
              backgroundColor: 'rgba(255, 140, 66, 0.1)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Controls */}
      {!loading && !error && numPages && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: { xs: 2, sm: 3 },
            py: 1.5,
            borderBottom: '1px solid rgba(249, 199, 132, 0.2)',
            backgroundColor: 'rgba(255, 140, 66, 0.05)',
            flexWrap: 'wrap',
          }}
        >
          {/* Page navigation */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="Previous page (Arrow Left)">
                <span>
                  <IconButton
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                    size="small"
                    sx={{
                      color: currentPage === 1 ? 'text.disabled' : 'var(--sandy-brown)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 140, 66, 0.1)',
                      },
                    }}
                  >
                    <NavigateBeforeIcon />
                  </IconButton>
                </span>
              </Tooltip>
              
              {/* Page jump input */}
              <Box
                component="form"
                onSubmit={handlePageInputSubmit}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor: 'rgba(66, 77, 122, 0.5)',
                    border: '1px solid rgba(249, 199, 132, 0.3)',
                  }}
                >
                  <input
                    type="text"
                    value={pageInputValue}
                    onChange={handlePageInputChange}
                    onBlur={handlePageInputBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePageInputSubmit(e);
                        e.target.blur();
                      }
                    }}
                    style={{
                      width: '40px',
                      textAlign: 'center',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--white)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      fontSize: { xs: '0.8rem', sm: '0.875rem' },
                      color: 'text.secondary',
                    }}
                  >
                    / {numPages}
                  </Typography>
                </Box>
              </Box>
              
              <Tooltip title="Next page (Arrow Right)">
                <span>
                  <IconButton
                    onClick={goToNextPage}
                    disabled={currentPage === numPages}
                    size="small"
                    sx={{
                      color: currentPage === numPages ? 'text.disabled' : 'var(--sandy-brown)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 140, 66, 0.1)',
                      },
                    }}
                  >
                    <NavigateNextIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Zoom controls */}
          <Stack direction="row" spacing={1} alignItems="center" className="pdf-zoom-controls">
            <Tooltip title="Zoom out">
              <span>
                <IconButton
                  onClick={zoomOut}
                  disabled={scale <= 0.5}
                  size="small"
                  sx={{
                    color: scale <= 0.5 ? 'text.disabled' : 'var(--sandy-brown)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 140, 66, 0.1)',
                    },
                  }}
                >
                  <ZoomOutIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                minWidth: 50,
                textAlign: 'center',
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
              }}
            >
              {Math.round(scale * 100)}%
            </Typography>
            <Tooltip title="Zoom in">
              <span>
                <IconButton
                  onClick={zoomIn}
                  disabled={scale >= 2.5}
                  size="small"
                  sx={{
                    color: scale >= 2.5 ? 'text.disabled' : 'var(--sandy-brown)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 140, 66, 0.1)',
                    },
                  }}
                >
                  <ZoomInIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Reset zoom">
              <IconButton
                onClick={resetZoom}
                size="small"
                sx={{
                  color: 'var(--sandy-brown)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 140, 66, 0.1)',
                  },
                }}
              >
                <FitScreenIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}

      {/* Content */}
      <DialogContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          p: { xs: 2, sm: 3 },
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
      >
        {loading && (
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress
              size={48}
              sx={{ color: 'var(--pumpkin-spice)', mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              Loading preview...
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
            <Typography variant="h6" color="error.main" gutterBottom>
              Preview Error
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {error}
            </Typography>
            <Button variant="outlined" onClick={onClose}>
              Close
            </Button>
          </Box>
        )}

        {!error && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              maxWidth: '100%',
              '& .react-pdf__Document': {
                display: 'flex',
                justifyContent: 'center',
              },
              '& .react-pdf__Page': {
                maxWidth: '100%',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                backgroundColor: 'white',
              },
              '& canvas': {
                maxWidth: '100%',
                height: 'auto !important',
              },
            }}
          >
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading=""
              error=""
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading=""
                error=""
              />
            </Document>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PdfPreviewModal;
