import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="status-container missing-profile-card" style={{ maxWidth: '600px', margin: '40px auto' }}>
          <h3>Something went wrong</h3>
          <p style={{ color: '#ef4444', wordBreak: 'break-word' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={this.handleReset}
            >
              Try again
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
