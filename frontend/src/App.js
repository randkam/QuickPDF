import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert as MuiAlert,
  AppBar,
  Backdrop,
  Box,
  Button,
  Chip,
  Container,
  createTheme,
  CssBaseline,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Slide,
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
import CloseIcon from '@mui/icons-material/Close';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
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

// Local dev default (direct-to-backend); Docker/nginx sets REACT_APP_API_URL=/api at build time.
const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const encodeNetlifyForm = (data) =>
  Object.keys(data)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key] ?? '')}`)
    .join('&');

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const SnackbarTransition = (props) => <Slide {...props} direction="down" />;

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
  const origin = API_ORIGIN.replace(/\/+$/, '');
  const suffix = url.startsWith('/') ? url : `/${url}`;
  return `${origin}${suffix}`;
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
  const [swapPages, setSwapPages] = useState({ left: '', right: '' });
  const [outputName, setOutputName] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const submittingAtRef = useRef(0);
  const abortRef = useRef(null);

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
    setSwapPages({ left: '', right: '' });
    setOutputName('');
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
        message: 'Use positive numbers (e.g. 1 2 3) and avoid duplicates.',
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
    if (abortRef.current) abortRef.current.abort();
    setFile(null);
    setMergeFiles([]);
    setSelectedPages([]);
    setPageInput('');
    setSwapPages({ left: '', right: '' });
    setOutputName('');
    setResult(null);
  };

  const pollJobUntilDone = async (jobId, signal) => {
    const pollMs = 900;
    for (;;) {
      const response = await fetch(`${API_URL}/jobs/${jobId}`, { signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Unable to check job status.');
      }
      if (data.status === 'done') return data;
      if (data.status === 'error') throw new Error(data.error_message || 'PDF processing failed.');
      await new Promise((resolve) => window.setTimeout(resolve, pollMs));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append('operation', operation);
      if (outputName.trim()) {
        formData.append('output_name', outputName.trim());
      }

      if (operation === 'merge') {
        if (mergeFiles.length === 0) {
          throw new Error('Select at least one PDF to merge.');
        }
        mergeFiles.forEach((f) => formData.append('file', f));
      } else {
        if (!file) throw new Error('Select a PDF file first.');
        formData.append('file', file);
        if (operation === 'swap') {
          const left = swapPages.left.trim();
          const right = swapPages.right.trim();
          const isValid = (v) => /^\d+$/.test(v) && Number(v) > 0;
          if (!left || !right) throw new Error('Swap needs two page numbers.');
          if (!isValid(left) || !isValid(right)) throw new Error('Swap pages must be positive numbers.');
          if (left === right) throw new Error('Swap pages must be two different page numbers.');
          formData.append('pages', `${left},${right}`);
        } else if (selectedPages.length > 0) {
          formData.append('pages', selectedPages.join(','));
        }
      }

      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Unable to process your PDF right now.');
      }

      const jobId = data.job_id;
      if (!jobId) throw new Error('Server returned no job_id.');

      setSnackbar({ open: true, message: 'Job queued. Processing…', severity: 'info' });

      const job = await pollJobUntilDone(jobId, controller.signal);
      const downloadUrl = normalizeDownloadUrl(job.download_url || `/api/jobs/${jobId}/download`);
      const successMessage = 'Your PDF is ready.';
      const outputFileName = job.output_download_name || (outputName.trim() ? `${outputName.trim()}.pdf` : 'output.pdf');
      setResult({ message: successMessage, downloadUrl, outputFileName });
      setSnackbar({ open: true, message: successMessage, severity: 'success' });
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

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    const message = feedbackMessage.trim();
    if (!message) {
      setSnackbar({ open: true, message: 'Please enter your feedback message.', severity: 'warning' });
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const body = encodeNetlifyForm({
        'form-name': 'feedback',
        'bot-field': '',
        email: feedbackEmail.trim(),
        message,
      });

      const res = await fetch('/feedback', {
        method: 'POST',
        // Accept JSON to avoid any redirect-to-success-page behavior.
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      });

      if (!res.ok) throw new Error('Unable to submit feedback right now.');

      setFeedbackEmail('');
      setFeedbackMessage('');
      setIsFeedbackOpen(false);
      setSnackbar({ open: true, message: 'Thanks! Feedback submitted.', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Unable to submit feedback.', severity: 'error' });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const pageHint = useMemo(() => {
    switch (operation) {
      // case 'swap':
      //   return 'Example: swap page 2 with page 4.';
      // case 'keep':
      //   return 'Example: add 1 then 2 then 5 to keep only those pages.';
      // case 'remove':
      //   return 'Example: add 3 then 7 to remove those pages.';
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
            <Button
              color="inherit"
              startIcon={<FeedbackOutlinedIcon />}
              onClick={() => setIsFeedbackOpen(true)}
              sx={{ mr: 1 }}
            >
              Feedback
            </Button>
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
                  Merge, swap, keep, or remove pages. Minimal inputs, instant download links.
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
              <Paper elevation={4} className="panel operation-panel" sx={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
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
                      <Select labelId="operation-label" value={operation} label="Select" onChange={handleOperationChange}>
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
                        <input id="merge-file-upload" type="file" accept="application/pdf" multiple onChange={handleMergeFileChange} style={{ display: 'none' }} />
                        <label htmlFor="merge-file-upload">
                          <Button variant="contained" component="span" startIcon={<CloudUploadIcon />} fullWidth sx={{ mb: 1 }}>
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
                        <input id="file-upload" type="file" accept="application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                        <label htmlFor="file-upload">
                          <Button variant="contained" component="span" startIcon={<CloudUploadIcon />} fullWidth sx={{ mb: 1 }}>
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

                  {operation !== 'merge' && operation !== 'swap' && (
                    <Box className="form-section">
                      <Box className="form-section__header">
                        <span className="form-step form-step--muted">3</span>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '1rem' }}>
                          Pages
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
                            <Chip key={`${page}-${index}`} label={`Page ${page}`} onDelete={() => removePage(page)} deleteIcon={<DeleteIcon />} className="page-chip" />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}

                  {operation === 'swap' && (
                    <Box className="form-section">
                      <Box className="form-section__header">
                        <span className="form-step form-step--muted">3</span>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '1rem' }}>
                          Swap pages
                        </Typography>
                      </Box>

                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Page A"
                            value={swapPages.left}
                            onChange={(e) => setSwapPages((prev) => ({ ...prev, left: e.target.value }))}
                            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                            helperText={pageHint}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Page B"
                            value={swapPages.right}
                            onChange={(e) => setSwapPages((prev) => ({ ...prev, right: e.target.value }))}
                            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                            helperText="Both pages are required"
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  <Box className="form-section">
                    <Box className="form-section__header">
                      <span className="form-step form-step--muted">{operation === 'merge' ? '3' : '4'}</span>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '1rem' }}>
                        Output filename (optional)
                      </Typography>
                    </Box>
                    <TextField
                      fullWidth
                      label="Output filename"
                      placeholder="example"
                      value={outputName}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next.includes('.')) {
                          setSnackbar({
                            open: true,
                            message: 'Dots are not allowed in the output name. “.pdf” is added automatically.',
                            severity: 'warning',
                          });
                        }
                        setOutputName(next.replace(/\./g, ''));
                      }}
                      // helperText="No dots allowed. “.pdf” is fixed."
                      InputProps={{
                        endAdornment: <InputAdornment position="end">.pdf</InputAdornment>,
                      }}
                    />
                  </Box>

                  <Divider sx={{ my: 0.5, opacity: 0.6 }} />

                  <Box className="form-actions">
                    <Box className="form-summary">
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Ready:{' '}
                        <span className={`summary-pill ${hasFilesSelected ? 'summary-pill--ok' : ''}`}>{hasFilesSelected ? 'files selected' : 'upload a PDF'}</span>
                      </Typography>
                      {operation !== 'merge' && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          Pages:{' '}
                          <span className="summary-pill">
                            {operation === 'swap'
                              ? swapPages.left.trim() && swapPages.right.trim()
                                ? '2 selected'
                                : 'missing'
                              : selectedPages.length
                                ? `${selectedPages.length} added`
                                : 'missing'}
                          </span>
                        </Typography>
                      )}
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: '100%' }}>
                      <Button variant="contained" type="submit" fullWidth disabled={isSubmitting} startIcon={<CheckCircleIcon />}>
                        {isSubmitting ? 'Working...' : 'Run operation'}
                      </Button>
                      <Button variant="outlined" color="secondary" fullWidth onClick={resetAll} startIcon={<RestartAltIcon />}>
                        Reset
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              </Paper>
            </Box>

            <Box sx={{ flex: { xs: '1 1 auto', sm: '1 1 0' }, minWidth: 0 }}>
              <Paper elevation={4} className={`panel result-panel${isSubmitting ? ' result-panel--loading' : ''}${!isSubmitting && result ? ' result-panel--ready' : ''}`}>
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
                      <Typography variant="body1" sx={{ py: 1 }}>
                        {result.message}
                      </Typography>
                    {result.outputFileName && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Output: <span className="summary-pill summary-pill--ok">{result.outputFileName}</span>
                      </Typography>
                    )}
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

        <Dialog
          open={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              backgroundColor: 'rgba(10, 12, 20, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
              backdropFilter: 'blur(10px)',
            },
          }}
        >
          <DialogTitle sx={{ pr: 6 }}>
            Feedback
            <IconButton
              aria-label="Close feedback"
              onClick={() => setIsFeedbackOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Have ideas or found a bug? Send it here.
            </Typography>

            <Box
              component="form"
              name="feedback"
              method="POST"
              action="/feedback"
              data-netlify="true"
              data-netlify-honeypot="bot-field"
              onSubmit={handleFeedbackSubmit}
            >
              <input type="hidden" name="form-name" value="feedback" />
              <input type="hidden" name="bot-field" />

              <Stack spacing={1.25}>
                <TextField
                  fullWidth
                  label="Email (optional)"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  name="email"
                />
                <TextField
                  fullWidth
                  label="Your feedback"
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  name="message"
                  multiline
                  minRows={8}
                  autoFocus
                />
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              Powered by Netlify Forms
            </Typography>
            <Button onClick={() => setIsFeedbackOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button onClick={handleFeedbackSubmit} variant="contained" disabled={isSubmittingFeedback}>
              {isSubmittingFeedback ? 'Sending…' : 'Send'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Strong, attention-grabbing user messages */}
        <Backdrop
          open={snackbar.open}
          onClick={handleClose}
          sx={{
            zIndex: 1390,
            bgcolor: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(2px)',
          }}
        />
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6500}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          TransitionComponent={SnackbarTransition}
          sx={{
            // Keep it below the AppBar and very visible.
            mt: { xs: 7, sm: 9 },
            '& .MuiSnackbarContent-root': { width: '100%' },
            zIndex: 1400,
          }}
        >
          <Alert
            onClose={handleClose}
            severity={snackbar.severity}
            variant="filled"
            sx={{
              // Force solid, high-contrast backgrounds (some MUI variants can look translucent on dark themes).
              backgroundColor:
                snackbar.severity === 'success'
                  ? '#1B5E20'
                  : snackbar.severity === 'error'
                    ? '#B71C1C'
                    : snackbar.severity === 'warning'
                      ? '#E65100'
                      : '#0D47A1',
              color: '#FFFFFF',
              width: { xs: 'calc(100vw - 24px)', sm: 620 },
              maxWidth: '100%',
              fontSize: '1.05rem',
              fontWeight: 900,
              letterSpacing: '-0.01em',
              border: '2px solid rgba(255,255,255,0.22)',
              borderRadius: 2.5,
              px: 2.25,
              py: 1.75,
              boxShadow: '0 22px 70px rgba(0,0,0,0.6)',
            }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={handleClose}
                sx={{ fontWeight: 900, letterSpacing: '0.02em' }}
              >
                OK
              </Button>
            }
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
};

export default PdfOperations;


