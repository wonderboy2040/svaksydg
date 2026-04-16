import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';
import SetupWizard from './pages/SetupWizard';

const SETUP_KEY = 'svaks_setup_complete';

function checkSetupDone() {
  const setupDone = localStorage.getItem(SETUP_KEY);
  if (setupDone === 'true') return true;
  
  try {
    const data = localStorage.getItem('svaks_data');
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.settings?.pin && parsed.settings?.sheetUrl) {
        localStorage.setItem(SETUP_KEY, 'true');
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function App() {
  const [initializing, setInitializing] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(true);

  useEffect(() => {
    const done = checkSetupDone();
    setNeedsSetup(!done);
    setInitializing(false);
  }, []);

  if (initializing) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #1a0a00 0%, #2D1810 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ fontSize: '48px' }}>🙏</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={needsSetup ? <Navigate to="/setup" replace /> : <Home />} />
      <Route path="/setup" element={needsSetup ? <SetupWizard /> : <Navigate to="/" replace />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

export default App;
