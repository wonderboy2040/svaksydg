import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'svaks_data';
const SETUP_FLAG = 'svaks_setup_complete';

function SetupWizard() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  
  const [formData, setFormData] = useState({
    sheetUrl: '',
    pin: '',
    confirmPin: ''
  });

  // Check if already configured via svaks_data
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.settings?.pin && parsed.settings?.sheetUrl) {
          localStorage.setItem(SETUP_FLAG, 'true');
          setTimeout(() => navigate('/'), 100);
        }
      }
    } catch (e) {}
  }, [navigate]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateSheetUrl = (url) => {
    if (!url) return { valid: false, error: 'URL required' };
    
    const isAppsScript = url.includes('script.google.com/macros');
    const isSheets = url.includes('docs.google.com/spreadsheets');
    
    if (!isAppsScript && !isSheets) {
      return { valid: false, error: 'Enter Google Sheet OR AppsScript WebApp URL' };
    }
    return { valid: true };
  };

  const normalizeUrl = (url) => {
    let normalized = url.trim();
    // Remove trailing /load if present
    if (normalized.endsWith('/load')) {
      normalized = normalized.slice(0, -5);
    }
    // Ensure it ends with /exec for Apps Script URLs
    if (normalized.includes('script.google.com/macros') && !normalized.endsWith('/exec')) {
      normalized = normalized.replace(/\/exec.*/, '/exec');
    }
    return normalized;
  };

  const testConnection = async (url) => {
    let testUrl = normalizeUrl(url);
    
    // Add /load for GET request test
    if (testUrl.includes('script.google.com/macros')) {
      testUrl = testUrl + '?action=load&load=true';
    }
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(testUrl, { 
        signal: controller.signal,
        method: 'GET'
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        try {
          const data = await response.json();
          return { success: true, hasData: !!(data.members || data.settings || data.committee) };
        } catch {
          return { success: true, hasData: false };
        }
      }
      return { success: true, hasData: false };
    } catch (e) {
      if (e.name === 'AbortError') {
        return { success: false, error: 'Connection timed out (10s)' };
      }
      return { success: false, error: e.message };
    }
  };

  // Save settings directly into svaks_data (the main storage used by DataContext)
  const saveToMainStorage = (sheetUrl, pin) => {
    let existing = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) existing = JSON.parse(raw);
    } catch (e) {}

    const updated = {
      ...existing,
      _syncVersion: existing._syncVersion || 0,
      members: existing.members || [],
      collections: existing.collections || [],
      expenditure: existing.expenditure || [],
      committee: existing.committee || [
        { id: 1, position: 'President', name: '', photo: '', phone: '', address: '' },
        { id: 2, position: 'Vice President', name: '', photo: '', phone: '', address: '' },
        { id: 3, position: 'Secretary', name: '', photo: '', phone: '', address: '' },
        { id: 4, position: 'Treasurer', name: '', photo: '', phone: '', address: '' },
        { id: 5, position: 'Advisory Member', name: '', photo: '', phone: '', address: '' },
        { id: 6, position: 'Advisory Member', name: '', photo: '', phone: '', address: '' },
        { id: 7, position: 'Senior Member', name: '', photo: '', phone: '', address: '' }
      ],
      notifications: existing.notifications || [
        { id: 1, title: 'Upcoming Event', text: 'Ashadhi Purnima special puja on 15th June', date: '15 June 2026', active: true },
        { id: 2, title: 'Membership', text: 'New members registration ongoing', date: '10 June 2026', active: true },
        { id: 3, title: 'Meeting', text: 'Next general meeting on 25th June', date: '05 June 2026', active: true }
      ],
      settings: {
        appName: 'Soma Vamshi Aarya Kshthriya Samaj',
        location: 'Yadgir',
        monthlyFee: 100,
        adminPhone: '',
        adminEmail: '',
        ...(existing.settings || {}),
        sheetUrl: normalizeUrl(sheetUrl),
        pin: pin
      }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  };

  const handleNext = async () => {
    setError('');
    
    if (step === 1) {
      if (!formData.sheetUrl.trim()) {
        setError('URL required');
        return;
      }
      
      const validation = validateSheetUrl(formData.sheetUrl);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }

      // Test connection
      setTesting(true);
      setTestResult(null);
      const result = await testConnection(formData.sheetUrl);
      setTesting(false);

      if (result.success) {
        setTestResult({ success: true });
        setStep(2);
      } else {
        setTestResult({ success: false, error: result.error });
        setError('Connection failed: ' + (result.error || 'Unknown error'));
      }
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
      
      // Save to main data storage (svaks_data)
      saveToMainStorage(formData.sheetUrl, formData.pin);
      
      // Mark setup complete
      localStorage.setItem(SETUP_FLAG, 'true');
      
      // Force page reload so DataContext picks up new data from localStorage
      window.location.href = '/';
    }
  };

  const handleBack = () => {
    setError('');
    setTestResult(null);
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const skipSetup = () => {
    localStorage.setItem(SETUP_FLAG, 'true');
    window.location.href = '/';
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
        
        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: s === step ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: s <= step ? 'linear-gradient(135deg, #FF9933, #E8820C)' : '#e0d5c8',
              transition: 'all 0.3s ease'
            }}></div>
          ))}
        </div>

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
            <>
              <input
                type="url"
                value={formData.sheetUrl}
                onChange={(e) => handleChange('sheetUrl', e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
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
              {testing && (
                <div style={{ marginTop: '10px', color: '#E8820C', fontSize: '13px' }}>
                  ⏳ Testing connection...
                </div>
              )}
              {testResult && testResult.success && (
                <div style={{ marginTop: '10px', color: '#00B894', fontSize: '13px', background: 'rgba(0,184,148,0.08)', padding: '8px', borderRadius: '8px' }}>
                  ✅ Connection successful!
                </div>
              )}
            </>
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
            disabled={testing}
            style={{
              flex: 1,
              padding: '14px',
              background: testing ? '#ccc' : 'linear-gradient(135deg, #FF9933, #E8820C)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: testing ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              boxShadow: testing ? 'none' : '0 4px 15px rgba(255,153,51,0.3)'
            }}
          >
            {testing ? 'Testing...' : step === 3 ? 'Complete ✓' : 'Next →'}
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