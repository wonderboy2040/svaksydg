import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const DataContext = createContext(null);

const defaultSettings = {
  appName: 'Soma Vamshi Aarya Kshthriya Samaj',
  location: 'Yadgir',
  monthlyFee: 100,
  pin: '',
  sheetUrl: '',
  adminPhone: '',
  adminEmail: ''
};

const defaultNotifications = [
  { id: 1, title: 'Upcoming Event', text: 'Ashadhi Purnima special puja on 15th June', date: '15 June 2026', active: true },
  { id: 2, title: 'Membership', text: 'New members registration ongoing', date: '10 June 2026', active: true },
  { id: 3, title: 'Meeting', text: 'Next general meeting on 25th June', date: '05 June 2026', active: true }
];

const defaultCommittee = [
  { id: 1, position: 'President', name: '', photo: '', phone: '', address: '' },
  { id: 2, position: 'Vice President', name: '', photo: '', phone: '', address: '' },
  { id: 3, position: 'Secretary', name: '', photo: '', phone: '', address: '' },
  { id: 4, position: 'Treasurer', name: '', photo: '', phone: '', address: '' },
  { id: 5, position: 'Advisory Member', name: '', photo: '', phone: '', address: '' },
  { id: 6, position: 'Advisory Member', name: '', photo: '', phone: '', address: '' },
  { id: 7, position: 'Senior Member', name: '', photo: '', phone: '', address: '' }
];

const STORAGE_KEY = 'svaks_data';

const validateAndSanitizeMember = (member) => ({
  id: Number(member.id) || Date.now(),
  name: String(member.name || '').trim().substring(0, 100),
  father: String(member.father || '').trim().substring(0, 100),
  phone: String(member.phone || '').trim().substring(0, 20),
  address: String(member.address || '').trim().substring(0, 200),
  occupation: String(member.occupation || '').trim().substring(0, 100),
  monthlyFee: Number(member.monthlyFee) || 100,
  other: String(member.other || '').trim().substring(0, 500),
  joinedDate: member.joinedDate || new Date().toISOString().split('T')[0]
});

const validateAndSanitizeCollection = (collection) => ({
  id: Number(collection.id) || Date.now(),
  memberId: Number(collection.memberId) || null,
  memberName: String(collection.memberName || '').trim().substring(0, 100),
  amount: Math.abs(Number(collection.amount)) || 0,
  source: String(collection.source || 'Other').trim().substring(0, 50),
  note: String(collection.note || '').trim().substring(0, 200),
  date: collection.date || new Date().toISOString().split('T')[0]
});

const validateAndSanitizeExpenditure = (expenditure) => ({
  id: Number(expenditure.id) || Date.now(),
  category: String(expenditure.category || 'Other').trim().substring(0, 50),
  amount: Math.abs(Number(expenditure.amount)) || 0,
  description: String(expenditure.description || '').trim().substring(0, 200),
  date: expenditure.date || new Date().toISOString().split('T')[0]
});

const validateAndSanitizeNotification = (notification) => ({
  id: Number(notification.id) || Date.now(),
  title: String(notification.title || '').trim().substring(0, 100),
  text: String(notification.text || '').trim().substring(0, 500),
  date: notification.date || new Date().toLocaleDateString('en-IN'),
  active: Boolean(notification.active)
});

const validateAndSanitizeCommittee = (committee) => ({
  id: Number(committee.id) || Date.now(),
  position: String(committee.position || '').trim().substring(0, 50),
  name: String(committee.name || '').trim().substring(0, 100),
  photo: String(committee.photo || '').trim().substring(0, 500),
  phone: String(committee.phone || '').trim().substring(0, 20),
  address: String(committee.address || '').trim().substring(0, 200)
});

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const settings = { ...defaultSettings, ...(parsed.settings || {}) };
      return {
        members: parsed.members || [],
        collections: parsed.collections || [],
        expenditure: parsed.expenditure || [],
        committee: parsed.committee || defaultCommittee.map(c => ({ ...c })),
        notifications: parsed.notifications || defaultNotifications.map(n => ({ ...n })),
        settings: settings
      };
    }
  } catch (e) {
    console.error('[SVAKS] localStorage load error:', e);
  }
  return {
    members: [],
    collections: [],
    expenditure: [],
    committee: defaultCommittee.map(c => ({ ...c })),
    notifications: defaultNotifications.map(n => ({ ...n })),
    settings: { ...defaultSettings }
  };
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[SVAKS] localStorage save error:', e);
  }
}

export function DataProvider({ children }) {
  const [data, setData] = useState(loadFromStorage);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | loading | syncing | synced | error
  const [syncError, setSyncError] = useState('');
  const [syncLastTime, setSyncLastTime] = useState(null);
  const [sheetsLoaded, setSheetsLoaded] = useState(false);
  const syncTimeoutRef = useRef(null);
  const hasAutoSyncedRef = useRef(false);

  // ========== STEP 1: AUTO-LOAD FROM GOOGLE SHEETS ON START ==========
  useEffect(() => {
    if (sheetsLoaded) return;
    const sheetUrl = data.settings?.sheetUrl;
    if (!sheetUrl) {
      setSyncStatus('idle');
      setSheetsLoaded(true);
      return;
    }

    let cancelled = false;
    setSyncStatus('loading');

    (async () => {
      try {
        const loadUrl = sheetUrl.includes('/load') ? sheetUrl : sheetUrl.replace(/\/exec.*/, '/exec') + '/load';
        console.log('[SVAKS] Loading from Sheets:', loadUrl);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(loadUrl, { signal: controller.signal });
        clearTimeout(timer);

        if (cancelled) return;

        if (!response.ok) {
          console.warn('[SVAKS] Sheets returned', response.status, '- using localStorage');
          if (!cancelled) { setSheetsLoaded(true); setSyncStatus('idle'); }
          return;
        }

        const sheetData = await response.json();
        if (cancelled) return;

        // Check if there's actually data in Sheets
        const hasData = (sheetData.members && sheetData.members.length > 0) ||
          (sheetData.committee && sheetData.committee.some(c => c.name));

        if (hasData) {
          console.log('[SVAKS] ✅ Loaded', sheetData.members?.length || 0, 'members from Sheets');
          setData({
            members: sheetData.members || [],
            collections: sheetData.collections || [],
            expenditure: sheetData.expenditure || [],
            committee: sheetData.committee || defaultCommittee.map(c => ({ ...c })),
            notifications: sheetData.notifications || defaultNotifications.map(n => ({ ...n })),
            settings: { ...defaultSettings, ...(sheetData.settings || {}), sheetUrl }
          });
          setSyncStatus('synced');
        } else {
          console.log('[SVAKS] Sheets empty, using localStorage data');
          setSyncStatus('idle');
        }
      } catch (e) {
        if (cancelled) return;
        console.warn('[SVAKS] Sheets load failed:', e.message, '- using localStorage');
        setSyncStatus('idle');
      }
      if (!cancelled) setSheetsLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [data.settings?.sheetUrl, sheetsLoaded]);

  // ========== STEP 2: ALWAYS SAVE TO LOCALSTORAGE (instant cache) ==========
  useEffect(() => {
    const timer = setTimeout(() => saveToStorage(data), 200);
    return () => clearTimeout(timer);
  }, [data]);

  // ========== STEP 3: AUTO-SYNC TO SHEETS (debounced 3s) ==========
  useEffect(() => {
    const sheetUrl = data.settings?.sheetUrl;
    if (!sheetUrl) { hasAutoSyncedRef.current = false; return; }

    // Skip very first render to avoid sending default empty data over cloud data
    if (!hasAutoSyncedRef.current) {
      // Check if data has meaningful content before auto-syncing
      const hasContent = data.members.length > 0 ||
        data.committee.some(c => c.name) ||
        data.collections.length > 0;
      if (!hasContent) {
        hasAutoSyncedRef.current = true;
        return;
      }
      hasAutoSyncedRef.current = true;
    }

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    setSyncStatus('syncing');
    setSyncError('');

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('[SVAKS] Auto-syncing to Sheets...');
        await fetch(sheetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(data)
        });
        console.log('[SVAKS] ✅ Auto-synced');
        setSyncStatus('synced');
        setSyncError('');
        setSyncLastTime(new Date());
      } catch (e) {
        console.error('[SVAKS] ❌ Auto-sync error:', e.message);
        setSyncStatus('error');
        setSyncError(e.message);
      }
    }, 3000);

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [data]); // Re-runs every time data changes

  // ===== MANUAL: FORCE PUSH to Sheets =====
  const syncToGoogleSheet = useCallback(async () => {
    const sheetUrl = data.settings?.sheetUrl;
    if (!sheetUrl) {
      alert('⚠️ Google Sheets URL nahi mila!\n\nSettings mein jaake Google Apps Script Web App URL paste karo.');
      return;
    }
    setSyncStatus('syncing');
    setSyncError('');
    try {
      console.log('[SVAKS] Manual sync to:', sheetUrl);
      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });
      setSyncStatus('synced');
      setSyncLastTime(new Date());
      alert('✅ Data Google Sheets pe bhej diya gaya!\n\nSheets open karke check karo.');
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e.message);
      alert('❌ Sync error: ' + e.message);
    }
  }, [data]);

  // ===== MANUAL: FORCE PULL from Sheets =====
  const loadFromGoogleSheet = useCallback(async () => {
    const sheetUrl = data.settings?.sheetUrl;
    if (!sheetUrl) {
      alert('⚠️ Google Sheets URL nahi mila!');
      return;
    }
    if (!confirm('Google Sheets se data load karna hai?\n\nYe local data ko Sheets ke data se replace kar dega.')) return;

    setSyncStatus('loading');
    try {
      const loadUrl = sheetUrl.includes('/load') ? sheetUrl : sheetUrl.replace(/\/exec.*/, '/exec') + '/load';
      const response = await fetch(loadUrl);
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const sheetData = await response.json();
      setData({
        members: sheetData.members || [],
        collections: sheetData.collections || [],
        expenditure: sheetData.expenditure || [],
        committee: sheetData.committee || defaultCommittee.map(c => ({ ...c })),
        notifications: sheetData.notifications || defaultNotifications.map(n => ({ ...n })),
        settings: { ...defaultSettings, ...(sheetData.settings || {}), sheetUrl }
      });
      setSyncStatus('synced');
      setSyncLastTime(new Date());
      alert('✅ Google Sheets se data load ho gaya!');
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e.message);
      alert('❌ Load error: ' + e.message);
    }
  }, [data.settings]);

  // ===== CRUD HELPERS =====
  const update = useCallback((key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateSetting = useCallback((key, value) => {
    setData(prev => ({
      ...prev,
      settings: { ...prev.settings, [key]: value }
    }));
  }, []);

  const updateCommittee = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      committee: prev.committee.map(c => c.id === id ? { ...c, ...validateAndSanitizeCommittee({ ...c, ...fields }) } : c)
    }));
  }, []);

  const addMember = useCallback((member) => {
    setData(prev => {
      const s = validateAndSanitizeMember({ ...member, monthlyFee: member.monthlyFee || prev.settings.monthlyFee });
      return { ...prev, members: [...prev.members, s] };
    });
  }, []);

  const updateMember = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === id ? { ...m, ...validateAndSanitizeMember({ ...m, ...fields }) } : m)
    }));
  }, []);

  const deleteMember = useCallback((id) => {
    setData(prev => ({ ...prev, members: prev.members.filter(m => m.id !== id) }));
  }, []);

  const addCollection = useCallback((collection) => {
    setData(prev => {
      const s = validateAndSanitizeCollection(collection);
      return { ...prev, collections: [...prev.collections, s] };
    });
  }, []);

  const updateCollection = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      collections: prev.collections.map(c => c.id === id ? { ...c, ...validateAndSanitizeCollection({ ...c, ...fields }) } : c)
    }));
  }, []);

  const deleteCollection = useCallback((id) => {
    setData(prev => ({ ...prev, collections: prev.collections.filter(c => c.id !== id) }));
  }, []);

  const addExpenditure = useCallback((expenditure) => {
    setData(prev => {
      const s = validateAndSanitizeExpenditure(expenditure);
      return { ...prev, expenditure: [...prev.expenditure, s] };
    });
  }, []);

  const updateExpenditure = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      expenditure: prev.expenditure.map(e => e.id === id ? { ...e, ...validateAndSanitizeExpenditure({ ...e, ...fields }) } : e)
    }));
  }, []);

  const deleteExpenditure = useCallback((id) => {
    setData(prev => ({ ...prev, expenditure: prev.expenditure.filter(e => e.id !== id) }));
  }, []);

  const addNotification = useCallback((notification) => {
    setData(prev => {
      const s = validateAndSanitizeNotification(notification);
      return { ...prev, notifications: [s, ...prev.notifications] };
    });
  }, []);

  const updateNotification = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => n.id === id ? { ...n, ...validateAndSanitizeNotification({ ...n, ...fields }) } : n)
    }));
  }, []);

  const deleteNotification = useCallback((id) => {
    setData(prev => ({ ...prev, notifications: prev.notifications.filter(n => n.id !== id) }));
  }, []);

  // ===== BACKUP / RESTORE =====
  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svaks_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const importJSON = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imp = JSON.parse(e.target.result);
        setData({
          members: imp.members || [],
          collections: imp.collections || [],
          expenditure: imp.expenditure || [],
          committee: imp.committee || defaultCommittee.map(c => ({ ...c })),
          notifications: imp.notifications || defaultNotifications.map(n => ({ ...n })),
          settings: { ...defaultSettings, ...(imp.settings || {}) }
        });
        alert('Data import successful!');
      } catch { alert('Invalid JSON file!'); }
    };
    reader.readAsText(file);
  }, []);

  const value = {
    data, setData, update,
    members: data.members, addMember, updateMember, deleteMember,
    collections: data.collections, addCollection, updateCollection, deleteCollection,
    expenditure: data.expenditure, addExpenditure, updateExpenditure, deleteExpenditure,
    committee: data.committee, updateCommittee,
    notifications: data.notifications, addNotification, updateNotification, deleteNotification,
    settings: data.settings, updateSetting,
    syncStatus, syncError, syncLastTime,
    syncToGoogleSheet, loadFromGoogleSheet,
    exportJSON, importJSON
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

export default DataContext;
