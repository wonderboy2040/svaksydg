import React from 'react';

function Loading({ fullScreen = false, message = 'Loading...' }) {
  const containerStyle = fullScreen ? {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--clay-bg)',
    color: 'var(--text)'
  } : {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: 'var(--text)'
  };

  return (
    <div style={containerStyle}>
      <div style={{
        fontSize: '48px',
        marginBottom: '16px',
        color: 'var(--gold)',
        animation: 'pulse 1.5s ease-in-out infinite',
        fontFamily: "'Tiro Devanagari Hindi', serif"
      }}>ॐ</div>
      <div style={{
        color: 'var(--maroon)',
        fontSize: '18px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700
      }}>{message}</div>
      <div style={{
        color: 'var(--text-muted)',
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif',
        marginTop: '8px'
      }}>Please wait...</div>
    </div>
  );
}

export default Loading;
