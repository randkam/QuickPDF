import React from 'react';

export default class PdfErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep this noisy in dev so we can still diagnose pdf.js issues.
    // The boundary exists to prevent the entire app from crashing on upload.
    console.error('PDF render crashed:', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

