import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';
import SetupWizard from './pages/SetupWizard';
import { DEFAULT_CLOUD_URL } from './config';

const SETUP_KEY = 'svaks_setup_complete';
const STORAGE_KEY = 'svaks_data';

const defaultSettings = {
  appName: 'Soma Vamshi Aarya Kshthriya Samaj',
  location: 'Yadgir',
  monthlyFee: 100,
  pin: '',
  sheetUrl: '',
  adminPhone: '',
  adminEmail: ''
};

const defaultCommittee = [
  { id: 1, position: 'President', name: '', photo: '', phone: '', address: '' },
  { id: 2, position: 'Vice President', name: '', photo: '', phone: '', address: '' },
  { id: 3, position: 'Secretary', name: '', photo: '', phone: '', address: '' },
  { id: 4, position: 'Treasurer', name: '', photo: '', phone: '', address: '' },
  { id: 5, position: 'Advisory Member', name: '', photo: '', phone: '', address: '' },
  { id: 6, position: 'Advisory Member', name: '', photo: '', phone: '', address: '' },
  { id: 7, position: 'Senior Member', name: '', photo: '', phone: '', address: '' }
];

const defaultNotifications = [
  { id: 1, title: 'Upcoming Event', text: 'Ashadhi Purnima special puja on 15th June', date: '15 June 2026', active: true },
  { id: 2, title: 'Membership', text: 'New members registration ongoing', date: '10 June 2026', active: true },
  { id: 3, title: 'Meeting', text: 'Next general meeting on 25th June', date: '05 June 2026', active: true }
];

// Check if setup is done via localStorage
function checkLocalSetup() {
  const setupDone = localStorage.getItem(SETUP_KEY);
  if (setupDone === 'true') return true;
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.settings?.pin && parsed.settings?.sheetUrl) {
        localStorage.setItem(SETUP_KEY, 'true');
        return true;
      }
    }
  } catch (e) {
    console.error('[SVAKS] Setup check error:', e);
  }
  return false;
}

// Try to auto-connect to cloud and populate localStorage
async function tryAutoConnect() {
  if (!DEFAULT_CLOUD_URL) return false;
  
  console.log('[SVAKS] Auto-connecting to cloud...');
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const loadUrl = DEFAULT_CLOUD_URL + '?action=load&load=true';
    const response = await fetch(loadUrl, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.warn('[SVAKS] Auto-connect: HTTP error', response.status);
      return false;
    }
    
    const cloud = await response.json();
    
    // Check if cloud has valid configuration (at minimum a PIN)
    const hasValidConfig = cloud.settings?.pin;
    const hasContent = 
      hasValidConfig ||
      (cloud.members?.length > 0) ||
      (cloud.committee?.some(c => c.name)) ||
      (cloud.collections?.length > 0);
    
    if (!hasContent || !hasValidConfig) {
      console.log('[SVAKS] Auto-connect: No valid data in cloud');
      return false;
    }
    
    console.log('[SVAKS] Auto-connect: Valid cloud data found! Populating...');
    
    // Populate localStorage with cloud data
    const localData = {
      _syncVersion: Number(cloud._syncVersion) || 0,
      members: Array.isArray(cloud.members) ? cloud.members : [],
      collections: Array.isArray(cloud.collections) ? cloud.collections : [],
      expenditure: Array.isArray(cloud.expenditure) ? cloud.expenditure : [],
      committee: Array.isArray(cloud.committee) 
        ? cloud.committee.map(c => ({ ...defaultCommittee.find(dc => dc.position === c.position), ...c }))
        : defaultCommittee.map(c => ({ ...c })),
      notifications: Array.isArray(cloud.notifications)
        ? cloud.notifications
        : defaultNotifications.map(n => ({ ...n })),
      settings: {
        ...defaultSettings,
        ...(cloud.settings || {}),
        sheetUrl: DEFAULT_CLOUD_URL
      }
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));
    localStorage.setItem(SETUP_KEY, 'true');
    
    console.log('[SVAKS] Auto-connect: SUCCESS! Data loaded from cloud.');
    return true;
    
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[SVAKS] Auto-connect: Timed out (10s)');
    } else {
      console.warn('[SVAKS] Auto-connect failed:', e.message);
    }
    return false;
  }
}

function App() {
  const [status, setStatus] = useState('initializing'); // 'initializing' | 'ready' | 'needs_setup'

  useEffect(() => {
    const init = async () => {
      // Step 1: Check if already set up locally
      if (checkLocalSetup()) {
        console.log('[SVAKS] Setup already complete (local)');
        setStatus('ready');
        return;
      }
      
      // Step 2: Try auto-connect to cloud
      const connected = await tryAutoConnect();
      if (connected) {
        console.log('[SVAKS] Auto-connected to cloud! Reloading...');
        // Force reload so DataContext picks up the new localStorage data
        window.location.reload();
        return;
      }
      
      // Step 3: No local data AND no cloud data → show wizard
      console.log('[SVAKS] No data found. Showing setup wizard.');
      setStatus('needs_setup');
    };
    
    init();
  }, []);

  // Loading state — show while checking local + cloud
  if (status === 'initializing') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #1a0a00 0%, #2D1810 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px'
      }}>
        <span style={{ fontSize: '48px', animation: 'pulse 1.5s ease-in-out infinite' }}>🙏</span>
        <p style={{ 
          color: 'rgba(212,160,23,0.7)', 
          fontFamily: 'Inter, sans-serif', 
          fontSize: '14px',
          letterSpacing: '2px'
        }}>
          Loading...
        </p>
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
          }
        `}</style>
      </div>
    );
  }

  const needsSetup = status === 'needs_setup';

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
