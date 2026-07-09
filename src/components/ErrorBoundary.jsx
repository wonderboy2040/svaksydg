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
          background: 'var(--clay-bg)',
          color: 'var(--text)',
          fontFamily: 'Inter, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '20px',
            color: 'var(--gold)',
            fontFamily: "'Tiro Devanagari Hindi', serif"
          }}>ॐ</div>
          <h1 style={{
            color: 'var(--maroon)',
            fontSize: '24px',
            marginBottom: '10px',
            fontFamily: "'Playfair Display', serif",
            fontWeight: 800
          }}>
            Something went wrong
          </h1>
          <p style={{
            color: 'var(--text-muted)',
            marginBottom: '20px',
            maxWidth: '400px',
            fontSize: '15px',
            lineHeight: 1.6
          }}>
            {this.state.error?.message || 'An unexpected error occurred. Please refresh the page.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '13px 26px',
              background: 'linear-gradient(135deg, var(--saffron), var(--gold))',
              border: 'none',
              borderRadius: '999px',
              color: 'white',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '4px 4px 12px rgba(232, 130, 12, 0.4), inset 1px 1px 2px rgba(255,255,255,0.4)'
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
