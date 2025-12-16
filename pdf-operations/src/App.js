import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert as MuiAlert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  createTheme,
  CssBaseline,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import './App.css';

// Sunny & Warm palette theme
// #4E598C - Dusk Blue (base)
// #FFFFFF - White (text)
// #F9C784 - Apricot Cream (light accent)
// #FCAF58 - Sandy Brown (medium accent)
// #FF8C42 - Pumpkin Spice (primary accent)
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FF8C42',
      light: '#FCAF58',
      dark: '#E67A30',
    },
    secondary: {
      main: '#F9C784',
      light: '#FDDAA0',
      dark: '#FCAF58',
    },
    success: {
      main: '#FF8C42',
      light: '#FCAF58',
      dark: '#E67A30',
    },
    background: {
      default: '#4E598C',
      paper: 'transparent',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#F9C784',
    },
  },
  typography: {
    fontFamily: "'Nunito', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#4E598C',
          color: '#FFFFFF',
        },
      },
    },
  },
});

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const operationDetails = {
  merge: {
    title: 'Merge PDFs',
    helper: 'Combine multiple PDFs in the order you add them.',
  },
  swap: {
    title: 'Swap Pages',
    helper: 'Provide exactly two page numbers to swap their positions.',
  },
  keep: {
    title: 'Keep Pages',
    helper: 'Keep only the pages you list.',
  },
  remove: {
    title: 'Remove Pages',
    helper: 'Delete unwanted pages and keep the rest.',
  },
};

const normalizeDownloadUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const api = API_URL.replace(/\/+$/, '');
  const suffix = url.startsWith('/') ? url : `/${url}`;
  return `${api}${suffix}`;
};

const LoadingResult = ({ operationTitle, progress }) => {
  return (
    <Box className="loading-state">
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
        Running {operationTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Please wait… your PDF is being processed.
      </Typography>

      <Box className="arrow-progress" aria-label="Processing">
        <Box className="arrow-progress__track">
          <Box className="arrow-progress__fill" />
        </Box>
        <Box className="arrow-progress__head" />
      </Box>

      <Box className="loading-cool-text" aria-hidden="true">
        <span className="loading-cool-text__word">Processing</span>
        <span className="loading-cool-text__dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </Box>

      <Box className="loading-percent">
        <Box className="loading-percent__row">
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            Progress
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 900 }}>
            {Math.max(0, Math.min(100, Math.round(progress)))}%
          </Typography>
        </Box>
        <Box className="loading-percent__bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <Box className="loading-percent__barFill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </Box>
      </Box>
    </Box>
  );
};

const PdfOperations = () => {
  const [file, setFile] = useState(null);
  const [mergeFiles, setMergeFiles] = useState([]);
  const [operation, setOperation] = useState('merge');
  const [pageInput, setPageInput] = useState('');
  const [selectedPages, setSelectedPages] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const submittingAtRef = useRef(0);

  const selectedOperation = useMemo(() => operationDetails[operation] ?? operationDetails.merge, [operation]);
  const mergeCount = mergeFiles.length;
  const hasFilesSelected = operation === 'merge' ? mergeFiles.length > 0 : Boolean(file);

  useEffect(() => {
    if (!isSubmitting) return;

    // Simulated progress: climbs quickly at first, then slows and caps at 95% until done.
    setProgress(0);
    const startedAt = Date.now();
    submittingAtRef.current = startedAt;

    const interval = setInterval(() => {
      const t = (Date.now() - startedAt) / 1000;
      // Ease-out curve towards 95
      const next = 95 * (1 - Math.exp(-1.4 * t));
      setProgress((prev) => Math.max(prev, Math.min(95, next)));
    }, 120);

    return () => clearInterval(interval);
  }, [isSubmitting]);

  const handleFileChange = (event) => {
    setFile(event.target.files[0] || null);
  };

  const handleMergeFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    if (newFiles.length) {
      setMergeFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleOperationChange = (event) => {
    setOperation(event.target.value);
    setFile(null);
    setMergeFiles([]);
    setSelectedPages([]);
    setResult(null);
  };

  const addPage = () => {
    const value = pageInput.trim();
    if (!value) return;
    const isValid = /^\d+$/.test(value) && Number(value) > 0;
    if (isValid && !selectedPages.includes(value)) {
      setSelectedPages((prev) => [...prev, value]);
      setPageInput('');
    } else {
      setSnackbar({
        open: true,
        message: 'Use positive numbers (e.g. 1,2,3) and avoid duplicates.',
        severity: 'warning',
      });
    }
  };

  const removePage = (pageToRemove) => {
    setSelectedPages((prev) => prev.filter((page) => page !== pageToRemove));
  };

  const removeMergeFile = (fileToRemove) => {
    setMergeFiles((prev) => prev.filter((f) => f !== fileToRemove));
  };

  const resetAll = () => {
    setFile(null);
    setMergeFiles([]);
    setSelectedPages([]);
    setPageInput('');
    setResult(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('operation', operation);

      if (operation === 'merge') {
        if (mergeFiles.length === 0) {
          throw new Error('Select at least one PDF to merge.');
        }
        mergeFiles.forEach((f) => formData.append('file', f));
      } else {
        if (!file) throw new Error('Select a PDF file first.');
        formData.append('file', file);
        if (selectedPages.length > 0) {
          formData.append('pages', selectedPages.join(','));
        }
      }

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Unable to process your PDF right now.');
      }

      const downloadUrl = normalizeDownloadUrl(data.download_url);
      setResult({ message: data.message, downloadUrl });
      setSnackbar({ open: true, message: data.message, severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Something went wrong.',
        severity: 'error',
      });
    } finally {
      // Ensure the loading state is visible (so users can actually see it)
      // but don't slow down results too much.
      setProgress(100);
      const minMs = 500;
      const elapsed = Date.now() - (submittingAtRef.current || Date.now());
      const remaining = Math.max(0, minMs - elapsed);
      window.setTimeout(() => setIsSubmitting(false), remaining);
    }
  };

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const pageHint = useMemo(() => {
    switch (operation) {
      case 'swap':
        return 'Example: 2,4 will swap page 2 with page 4.';
      case 'keep':
        return 'Example: 1,2,5 keeps pages 1, 2 and 5 only.';
      case 'remove':
        return 'Example: 3,7 removes pages 3 and 7.';
      default:
        return '';
    }
  }, [operation]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box className="app-shell">
        <AppBar position="static" elevation={0} className="app-bar">
        <Toolbar>
          <PictureAsPdfIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            QuickPDF
          </Typography>
          <Typography variant="body2" color="inherit">
            Edit PDFs in seconds
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, md: 4 } }}>
        <Paper elevation={6} className="hero" sx={{ mb: 4 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 1.5, letterSpacing: '-0.02em' }}>
                Edit PDFs without the clutter
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, fontSize: '1.1rem', lineHeight: 1.7 }}>
                Merge, swap, keep, or remove pages. Minimal inputs, instant download links, calm visuals.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.25} sx={{ mt: 2, flexWrap: 'wrap', gap: 1.25 }}>
              <Chip icon={<CheckCircleIcon />} label="Merge PDFs" size="medium" className="feature-chip" />
              <Chip icon={<CheckCircleIcon />} label="Swap pages" size="medium" className="feature-chip" />
              <Chip icon={<CheckCircleIcon />} label="Remove pages" size="medium" className="feature-chip" />
              <Chip icon={<CheckCircleIcon />} label="Keep pages" size="medium" className="feature-chip" />
            </Stack>
          </Stack>
        </Paper>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 3,
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          <Box sx={{ flex: { xs: '1 1 auto', sm: '2 1 0' }, minWidth: 0 }}>
            <Paper
              elevation={4}
              className="panel operation-panel"
              sx={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}
            >
              <Box
                component="form"
                onSubmit={handleSubmit}
                className="operation-form"
                sx={{
                  p: { xs: 2.5, md: 3 },
                  gap: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                }}
              >
                <Box className="form-section">
                  <Box className="form-section__header">
                    <span className="form-step">1</span>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '1rem' }}>
                      Choose an operation
                    </Typography>
                  </Box>
                  <FormControl fullWidth sx={{ maxWidth: 'none' }}>
                    <InputLabel id="operation-label">Select</InputLabel>
                    <Select
                      labelId="operation-label"
                      value={operation}
                      label="Select"
                      onChange={handleOperationChange}
                    >
                      <MenuItem value="merge">Merge PDFs</MenuItem>
                      <MenuItem value="swap">Swap pages</MenuItem>
                      <MenuItem value="keep">Keep pages</MenuItem>
                      <MenuItem value="remove">Remove pages</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, opacity: 0.9 }}>
                    {selectedOperation.helper}
                  </Typography>
                </Box>

                <Box className="form-section">
                  <Box className="form-section__header">
                    <span className="form-step">2</span>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '1rem' }}>
                      Upload PDF{operation === 'merge' ? 's' : ''}
                    </Typography>
                  </Box>
                  {operation === 'merge' ? (
                    <>
                      <input
                        id="merge-file-upload"
                        type="file"
                        accept="application/pdf"
                        multiple
                        onChange={handleMergeFileChange}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="merge-file-upload">
                        <Button
                          variant="contained"
                          component="span"
                          startIcon={<CloudUploadIcon />}
                          fullWidth
                          sx={{ mb: 1 }}
                        >
                          Upload PDF(s)
                        </Button>
                      </label>
                      {mergeFiles.length > 0 ? (
                        <>
                          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1, mb: 1.5 }}>
                            {mergeFiles.map((selectedFile, index) => (
                              <Chip
                                key={`${selectedFile.name}-${index}`}
                                icon={<PictureAsPdfIcon />}
                                label={selectedFile.name}
                                onDelete={() => removeMergeFile(selectedFile)}
                                deleteIcon={<DeleteIcon />}
                                className="file-chip"
                                sx={{ maxWidth: '100%' }}
                              />
                            ))}
                          </Stack>
                          <Typography variant="caption" sx={{ color: 'success.light', fontWeight: 600 }}>
                            ✓ {mergeCount} file{mergeCount === 1 ? '' : 's'} selected
                          </Typography>
                        </>
                      ) : (
                        <Box className="upload-hint">
                          <Typography variant="body2" color="text.secondary">
                            Add PDFs in the order you want them merged.
                          </Typography>
                        </Box>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        id="file-upload"
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="file-upload">
                        <Button
                          variant="contained"
                          component="span"
                          startIcon={<CloudUploadIcon />}
                          fullWidth
                          sx={{ mb: 1 }}
                        >
                          Upload PDF
                        </Button>
                      </label>
                      {file ? (
                        <Chip icon={<PictureAsPdfIcon />} label={file.name} className="file-chip" />
                      ) : (
                        <Box className="upload-hint">
                          <Typography variant="body2" color="text.secondary">
                            Select a single PDF to modify.
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Box>

                {operation !== 'merge' && (
                  <Box className="form-section">
                    <Box className="form-section__header">
                      <span className="form-step form-step--muted">3</span>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '1rem' }}>
                        Pages (optional)
                      </Typography>
                    </Box>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={12} sm={8}>
                        <TextField
                          fullWidth
                          label="Add page number"
                          value={pageInput}
                          onChange={(e) => setPageInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPage())}
                          helperText={pageHint || 'Press Enter to add'}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button fullWidth variant="outlined" onClick={addPage}>
                          Add page
                        </Button>
                      </Grid>
                    </Grid>
                    {selectedPages.length > 0 && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5, gap: 1 }}>
                        {selectedPages.map((page, index) => (
                          <Chip
                            key={`${page}-${index}`}
                            label={`Page ${page}`}
                            onDelete={() => removePage(page)}
                            deleteIcon={<DeleteIcon />}
                            className="page-chip"
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>
                )}

                <Divider sx={{ my: 0.5, opacity: 0.6 }} />

                <Box className="form-actions">
                  <Box className="form-summary">
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      Ready:{' '}
                      <span className={`summary-pill ${hasFilesSelected ? 'summary-pill--ok' : ''}`}>
                        {hasFilesSelected ? 'files selected' : 'upload a PDF'}
                      </span>
                    </Typography>
                    {operation !== 'merge' && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Pages:{' '}
                        <span className="summary-pill">
                          {selectedPages.length ? `${selectedPages.length} added` : 'none'}
                        </span>
                      </Typography>
                    )}
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: '100%' }}>
                  <Button
                    variant="contained"
                    type="submit"
                    fullWidth
                    disabled={isSubmitting}
                    startIcon={<CheckCircleIcon />}
                  >
                    {isSubmitting ? 'Working...' : 'Run operation'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    fullWidth
                    onClick={resetAll}
                    startIcon={<RestartAltIcon />}
                  >
                    Reset
                  </Button>
                  </Stack>
                </Box>
              </Box>
            </Paper>
          </Box>

          <Box sx={{ flex: { xs: '1 1 auto', sm: '1 1 0' }, minWidth: 0 }}>
            <Paper
              elevation={4}
              className={`panel result-panel${isSubmitting ? ' result-panel--loading' : ''}${!isSubmitting && result ? ' result-panel--ready' : ''}`}
            >
              <Stack spacing={2.25} sx={{ p: { xs: 2.5, md: 3 } }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem', mb: 0.5 }}>
                    Result
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Download link appears here after each run.
                  </Typography>
                </Box>

                <Divider />

                {isSubmitting ? (
                  <LoadingResult operationTitle={selectedOperation.title} progress={progress} />
                ) : result ? (
                  <Stack spacing={2} className="result-content">
                    <Box className="success-indicator">
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <CheckCircleIcon sx={{ color: 'success.light', fontSize: 28 }} />
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.light' }}>
                            Success!
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {selectedOperation.title}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                    <Typography variant="body1" sx={{ py: 1 }}>{result.message}</Typography>
                    {result.downloadUrl && (
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<DownloadIcon />}
                        href={result.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        fullWidth
                        className="download-button"
                      >
                        Download PDF
                      </Button>
                    )}
                  </Stack>
                ) : (
                  <Box className="empty-state">
                    <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
                      <Box className="empty-icon">
                        <PictureAsPdfIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                      </Box>
                      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 280 }}>
                        Choose an operation, upload your PDF(s), and run it to get your file.
                      </Typography>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Container>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={5000}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleClose} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
};

export default PdfOperations;
