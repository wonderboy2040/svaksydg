import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../DataContext';

function AdminLogin() {
  const { updateSetting, settings } = useData();
  const navigate = useNavigate();
  const isPinSet = settings.pin && settings.pin.length === 4;

  const [pin, setPin] = useState('');
  const [mode, setMode] = useState(isPinSet ? 'login' : 'set');
  const [error, setError] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    const isPinNowSet = settings.pin && settings.pin.length === 4;
    if (!isPinNowSet && mode === 'login') {
      setMode('set');
      setStep(1);
    }
  }, [settings.pin, mode]);

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
  }, [mode, step, newPin, confirmPin, pin]);

  const handleNumpad = (digit) => {
    if (mode === 'set' && step === 1) {
      if (newPin.length < 4) setNewPin(prev => prev + digit);
    } else if (mode === 'set' && step === 2) {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + digit);
    } else if (mode === 'login') {
      if (pin.length < 4) setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (mode === 'set' && step === 1) {
      setNewPin(prev => prev.slice(0, -1));
    } else if (mode === 'set' && step === 2) {
      setConfirmPin(prev => prev.slice(0, -1));
    } else if (mode === 'login') {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const handlePinSubmit = () => {
    if (mode === 'set' && step === 1) {
      if (newPin.length !== 4) {
        setError('PIN must be exactly 4 digits!');
        return;
      }
      if (!/^\d{4}$/.test(newPin)) {
        setError('PIN must contain only numbers!');
        return;
      }
      setStep(2);
      setError('');
    } else if (mode === 'set' && step === 2) {
      if (confirmPin.length !== 4) {
        setError('Please confirm with 4 digits!');
        return;
      }
      if (!/^\d{4}$/.test(confirmPin)) {
        setError('PIN must contain only numbers!');
        return;
      }
      if (newPin !== confirmPin) {
        setError('PINs do not match! Try again.');
        setConfirmPin('');
        setNewPin('');
        setStep(1);
        return;
      }
      updateSetting('pin', newPin);
      setMode('login');
      setStep(1);
      setPin('');
      setNewPin('');
      setConfirmPin('');
      setError('');
      alert('PIN set successfully! Please login.');
    } else if (mode === 'login') {
      if (pin.length !== 4) {
        setError('Enter 4 digit PIN!');
        return;
      }
      if (pin === settings.pin) {
        sessionStorage.setItem('svaks_admin', 'true');
        navigate('/admin');
      } else {
        setError('Wrong PIN! Try again.');
        setPin('');
      }
    }
  };

  const currentPin = mode === 'set' && step === 1 ? newPin : mode === 'set' && step === 2 ? confirmPin : pin;
  const title = mode === 'set' ? (step === 1 ? 'Set Admin PIN' : 'Confirm PIN') : 'Enter Admin PIN';
  const subtitle = mode === 'set' ? (step === 1 ? 'Create a 4-digit PIN' : 'Re-enter PIN to confirm') : 'Enter PIN to access admin';

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
        maxWidth: '360px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        border: '2px solid #D4A017'
      }}>
        <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px', filter: 'drop-shadow(0 0 10px rgba(255,153,51,0.4))' }}>
          ॐ
        </span>
        <h2 style={{
          fontFamily: 'Inter, sans-serif',
          color: '#800000',
          fontSize: '22px',
          marginBottom: '6px',
          fontWeight: '700'
        }}>{title}</h2>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>{subtitle}</p>

        <p style={{ fontSize: '12px', color: '#999', marginBottom: '16px' }}>Use keyboard or keypad below</p>

        {/* PIN Display */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: '48px',
              height: '52px',
              borderRadius: '10px',
              border: currentPin.length > i ? '2px solid #D4A017' : '2px solid #ddd',
              background: currentPin.length > i ? 'rgba(212,160,23,0.08)' : '#fafafa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: '700',
              color: '#800000'
            }}>
              {currentPin.length > i ? (mode === 'login' ? '●' : currentPin[i]) : ''}
            </div>
          ))}
        </div>

        {error && (
          <p style={{ color: '#E17055', fontSize: '13px', marginBottom: '12px', background: 'rgba(225,112,85,0.1)', padding: '8px 12px', borderRadius: '8px' }}>
            {error}
          </p>
        )}

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', maxWidth: '240px', margin: '0 auto' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'DEL'].map((btn, i) => (
            <button
              key={i}
              disabled={btn === ''}
              onClick={() => {
                if (btn === 'DEL') handleBackspace();
                else handleNumpad(btn.toString());
              }}
              style={{
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid #e0d5c8',
                background: 'linear-gradient(135deg, #faf8f5, #fff)',
                fontSize: btn === 'DEL' ? '12px' : '20px',
                fontWeight: '600',
                cursor: btn === '' ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                color: btn === 'DEL' ? '#E17055' : '#800000',
                visibility: btn === '' ? 'hidden' : 'visible'
              }}
            >
              {btn === 'DEL' ? '⌫' : btn}
            </button>
          ))}
        </div>

        {/* Submit Button */}
        <button
          onClick={handlePinSubmit}
          style={{
            marginTop: '20px',
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #FF9933, #E8820C)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 4px 15px rgba(255,153,51,0.3)'
          }}
        >
          {mode === 'set' && step === 1 ? 'Next →' : mode === 'set' && step === 2 ? 'Set PIN' : 'Login'}
        </button>

        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '12px',
            background: 'none',
            border: 'none',
            color: '#999',
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