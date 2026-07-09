import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_PIN } from '../config';
import { useLang } from '../i18n';
import { useTheme } from '../utils/useTheme';

function AdminLogin() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumpad(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePinSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleNumpad = (digit) => {
    if (pin.length < 4) setPin(prev => prev + digit);
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handlePinSubmit = () => {
    if (pin.length < 4) return;

    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('svaks_admin', 'true');
      navigate('/admin');
    } else {
      setError('Incorrect Admin PIN');
      setPin('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1a0a00 0%, #2D1810 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(212, 160, 23, 0.18)',
          border: '1px solid rgba(212, 160, 23, 0.4)',
          color: '#D4A017',
          padding: '8px 14px',
          borderRadius: '999px',
          cursor: 'pointer',
          fontSize: '16px',
          backdropFilter: 'blur(10px)'
        }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div style={{
        background: 'var(--clay-surface)',
        color: 'var(--text)',
        borderRadius: '32px',
        padding: '40px 30px',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: 'var(--clay-shadow-xl)',
        border: '1px solid var(--border-soft)',
        animation: 'scaleIn 0.4s var(--ease-clay) forwards'
      }}>
        <span style={{
          fontSize: '52px',
          display: 'block',
          marginBottom: '12px',
          color: 'var(--gold)',
          fontFamily: "'Tiro Devanagari Hindi', serif",
          textShadow: '0 4px 16px rgba(212, 160, 23, 0.4)'
        }}>ॐ</span>

        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          color: 'var(--maroon)',
          fontSize: '24px',
          marginBottom: '6px',
          fontWeight: 800
        }}>
          Enter Admin PIN
        </h2>

        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '26px' }}>
          Enter PIN to access admin panel
        </p>

        {error && (
          <p style={{
            color: 'var(--danger)',
            fontSize: '13px',
            marginBottom: '20px',
            background: 'rgba(225,112,85,0.12)',
            padding: '10px 14px',
            borderRadius: '12px',
            fontWeight: 600,
            boxShadow: 'var(--clay-inset-sm)'
          }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '30px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: '56px',
              height: '64px',
              borderRadius: '16px',
              border: 'none',
              background: pin.length > i ? 'linear-gradient(135deg, rgba(212,160,23,0.25), rgba(212,160,23,0.12))' : 'var(--clay-inset)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.25s var(--ease-clay)',
              transform: pin.length > i ? 'scale(1.06)' : 'scale(1)',
              boxShadow: pin.length > i
                ? 'inset 2px 2px 6px rgba(128, 0, 0, 0.15), inset -2px -2px 6px rgba(255, 248, 238, 0.7), 0 0 0 2px var(--gold)'
                : 'var(--clay-inset-sm)'
            }}>
              {pin.length > i && (
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--maroon)', boxShadow: '0 2px 6px rgba(128,0,0,0.4)' }} />
              )}
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--text-soft)', fontSize: '12px', marginBottom: '16px' }}>Use keyboard or keypad below</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          maxWidth: '260px',
          margin: '0 auto 24px'
        }}>
          {[1,2,3,4,5,6,7,8,9,'',0,'DEL'].map((btn, i) => (
            <button
              key={i}
              disabled={btn === ''}
              onClick={() => {
                if (btn === 'DEL') handleBackspace();
                else handleNumpad(btn.toString());
              }}
              style={{
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: btn === '' ? 'transparent' : 'var(--clay-surface)',
                fontSize: btn === 'DEL' ? '13px' : '20px',
                fontWeight: 700,
                cursor: btn === '' ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                color: btn === 'DEL' ? 'var(--danger)' : 'var(--maroon)',
                boxShadow: btn !== ''
                  ? '3px 3px 8px rgba(74,47,24,0.18), -2px -2px 6px rgba(255,248,238,0.85), inset 1px 1px 1px rgba(255,255,255,0.4)'
                  : 'none',
                visibility: btn === '' ? 'hidden' : 'visible',
                transition: 'all 0.2s var(--ease-clay)'
              }}
              onMouseDown={e => { if (btn !== '') { e.currentTarget.style.boxShadow = 'inset 3px 3px 6px rgba(74,47,24,0.25), inset -2px -2px 4px rgba(255,248,238,0.5)'; e.currentTarget.style.transform = 'translateY(1px)'; } }}
              onMouseUp={e => { if (btn !== '') { e.currentTarget.style.boxShadow = '3px 3px 8px rgba(74,47,24,0.18), -2px -2px 6px rgba(255,248,238,0.85), inset 1px 1px 1px rgba(255,255,255,0.4)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
              onMouseLeave={e => { if (btn !== '') { e.currentTarget.style.boxShadow = '3px 3px 8px rgba(74,47,24,0.18), -2px -2px 6px rgba(255,248,238,0.85), inset 1px 1px 1px rgba(255,255,255,0.4)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              {btn === 'DEL' ? '⌫' : btn}
            </button>
          ))}
        </div>

        <button
          onClick={handlePinSubmit}
          disabled={pin.length < 4}
          style={{
            width: '100%',
            padding: '15px',
            background: pin.length === 4 ? 'linear-gradient(135deg, var(--saffron), var(--gold))' : 'var(--clay-inset)',
            color: pin.length === 4 ? 'white' : 'var(--text-soft)',
            border: 'none',
            borderRadius: '16px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: pin.length === 4 ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, sans-serif',
            boxShadow: pin.length === 4
              ? '4px 4px 12px rgba(232, 130, 12, 0.4), -2px -2px 8px rgba(255,248,238,0.6), inset 1px 1px 2px rgba(255,255,255,0.4)'
              : 'var(--clay-inset-sm)',
            transition: 'all 0.3s var(--ease-clay)'
          }}
        >
          Login
        </button>

        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '14px',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600
          }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}

export default AdminLogin;
