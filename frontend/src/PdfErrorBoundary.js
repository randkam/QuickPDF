import React from 'react';

export default class PdfErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    // ErrorBoundaries do not reset automatically. Allow callers to reset the
    // boundary when the underlying PDF changes (e.g. different file/url).
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ hasError: false });
    }
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

