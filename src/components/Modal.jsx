import React, { useEffect, useRef } from 'react';

function Modal({ isOpen, onClose, title, children }) {
  const titleId = 'modal-title';
  const closeBtnRef = useRef(null);

  // ESC key handler + focus trap setup
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Lock body scroll while modal is open
    document.body.style.overflow = 'hidden';

    // Focus the close button on open
    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 100);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      clearTimeout(focusTimer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(26, 10, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        animation: 'fadeIn 0.25s ease forwards'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          backgroundColor: 'var(--clay-surface)',
          color: 'var(--text)',
          borderRadius: '32px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--clay-shadow-xl)',
          border: '1px solid var(--border-soft)',
          animation: 'scaleIn 0.3s var(--ease-clay) forwards'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 22px',
          background: 'linear-gradient(135deg, var(--maroon), var(--deep-maroon))',
          borderRadius: '30px 30px 0 0',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          <h3 id={titleId} style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '18px',
            fontWeight: 700,
            color: 'white',
            margin: 0
          }}>{title}</h3>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255, 248, 238, 0.18)',
              cursor: 'pointer',
              fontSize: '20px',
              fontWeight: 700,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s, transform 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 248, 238, 0.3)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 248, 238, 0.18)'; e.currentTarget.style.transform = 'rotate(0)'; }}
          >×</button>
        </div>
        <div style={{ padding: '22px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
