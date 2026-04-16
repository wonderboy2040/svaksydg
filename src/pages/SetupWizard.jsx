import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../DataContext';

const STORAGE_KEY = 'svaks_setup_complete';

function SetupWizard() {
  const navigate = useNavigate();
  const { updateSetting, update, settings } = useData();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    sheetUrl: '',
    pin: '',
    confirmPin: ''
  });

  useEffect(() => {
    if (settings.pin) {
      markSetupComplete();
      navigate('/');
    }
  }, []);

  const markSetupComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateSheetUrl = async (url) => {
    if (!url) return { valid: false, error: 'URL required' };
    if (!url.includes('docs.google.com/spreadsheets')) {
      return { valid: false, error: 'Must be Google Sheets URL' };
    }
    if (!url.includes('/edit') && !url.includes('/exec')) {
      return { valid: false, error: 'Invalid Sheets URL format' };
    }
    return { valid: true };
  };

  const testConnection = async (url) => {
    let testUrl = url;
    if (url.includes('/edit')) {
      testUrl = url.replace('/edit', '/exec');
    }
    if (url.includes('/load')) {
      testUrl = url;
    } else {
      testUrl = url.replace(/\/exec.*/, '/exec') + '/load';
    }
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(testUrl, { 
        signal: controller.signal,
        method: 'GET'
      });
      
      clearTimeout(timeout);
      return { success: true, url: testUrl };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const handleNext = async () => {
    setError('');
    
    if (step === 1) {
      if (!formData.sheetUrl.trim()) {
        setError('Google Sheet URL required');
        return;
      }
      
      const validation = await validateSheetUrl(formData.sheetUrl);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }

      setLoading(true);
      const result = await testConnection(formData.sheetUrl);
      setLoading(false);
      
      if (!result.success) {
        setError('Could not connect to Sheet. Check URL permissions.');
        return;
      }

      updateSetting('sheetUrl', formData.sheetUrl);
      setStep(2);
    } 
    else if (step === 2) {
      if (!formData.pin || formData.pin.length !== 4) {
        setError('Enter 4-digit PIN');
        return;
      }
      if (!/^\d{4}$/.test(formData.pin)) {
        setError('PIN must be numbers only');
        return;
      }
      setStep(3);
    }
    else if (step === 3) {
      if (formData.confirmPin !== formData.pin) {
        setError('PINs do not match');
        return;
      }
      
      setLoading(true);
      updateSetting('pin', formData.pin);
      markSetupComplete();
      
      setTimeout(() => {
        setLoading(false);
        navigate('/');
      }, 500);
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const skipSetup = () => {
    markSetupComplete();
    navigate('/');
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
        maxWidth: '420px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        border: '2px solid #D4A017'
      }}>
        <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>
          🙏
        </span>
        
        <h2 style={{
          fontFamily: 'Inter, sans-serif',
          color: '#800000',
          fontSize: '22px',
          marginBottom: '6px',
          fontWeight: '700'
        }}>
          {step === 1 ? 'Connect Google Sheet' : step === 2 ? 'Set Admin PIN' : 'Confirm PIN'}
        </h2>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>
          {step === 1 ? 'Enter your Apps Script WebApp URL' : step === 2 ? 'Create a 4-digit PIN for admin' : 'Re-enter PIN to confirm'}
        </p>

        <div style={{ marginBottom: '20px' }}>
          {step === 1 && (
            <input
              type="url"
              value={formData.sheetUrl}
              onChange={(e) => handleChange('sheetUrl', e.target.value)}
              placeholder="https://script.google.com/macros/exec/..."
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '2px solid #e0d5c8',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          )}

          {step === 2 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: '52px',
                  height: '60px',
                  borderRadius: '12px',
                  border: '2px solid #D4A017',
                  background: 'rgba(212,160,23,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#800000'
                }}>
                  {formData.pin[i] || ''}
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: '52px',
                  height: '60px',
                  borderRadius: '12px',
                  border: '2px solid #D4A017',
                  background: 'rgba(212,160,23,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#800000'
                }}>
                  {formData.confirmPin[i] || ''}
                </div>
              ))}
            </div>
          )}

          {(step === 2 || step === 3) && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '8px', 
              maxWidth: '240px', 
              margin: '20px auto 0'
            }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'DEL'].map((btn, i) => (
                <button
                  key={i}
                  disabled={btn === ''}
                  onClick={() => {
                    if (btn === 'DEL') {
                      const field = step === 2 ? 'pin' : 'confirmPin';
                      const current = formData[field];
                      if (current.length > 0) {
                        handleChange(field, current.slice(0, -1));
                      }
                    } else {
                      const field = step === 2 ? 'pin' : 'confirmPin';
                      const current = formData[field];
                      if (current.length < 4) {
                        handleChange(field, current + btn);
                      }
                    }
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
          )}
        </div>

        {error && (
          <p style={{ 
            color: '#E17055', 
            fontSize: '13px', 
            marginBottom: '12px', 
            background: 'rgba(225,112,85,0.1)', 
            padding: '10px 12px', 
            borderRadius: '8px' 
          }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          {step > 1 && (
            <button
              onClick={handleBack}
              style={{
                flex: 1,
                padding: '14px',
                background: 'linear-gradient(135deg, #f5f5f5, #eee)',
                color: '#666',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              ← Back
            </button>
          )}
          
          <button
            onClick={handleNext}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              background: loading 
                ? '#ccc' 
                : 'linear-gradient(135deg, #FF9933, #E8820C)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(255,153,51,0.3)'
            }}
          >
            {loading ? 'Checking...' : step === 3 ? 'Complete ✓' : 'Next →'}
          </button>
        </div>

        <button
          onClick={skipSetup}
          style={{
            marginTop: '16px',
            background: 'none',
            border: 'none',
            color: '#999',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
}

export default SetupWizard;