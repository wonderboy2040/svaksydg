import React from 'react';

function Loading({ fullScreen = false, message = 'Loading...' }) {
  const containerStyle = fullScreen ? {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #1a0a00 0%, #2D1810 100%)'
  } : {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px'
  };

  return (
    <div style={containerStyle}>
      <div style={{
        fontSize: '48px',
        marginBottom: '16px',
        animation: 'pulse 1.5s ease-in-out infinite'
      }}>ॐ</div>
      <div style={{
        color: '#D4A017',
        fontSize: '18px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '600'
      }}>{message}</div>
      <div style={{
        color: '#888',
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif',
        marginTop: '8px'
      }}>Please wait...</div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}

export default Loading;