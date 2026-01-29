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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
    helper: 'Combine 2 or more PDFs. Upload files and drag to reorder before merging.',
  },
  swap: {
    title: 'Swap Pages',
    helper: 'Provide exactly two page numbers to swap their positions.',
  },
  keep: {
    title: 'Keep Pages',
    helper: 'Extract specific pages from your PDF. All other pages will be discarded.',
    placeholder: 'e.g., 1-5, 8, 10-12',
    description: 'Enter the page numbers you want to KEEP in the final PDF',
  },
  remove: {
    title: 'Remove Pages',
    helper: 'Delete specific pages from your PDF. All other pages will be kept.',
    placeholder: 'e.g., 2-4, 7, 9-11',
    description: 'Enter the page numbers you want to DELETE from the PDF',
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

const SortableFileItem = ({ file, index, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 1,
        p: 1.5,
        borderRadius: 2,
        background: isDragging
          ? 'rgba(255, 140, 66, 0.15)'
          : 'rgba(249, 199, 132, 0.08)',
        border: isDragging
          ? '2px solid rgba(255, 140, 66, 0.6)'
          : '2px solid rgba(249, 199, 132, 0.3)',
        transition: 'all 0.2s ease',
        cursor: isDragging ? 'grabbing' : 'default',
        '&:hover': {
          background: 'rgba(249, 199, 132, 0.12)',
          borderColor: 'rgba(249, 199, 132, 0.5)',
        },
      }}
    >
      <IconButton
        {...attributes}
        {...listeners}
        size="small"
        sx={{
          cursor: 'grab',
          color: 'var(--sandy-brown)',
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        <DragIndicatorIcon />
      </IconButton>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flex: 1,
          minWidth: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: 'var(--pumpkin-spice)',
            minWidth: '24px',
          }}
        >
          #{index + 1}
        </Typography>
        <PictureAsPdfIcon sx={{ color: 'var(--apricot-cream)', fontSize: 20 }} />
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontWeight: 600,
            color: 'var(--white)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.name}
        </Typography>
      </Box>
      <IconButton
        size="small"
        onClick={onRemove}
        sx={{
          color: 'var(--pumpkin-spice)',
          '&:hover': {
            color: '#FF9F5A',
            transform: 'scale(1.1)',
          },
        }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

const PdfOperations = () => {
  const [file, setFile] = useState(null);
  const [mergeFiles, setMergeFiles] = useState([]);
  const [operation, setOperation] = useState('merge');
  const [pageInput, setPageInput] = useState('');
  const [selectedPages, setSelectedPages] = useState([]); // Array of { id, display, pages }
  const [swapPages, setSwapPages] = useState({ left: '', right: '' });
  const [outputName, setOutputName] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    pageInput: '',
    swapLeft: '',
    swapRight: '',
    file: '',
    mergeFiles: '',
    outputName: '',
  });
  const [progress, setProgress] = useState(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const submittingAtRef = useRef(0);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);
  const mergeFileInputRef = useRef(null);

  const selectedOperation = useMemo(() => operationDetails[operation] ?? operationDetails.merge, [operation]);
  const mergeCount = mergeFiles.length;
  const hasFilesSelected = operation === 'merge' ? mergeFiles.length > 0 : Boolean(file);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    const next = event.target.files?.[0] || null;
    setFile(next);
    if (next && fieldErrors.file) {
      setFieldErrors((prev) => ({ ...prev, file: '' }));
    }
    // Allow selecting the same file again after removing/resetting.
    event.target.value = '';
  };

  const handleMergeFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    if (newFiles.length) {
      // Add unique IDs to each file for drag-and-drop
      const filesWithIds = newFiles.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
      }));
      setMergeFiles((prev) => [...prev, ...filesWithIds]);
      if (fieldErrors.mergeFiles) {
        setFieldErrors((prev) => ({ ...prev, mergeFiles: '' }));
      }
    }
    // Allow adding the same file again after removing/resetting.
    event.target.value = '';
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setMergeFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
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
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (mergeFileInputRef.current) mergeFileInputRef.current.value = '';
  };

  const addPage = () => {
    const raw = pageInput.trim();
    if (!raw) return;

    // Clear any existing error
    setFieldErrors((prev) => ({ ...prev, pageInput: '' }));

    // Backend default: MAX_OPERATION_PAGES=50 (keep/remove). Prevent frustration by enforcing early.
    const maxOperationPages = 50;

    const normalized = raw.replace(/\s+/g, ',');
    const tokens = normalized
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newPageGroups = []; // Array of { id, display, pages }
    const allNewPages = new Set();

    for (const token of tokens) {
      if (/^\d+$/.test(token)) {
        const n = Number(token);
        if (!Number.isFinite(n) || n < 1) {
          setFieldErrors((prev) => ({ ...prev, pageInput: 'Please use positive page numbers (1, 2, 3, etc.)' }));
          return;
        }
        const s = String(n);
        if (!allNewPages.has(s)) {
          newPageGroups.push({
            id: `${Date.now()}-${Math.random()}`,
            display: s,
            pages: [s],
          });
          allNewPages.add(s);
        }
        continue;
      }

      if (/^\d+-\d+$/.test(token)) {
        const [startRaw, endRaw] = token.split('-');
        const start = Number(startRaw);
        const end = Number(endRaw);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) {
          setFieldErrors((prev) => ({ ...prev, pageInput: 'Please use positive page numbers in your range (e.g., 2-6)' }));
          return;
        }
        if (end < start) {
          setFieldErrors((prev) => ({ ...prev, pageInput: 'Range should go from low to high (e.g., 2-6, not 6-2)' }));
          return;
        }
        
        const rangePages = [];
        for (let i = start; i <= end; i += 1) {
          const s = String(i);
          if (!allNewPages.has(s)) {
            rangePages.push(s);
            allNewPages.add(s);
          }
        }
        
        if (rangePages.length > 0) {
          newPageGroups.push({
            id: `${Date.now()}-${Math.random()}`,
            display: token, // Keep the range format like "1-5"
            pages: rangePages,
          });
        }
        continue;
      }

      setFieldErrors((prev) => ({ ...prev, pageInput: 'Try using page numbers or ranges like: 1-5 or 1,3,7-9' }));
      return;
    }

    if (newPageGroups.length === 0) {
      setFieldErrors((prev) => ({ ...prev, pageInput: 'Nothing new to add!' }));
      return;
    }

    // Check for duplicates with existing selections
    const existingPages = new Set();
    selectedPages.forEach((group) => {
      group.pages.forEach((p) => existingPages.add(p));
    });

    const filteredGroups = newPageGroups.filter((group) => {
      return group.pages.some((p) => !existingPages.has(p));
    });

    if (filteredGroups.length === 0) {
      const isSinglePage = newPageGroups.length === 1 && newPageGroups[0].pages.length === 1;
      const isRange = newPageGroups.length === 1 && newPageGroups[0].pages.length > 1;
      
      if (isSinglePage) {
        setFieldErrors((prev) => ({ ...prev, pageInput: `Page ${newPageGroups[0].display} is already added` }));
      } else if (isRange) {
        setFieldErrors((prev) => ({ ...prev, pageInput: `Pages ${newPageGroups[0].display} are already added` }));
      } else {
        setFieldErrors((prev) => ({ ...prev, pageInput: 'These pages are already added' }));
      }
      return;
    }

    // Count total pages after adding
    const totalPagesAfter = existingPages.size + allNewPages.size - [...existingPages].filter(p => allNewPages.has(p)).length;
    if (totalPagesAfter > maxOperationPages) {
      setFieldErrors((prev) => ({ ...prev, pageInput: `That's too many pages! Maximum is ${maxOperationPages}` }));
      return;
    }

    setSelectedPages((prev) => [...prev, ...filteredGroups]);
    setPageInput('');
  };

  const removePage = (groupId) => {
    setSelectedPages((prev) => prev.filter((group) => group.id !== groupId));
  };

  const removeMergeFile = (fileId) => {
    setMergeFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const removeSingleFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (mergeFileInputRef.current) mergeFileInputRef.current.value = '';
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
      if (data.status === 'error') throw new Error(data.error_message || 'Something went wrong while processing your PDF.');
      await new Promise((resolve) => window.setTimeout(resolve, pollMs));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Clear all errors first
    setFieldErrors({
      pageInput: '',
      swapLeft: '',
      swapRight: '',
      file: '',
      mergeFiles: '',
      outputName: '',
    });
    
    // Validate before submitting
    let hasErrors = false;

    if (operation === 'merge') {
      if (mergeFiles.length === 0) {
        setFieldErrors((prev) => ({ ...prev, mergeFiles: 'Please select at least two PDFs to merge' }));
        hasErrors = true;
      } else if (mergeFiles.length === 1) {
        setFieldErrors((prev) => ({ ...prev, mergeFiles: 'Please select at least one more PDF to merge' }));
        hasErrors = true;
      }
    } else {
      if (!file) {
        setFieldErrors((prev) => ({ ...prev, file: 'Please select a PDF file first' }));
        hasErrors = true;
      }
      
      if (operation === 'swap') {
        const left = swapPages.left.trim();
        const right = swapPages.right.trim();
        const isValid = (v) => /^\d+$/.test(v) && Number(v) > 0;
        
        if (!left) {
          setFieldErrors((prev) => ({ ...prev, swapLeft: 'Please enter a page number' }));
          hasErrors = true;
        } else if (!isValid(left)) {
          setFieldErrors((prev) => ({ ...prev, swapLeft: 'Must be a positive number' }));
          hasErrors = true;
        }
        
        if (!right) {
          setFieldErrors((prev) => ({ ...prev, swapRight: 'Please enter a page number' }));
          hasErrors = true;
        } else if (!isValid(right)) {
          setFieldErrors((prev) => ({ ...prev, swapRight: 'Must be a positive number' }));
          hasErrors = true;
        }
        
        if (left && right && left === right) {
          setFieldErrors((prev) => ({ ...prev, swapRight: 'Must be different from Page A' }));
          hasErrors = true;
        }
      }
    }

    if (hasErrors) return;

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
        mergeFiles.forEach((fileObj) => formData.append('file', fileObj.file));
      } else {
        formData.append('file', file);
        if (operation === 'swap') {
          const left = swapPages.left.trim();
          const right = swapPages.right.trim();
          formData.append('pages', `${left},${right}`);
        } else if (selectedPages.length > 0) {
          // Flatten all page groups into a single comma-separated list
          const allPages = selectedPages.flatMap((group) => group.pages);
          formData.append('pages', allPages.join(','));
        }
      }

      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Unable to process your PDF right now. Please try again.');
      }

      const jobId = data.job_id;
      if (!jobId) throw new Error('Something went wrong. Please try again.');

      const job = await pollJobUntilDone(jobId, controller.signal);
      const downloadUrl = normalizeDownloadUrl(job.download_url || `/api/jobs/${jobId}/download`);
      const successMessage = 'Your PDF is ready.';
      const outputFileName = job.output_download_name || (outputName.trim() ? `${outputName.trim()}.pdf` : 'output.pdf');
      setResult({ message: successMessage, downloadUrl, outputFileName });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Something went wrong. Please try again.',
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
      setFeedbackError('Please write your feedback before submitting');
      return;
    }

    setIsSubmittingFeedback(true);
    setFeedbackError('');
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

      if (!res.ok) throw new Error('Unable to submit feedback right now. Please try again.');

      setFeedbackEmail('');
      setFeedbackMessage('');
      setFeedbackError('');
      setIsFeedbackOpen(false);
      setSnackbar({ open: true, message: 'Thanks for your feedback!', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Unable to submit feedback. Please try again.', severity: 'error' });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };


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
                        <Box
                          sx={{
                            border: fieldErrors.mergeFiles ? '2px solid #ff4444' : '2px solid transparent',
                            borderRadius: 2,
                            p: fieldErrors.mergeFiles ? 1.5 : 0,
                            transition: 'all 0.3s ease',
                            animation: fieldErrors.mergeFiles ? 'error-pulse 0.4s ease-out' : 'none',
                          }}
                        >
                          <input
                            id="merge-file-upload"
                            ref={mergeFileInputRef}
                            type="file"
                            accept="application/pdf"
                            multiple
                            onChange={handleMergeFileChange}
                            style={{ display: 'none' }}
                          />
                          <label htmlFor="merge-file-upload">
                            <Button variant="contained" component="span" startIcon={<CloudUploadIcon />} fullWidth sx={{ mb: 1 }}>
                              Upload PDF(s)
                            </Button>
                          </label>
                          {mergeFiles.length > 0 ? (
                            <>
                              <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" sx={{ color: 'var(--sandy-brown)', fontWeight: 700, mb: 1, display: 'block' }}>
                                  Drag files to reorder • Merge happens from top to bottom
                                </Typography>
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={handleDragEnd}
                                >
                                  <SortableContext
                                    items={mergeFiles.map((f) => f.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {mergeFiles.map((fileObj, index) => (
                                      <SortableFileItem
                                        key={fileObj.id}
                                        file={fileObj}
                                        index={index}
                                        onRemove={() => removeMergeFile(fileObj.id)}
                                      />
                                    ))}
                                  </SortableContext>
                                </DndContext>
                              </Box>
                              <Typography variant="caption" sx={{ color: 'success.light', fontWeight: 600 }}>
                                ✓ {mergeCount} file{mergeCount === 1 ? '' : 's'} selected
                              </Typography>
                            </>
                          ) : (
                            <Box className="upload-hint">
                              <Typography variant="body2" color="text.secondary">
                                Add at least 2 PDFs • Drag to reorder after uploading
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        {fieldErrors.mergeFiles && (
                          <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600, mt: 1, display: 'block' }}>
                            {fieldErrors.mergeFiles}
                          </Typography>
                        )}
                      </>
                    ) : (
                      <>
                        <Box
                          sx={{
                            border: fieldErrors.file ? '2px solid #ff4444' : '2px solid transparent',
                            borderRadius: 2,
                            p: fieldErrors.file ? 1.5 : 0,
                            transition: 'all 0.3s ease',
                            animation: fieldErrors.file ? 'error-pulse 0.4s ease-out' : 'none',
                          }}
                        >
                          <input
                            id="file-upload"
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                          />
                          <label htmlFor="file-upload">
                            <Button variant="contained" component="span" startIcon={<CloudUploadIcon />} fullWidth sx={{ mb: 1 }}>
                              Upload PDF
                            </Button>
                          </label>
                          {file ? (
                            <Chip
                              icon={<PictureAsPdfIcon />}
                              label={file.name}
                              onDelete={removeSingleFile}
                              deleteIcon={<DeleteIcon />}
                              className="file-chip"
                              sx={{ maxWidth: '100%' }}
                            />
                          ) : (
                            <Box className="upload-hint">
                              <Typography variant="body2" color="text.secondary">
                                Select a single PDF to modify.
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        {fieldErrors.file && (
                          <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600, mt: 1, display: 'block' }}>
                            {fieldErrors.file}
                          </Typography>
                        )}
                      </>
                    )}
                  </Box>

                  {operation !== 'merge' && operation !== 'swap' && (
                    <Box className="form-section">
                      <Box className="form-section__header">
                        <span className="form-step form-step--muted">3</span>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '1rem' }}>
                          {operation === 'keep' ? 'Pages to Keep' : 'Pages to Remove'}
                        </Typography>
                      </Box>
                      
                      {/* Operation Description */}
                      <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255, 140, 66, 0.08)', border: '1px solid rgba(255, 140, 66, 0.2)' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#FCAF58' }}>
                          {selectedOperation.description}
                        </Typography>
                      </Box>

                      <Grid container spacing={1} alignItems="flex-start">
                        <Grid item xs={12} sm={8}>
                          <TextField
                            fullWidth
                            label={operation === 'keep' ? 'Enter pages to keep' : 'Enter pages to remove'}
                            placeholder={selectedOperation.placeholder}
                            value={pageInput}
                            onChange={(e) => {
                              setPageInput(e.target.value);
                              if (fieldErrors.pageInput) {
                                setFieldErrors((prev) => ({ ...prev, pageInput: '' }));
                              }
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPage())}
                            error={Boolean(fieldErrors.pageInput)}
                            helperText={
                              fieldErrors.pageInput || (
                                <>
                                  <strong>Format:</strong> Individual pages (1, 3, 5) or ranges (1-5, 10-15)
                                  <br />
                                  Press Enter or click Add to confirm
                                </>
                              )
                            }
                            FormHelperTextProps={{
                              component: 'div',
                              sx: { mt: 1 }
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Button fullWidth variant="outlined" onClick={addPage} sx={{ height: '56px' }}>
                            Add
                          </Button>
                        </Grid>
                      </Grid>

                      {selectedPages.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.light', mb: 1, display: 'block' }}>
                            {operation === 'keep' 
                              ? `✓ Selected ${selectedPages.length} item${selectedPages.length === 1 ? '' : 's'}` 
                              : `✓ Selected ${selectedPages.length} item${selectedPages.length === 1 ? '' : 's'}`
                            }
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                            {selectedPages.map((group) => (
                              <Chip 
                                key={group.id} 
                                label={group.display.includes('-') ? `Pages ${group.display}` : `Page ${group.display}`} 
                                onDelete={() => removePage(group.id)} 
                                deleteIcon={<DeleteIcon />} 
                                className="page-chip" 
                              />
                            ))}
                          </Stack>
                        </Box>
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
                            onChange={(e) => {
                              setSwapPages((prev) => ({ ...prev, left: e.target.value }));
                              if (fieldErrors.swapLeft) {
                                setFieldErrors((prev) => ({ ...prev, swapLeft: '' }));
                              }
                            }}
                            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                            error={Boolean(fieldErrors.swapLeft)}
                            helperText={fieldErrors.swapLeft || 'First page number'}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Page B"
                            value={swapPages.right}
                            onChange={(e) => {
                              setSwapPages((prev) => ({ ...prev, right: e.target.value }));
                              if (fieldErrors.swapRight) {
                                setFieldErrors((prev) => ({ ...prev, swapRight: '' }));
                              }
                            }}
                            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                            error={Boolean(fieldErrors.swapRight)}
                            helperText={fieldErrors.swapRight || 'Second page number'}
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
                          setFieldErrors((prev) => ({ ...prev, outputName: "No need to add .pdf - we'll add that for you!" }));
                        } else if (fieldErrors.outputName) {
                          setFieldErrors((prev) => ({ ...prev, outputName: '' }));
                        }
                        setOutputName(next.replace(/\./g, ''));
                      }}
                      error={Boolean(fieldErrors.outputName)}
                      helperText={fieldErrors.outputName || ''}
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
                                ? `${selectedPages.length} item${selectedPages.length === 1 ? '' : 's'} added`
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
          onClose={() => {
            setIsFeedbackOpen(false);
            setFeedbackError('');
          }}
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
              onClick={() => {
                setIsFeedbackOpen(false);
                setFeedbackError('');
              }}
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
                  onChange={(e) => {
                    setFeedbackMessage(e.target.value);
                    if (feedbackError) {
                      setFeedbackError('');
                    }
                  }}
                  name="message"
                  multiline
                  minRows={8}
                  autoFocus
                  error={Boolean(feedbackError)}
                  helperText={feedbackError}
                />
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              Powered by Netlify Forms
            </Typography>
            <Button onClick={() => {
              setIsFeedbackOpen(false);
              setFeedbackError('');
            }} color="secondary">
              Cancel
            </Button>
            <Button onClick={handleFeedbackSubmit} variant="contained" disabled={isSubmittingFeedback}>
              {isSubmittingFeedback ? 'Sending…' : 'Send'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* User feedback messages */}
        <Backdrop
          open={snackbar.open && snackbar.severity === 'error'}
          onClick={handleClose}
          sx={{
            zIndex: 1390,
            bgcolor: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(2px)',
          }}
        />
        <Snackbar
          open={snackbar.open}
          autoHideDuration={snackbar.severity === 'info' ? 4000 : 6500}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          TransitionComponent={SnackbarTransition}
          sx={{
            mt: { xs: 7, sm: 9 },
            '& .MuiSnackbarContent-root': { width: '100%' },
            zIndex: 1400,
          }}
        >
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <Alert
              onClose={handleClose}
              severity={snackbar.severity}
              variant="filled"
              className={snackbar.severity === 'info' ? 'info-snackbar' : ''}
              sx={{
                backgroundColor:
                  snackbar.severity === 'success'
                    ? '#1B5E20'
                    : snackbar.severity === 'error'
                      ? '#B71C1C'
                      : snackbar.severity === 'warning'
                        ? '#E65100'
                        : '#FF8C42', // Orange background for info
                color: '#FFFFFF',
                width: { xs: 'calc(100vw - 32px)', sm: 480 },
                maxWidth: '100%',
                fontSize: snackbar.severity === 'info' ? '0.95rem' : '1.05rem',
                fontWeight: snackbar.severity === 'info' ? 700 : 900,
                letterSpacing: '-0.01em',
                border: snackbar.severity === 'info' 
                  ? '2px solid rgba(255, 255, 255, 0.3)' 
                  : '2px solid rgba(255,255,255,0.22)',
                borderRadius: 2,
                px: 2,
                py: snackbar.severity === 'info' ? 1.25 : 1.75,
                boxShadow: snackbar.severity === 'info'
                  ? '0 8px 32px rgba(255, 140, 66, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)'
                  : '0 22px 70px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                position: 'relative',
              }}
              icon={snackbar.severity === 'info' ? false : undefined}
              action={
                <IconButton
                  size="small"
                  onClick={handleClose}
                  sx={{ 
                    color: '#FFFFFF',
                    opacity: 0.9,
                    '&:hover': {
                      opacity: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
            >
              {snackbar.message}
            </Alert>
            {snackbar.severity === 'info' && (
              <Box
                className="snackbar-countdown-bar"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: '0 0 8px 8px',
                  overflow: 'hidden',
                  zIndex: 1,
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    backgroundColor: '#FFFFFF',
                    animation: 'countdown-shrink 4s linear forwards',
                    transformOrigin: 'left',
                  }}
                />
              </Box>
            )}
          </Box>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
};

export default PdfOperations;


