import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[SVAKS] Error Boundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #1a0a00 0%, #2D1810 100%)',
          color: 'white',
          fontFamily: 'Inter, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>ॐ</div>
          <h1 style={{ color: '#D4A017', fontSize: '24px', marginBottom: '10px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#aaa', marginBottom: '20px', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred. Please refresh the page.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #FF9933, #E8820C)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;