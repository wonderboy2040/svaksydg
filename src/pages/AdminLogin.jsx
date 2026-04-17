import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_PIN } from '../config';

function AdminLogin() {
  const navigate = useNavigate();
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
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '40px 30px',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        border: '2px solid #D4A017'
      }}>
        <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>ॐ</span>
        
        <h2 style={{
          fontFamily: 'Inter, sans-serif',
          color: '#800000',
          fontSize: '24px',
          marginBottom: '8px',
          fontWeight: '700'
        }}>
          Enter Admin PIN
        </h2>
        
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
          Enter PIN to access admin
        </p>

        {error && (
          <p style={{ 
            color: '#E17055', 
            fontSize: '13px', 
            marginBottom: '20px', 
            background: 'rgba(225,112,85,0.1)', 
            padding: '10px', 
            borderRadius: '8px' 
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
              border: pin.length > i ? '2px solid #D4A017' : '2px solid #e0d5c8',
              background: pin.length > i ? 'rgba(212,160,23,0.08)' : '#faf8f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              transform: pin.length > i ? 'scale(1.05)' : 'scale(1)'
            }}>
              {pin.length > i && (
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#800000' }} />
              )}
            </div>
          ))}
        </div>

        <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '16px' }}>Use keyboard or keypad below</p>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px', 
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
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e0d5c8',
                background: 'linear-gradient(135deg, #faf8f5, #fff)',
                fontSize: btn === 'DEL' ? '14px' : '20px',
                fontWeight: '600',
                cursor: btn === '' ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                color: btn === 'DEL' ? '#E17055' : '#800000',
                boxShadow: btn !== '' ? '0 2px 5px rgba(0,0,0,0.02)' : 'none',
                visibility: btn === '' ? 'hidden' : 'visible'
              }}
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
            padding: '16px',
            background: pin.length === 4 ? 'linear-gradient(135deg, #FF9933, #E8820C)' : '#eee',
            color: pin.length === 4 ? 'white' : '#aaa',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: pin.length === 4 ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, sans-serif',
            boxShadow: pin.length === 4 ? '0 4px 15px rgba(255,153,51,0.3)' : 'none',
            transition: 'all 0.3s ease'
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
            color: '#888',
            fontSize: '14px',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}

export default AdminLogin;