import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { pdfjs } from 'react-pdf';

// Configure pdf.js worker once at startup.
// Keep this aligned with the copy in `public/pdf.worker.js`.
// (We also have a no-worker fallback inside components for stability.)
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.js`;

// Prevent pdf.js/react-pdf worker crashes from blocking uploads.
// CRA's dev overlay is driven by uncaught errors + unhandled promise rejections.
// We only suppress the known pdf.js failure signatures; everything else still surfaces.
const shouldSuppressPdfJsCrash = (reason) => {
  const msg = reason?.message || String(reason || '');
  return (
    msg.includes('this.messageHandler.sendWithPromise') ||
    msg.includes('messageHandler.sendWithPromise') ||
    msg.includes('Buffer is already detached')
  );
};

window.addEventListener('unhandledrejection', (event) => {
  if (shouldSuppressPdfJsCrash(event.reason)) {
    console.error('Suppressed pdf.js crash (unhandledrejection):', event.reason);
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  if (shouldSuppressPdfJsCrash(event.error || event.message)) {
    console.error('Suppressed pdf.js crash (error):', event.error || event.message);
    event.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);

reportWebVitals();


