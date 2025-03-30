import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Container,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Grid,
  Snackbar,
  Paper,
  Box,
  Chip,
  Stack,
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import { Delete as DeleteIcon } from '@mui/icons-material';

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const PdfOperations = () => {
  // For non-merge operations
  const [file, setFile] = useState(null);
  // For merge operation
  const [mergeFiles, setMergeFiles] = useState([]);
  const [operation, setOperation] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [selectedPages, setSelectedPages] = useState([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  // For non-merge operations
  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  // For merge operation (allows multiple files)
  const handleMergeFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    setMergeFiles((prev) => [...prev, ...newFiles]);
  };

  const handleOperationChange = (event) => {
    setOperation(event.target.value);
    // Reset file selections when changing operations
    setFile(null);
    setMergeFiles([]);
    setSelectedPages([]);
  };

  const handlePageInputChange = (event) => {
    setPageInput(event.target.value);
  };

  const addPage = () => {
    const page = pageInput.trim();
    if (page && !isNaN(page) && !selectedPages.includes(page)) {
      setSelectedPages((prev) => [...prev, page]);
      setPageInput('');
    }
  };

  const removePage = (pageToRemove) => {
    setSelectedPages((prev) => prev.filter((page) => page !== pageToRemove));
  };

  const removeMergeFile = (fileToRemove) => {
    setMergeFiles((prev) => prev.filter((f) => f !== fileToRemove));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("operation", operation);

    if (operation === "merge") {
      if (mergeFiles.length === 0) {
        setMessage("Please select at least one file to merge!");
        setOpen(true);
        return;
      }
      // Append each file using the key "file"
      mergeFiles.forEach((f) => formData.append("file", f));
    } else {
      if (!file) {
        setMessage("Please select a file!");
        setOpen(true);
        return;
      }
      formData.append("file", file);
      // Append pages only if available for operations other than merge
      if (selectedPages.length > 0) {
        formData.append("pages", selectedPages.join(','));
      }
    }

    const response = await fetch("http://127.0.0.1:5000/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.text();
    setMessage(result);
    setOpen(true);
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)' }}>
      {/* AppBar Header */}
      <AppBar position="static" sx={{ backgroundColor: '#ff6f61', boxShadow: 3 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            QuickPDF
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', px: 2 }}>
          <Paper
            elevation={6}
            sx={{
              width: '100%',
              maxWidth: 600,
              p: 4,
              borderRadius: 3,
              backgroundColor: '#ffffffdd',
            }}
          >
            <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
              PDF Operations
            </Typography>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {/* Operation selection */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel id="operation-label">Select Operation</InputLabel>
                    <Select
                      labelId="operation-label"
                      value={operation}
                      onChange={handleOperationChange}
                      label="Select Operation"
                      sx={{ py: 1.5 }}
                    >
                      <MenuItem value="swap">Swap Pages</MenuItem>
                      <MenuItem value="merge">Merge PDFs</MenuItem>
                      <MenuItem value="keep">Keep Pages</MenuItem>
                      <MenuItem value="remove">Remove Pages</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Conditional file input */}
                {operation === "merge" ? (
                  <>
                    <Grid item xs={12}>
                      <input
                        name="file" // Added name attribute
                        type="file"
                        accept="application/pdf"
                        onChange={handleMergeFileChange}
                        style={{ display: 'none' }}
                        id="merge-file-upload"
                        multiple
                      />
                      <label htmlFor="merge-file-upload">
                        <Button
                          variant="contained"
                          component="span"
                          fullWidth
                          sx={{
                            py: 1.5,
                            fontWeight: 'bold',
                            textTransform: 'none',
                            backgroundColor: '#ff6f61',
                            ':hover': { backgroundColor: '#e85a4f' },
                          }}
                        >
                          Upload PDF(s)
                        </Button>
                      </label>
                    </Grid>
                    {mergeFiles.length > 0 && (
                      <Grid item xs={12}>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {mergeFiles.map((file, index) => (
                            <Chip
                              key={index}
                              label={file.name}
                              onDelete={() => removeMergeFile(file)}
                              deleteIcon={<DeleteIcon />}
                              sx={{ m: 0.5 }}
                            />
                          ))}
                        </Stack>
                      </Grid>
                    )}
                  </>
                ) : (
                  <>
                    <Grid item xs={12}>
                      <input
                        name="file" // Added name attribute
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        id="file-upload"
                      />
                      <label htmlFor="file-upload">
                        <Button
                          variant="contained"
                          component="span"
                          fullWidth
                          sx={{
                            py: 1.5,
                            fontWeight: 'bold',
                            textTransform: 'none',
                            backgroundColor: '#ff6f61',
                            ':hover': { backgroundColor: '#e85a4f' },
                          }}
                        >
                          Upload PDF
                        </Button>
                      </label>
                    </Grid>
                    {(operation === "swap" || operation === "keep" || operation === "remove") && (
                      <>
                        <Grid item xs={12}>
                          <Typography variant="subtitle1">Select Pages</Typography>
                          <Grid container spacing={1} alignItems="center">
                            <Grid item xs={8}>
                              <TextField
                                fullWidth
                                label="Enter page number"
                                value={pageInput}
                                onChange={handlePageInputChange}
                                variant="outlined"
                              />
                            </Grid>
                            <Grid item xs={4}>
                              <Button
                                variant="contained"
                                fullWidth
                                onClick={addPage}
                                sx={{
                                  py: 1.5,
                                  fontWeight: 'bold',
                                  textTransform: 'none',
                                  backgroundColor: '#ff6f61',
                                  ':hover': { backgroundColor: '#e85a4f' },
                                }}
                              >
                                Add Page
                              </Button>
                            </Grid>
                          </Grid>
                        </Grid>
                        {selectedPages.length > 0 && (
                          <Grid item xs={12}>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {selectedPages.map((page, index) => (
                                <Chip
                                  key={index}
                                  label={page}
                                  onDelete={() => removePage(page)}
                                  deleteIcon={<DeleteIcon />}
                                  sx={{ m: 0.5 }}
                                />
                              ))}
                            </Stack>
                          </Grid>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Submit button */}
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    type="submit"
                    fullWidth
                    sx={{
                      py: 1.5,
                      fontWeight: 'bold',
                      textTransform: 'none',
                      backgroundColor: '#ff6f61',
                      ':hover': { backgroundColor: '#e85a4f' },
                    }}
                  >
                    Submit
                  </Button>
                </Grid>
              </Grid>
            </form>
            <Snackbar open={open} autoHideDuration={6000} onClose={handleClose}>
              <Alert onClose={handleClose} severity="success">
                {message}
              </Alert>
            </Snackbar>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default PdfOperations;
