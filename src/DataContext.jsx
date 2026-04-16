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
const DEVICE_ID_KEY = 'svaks_device_id';
const LAST_HASH_KEY = 'svaks_last_hash';

function getOrCreateDeviceId() {
  let deviceId = sessionStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

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
        settings: settings,
        _fromStorage: true  // Flag to track if data came from localStorage
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
    settings: { ...defaultSettings },
    _fromStorage: true
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
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState('');
  const [syncLastTime, setSyncLastTime] = useState(null);
  const [sheetsLoaded, setSheetsLoaded] = useState(false);
  const [lastSyncHash, setLastSyncHash] = useState(() => sessionStorage.getItem(LAST_HASH_KEY) || '');
  const [localDataHash, setLocalDataHash] = useState('');
  const syncTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const hasAutoSyncedRef = useRef(false);
  const currentDeviceId = useRef(getOrCreateDeviceId());

  // Generate hash of cloud data to detect changes
  const generateDataHash = (sheetData) => {
    const simpleHash = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash;
    };
    
    const relevant = {
      m: sheetData.members?.length || 0,
      c: sheetData.collections?.length || 0,
      e: sheetData.expenditure?.length || 0,
      ct: sheetData.committee?.filter(c => c.name)?.length || 0,
      n: sheetData.notifications?.length || 0,
      ts: sheetData.settings?.lastUpdated || '',
      pin: sheetData.settings?.pin || '',
      mHash: simpleHash(JSON.stringify(sheetData.members?.slice(0, 5) || [])),
      cHash: simpleHash(JSON.stringify(sheetData.collections?.slice(0, 5) || [])),
      ctHash: simpleHash(JSON.stringify(sheetData.committee?.filter(c => c.name) || [])),
      nHash: simpleHash(JSON.stringify(sheetData.notifications?.slice(0, 3) || []))
    };
    return JSON.stringify(relevant);
  };

  const generateQuickHash = (data) => {
    const simpleHash = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash;
    };
    return simpleHash(
      data.members?.length + '|' +
      data.collections?.length + '|' +
      data.expenditure?.length + '|' +
      (data.committee?.filter(c => c.name).length || 0) + '|' +
      (data.notifications?.length || 0) + '|' +
      data.settings?.pin || ''
    );
  };

  // ========== STEP 1: CLOUD-FIRST AUTO-LOAD FROM GOOGLE SHEETS ==========
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
        console.log('[SVAKS] ☁️ Cloud-first load from Sheets:', loadUrl);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(loadUrl, { signal: controller.signal });
        clearTimeout(timer);

        if (cancelled) return;

        if (!response.ok) {
          console.warn('[SVAKS] ❌ Cloud returned', response.status, '- falling back to localStorage');
          if (!cancelled) { setSheetsLoaded(true); setSyncStatus('idle'); }
          return;
        }

        const sheetData = await response.json();
        if (cancelled) return;

        // Check if cloud has ANY meaningful data
        const hasCloudData =
          (sheetData.members && sheetData.members.length > 0) ||
          (sheetData.committee && sheetData.committee.some(c => c && c.name)) ||
          (sheetData.collections && sheetData.collections.length > 0) ||
          (sheetData.settings && sheetData.settings.pin);  // PIN bhi check karo

        if (hasCloudData) {
          console.log('[SVAKS] ✅ Cloud data loaded:',
            (sheetData.members?.length || 0) + ' members,' +
            (sheetData.committee?.filter(c => c.name)?.length || 0) + ' committee');

          const newHash = generateDataHash(sheetData);
          setLastSyncHash(newHash);
          sessionStorage.setItem(LAST_HASH_KEY, newHash);

          // CLOUD DATA IS AUTHORITATIVE - override localStorage completely
          setData({
            members: Array.isArray(sheetData.members) ? sheetData.members : [],
            collections: Array.isArray(sheetData.collections) ? sheetData.collections : [],
            expenditure: Array.isArray(sheetData.expenditure) ? sheetData.expenditure : [],
            committee: Array.isArray(sheetData.committee)
              ? sheetData.committee.map(c => ({ ...defaultCommittee.find(dc => dc.position === c.position), ...c }))
              : defaultCommittee.map(c => ({ ...c })),
            notifications: Array.isArray(sheetData.notifications)
              ? sheetData.notifications
              : defaultNotifications.map(n => ({ ...n })),
            settings: { ...defaultSettings, ...(sheetData.settings || {}), sheetUrl }
          });

          setSyncStatus('synced');
          setSyncLastTime(new Date());
          console.log('[SVAKS] 🔐 PIN synced from cloud:', sheetData.settings?.pin ? 'Yes' : 'No');
        } else {
          console.log('[SVAKS] 📭 Cloud empty, keeping localStorage data');
          setSyncStatus('idle');
        }
      } catch (e) {
        if (cancelled) return;
        console.warn('[SVAKS] ❌ Cloud load FAILED:', e.message, '- using localStorage (data will sync to cloud on change)');
        setSyncStatus('idle');
      }
      if (!cancelled) setSheetsLoaded(true);
    })();

    return () => { cancelled = true; };
  }, []);

  // ========== STEP 2: ALWAYS SAVE TO LOCALSTORAGE (instant cache) ==========
  useEffect(() => {
    const timer = setTimeout(() => saveToStorage(data), 200);
    return () => clearTimeout(timer);
  }, [data]);

  // ========== STEP 3: AUTO-SYNC TO SHEETS (debounced 2s) ==========
  useEffect(() => {
    const sheetUrl = data.settings?.sheetUrl;
    if (!sheetUrl) { hasAutoSyncedRef.current = false; return; }

    // Skip sync only if truly empty (no data, no PIN)
    if (!hasAutoSyncedRef.current) {
      const hasContent = data.members.length > 0 ||
        data.committee.some(c => c.name) ||
        data.collections.length > 0 ||
        data.settings.pin;  // PIN bhi content hai!
      if (!hasContent) {
        hasAutoSyncedRef.current = true;
        return;
      }
      hasAutoSyncedRef.current = true;
    }

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    setSyncStatus('syncing');

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('[SVAKS] 📤 Auto-syncing to cloud...');
        await fetch(sheetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(data)
        });
        console.log('[SVAKS] ✅ Cloud synced!');
        setSyncStatus('synced');
        setSyncError('');
        setSyncLastTime(new Date());
      } catch (e) {
        console.error('[SVAKS] ❌ Auto-sync error:', e.message);
        setSyncStatus('error');
        setSyncError(e.message);
      }
    }, 2000);  // 2 second debounce

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [data]);  // Re-run when ANY data changes (including PIN)

  // ========== STEP 4: AUTO-POLL CLOUD FOR MULTI-DEVICE SYNC (every 30s) ==========
  useEffect(() => {
    const sheetUrl = data.settings?.sheetUrl;
    if (!sheetUrl || !sheetsLoaded) return;

    const currentHashRef = useRef(lastSyncHash);  // Use ref for mutable hash

    const pollCloud = async () => {
      try {
        const loadUrl = sheetUrl.includes('/load') ? sheetUrl : sheetUrl.replace(/\/exec.*/, '/exec') + '/load';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(loadUrl, { signal: controller.signal });
        clearTimeout(timer);

        if (!response.ok) return;

        const sheetData = await response.json();
        const newHash = generateDataHash(sheetData);

        // Only update if cloud data has changed
        if (newHash !== currentHashRef.current) {
          console.log('[SVAKS] 🔄 Cloud data changed! Syncing to local...');
          currentHashRef.current = newHash;
          setLastSyncHash(newHash);
          sessionStorage.setItem(LAST_HASH_KEY, newHash);
          setData(prevData => ({
            members: sheetData.members || [],
            collections: sheetData.collections || [],
            expenditure: sheetData.expenditure || [],
            committee: sheetData.committee || defaultCommittee.map(c => ({ ...c })),
            notifications: sheetData.notifications || defaultNotifications.map(n => ({ ...n })),
            settings: { ...defaultSettings, ...(sheetData.settings || {}), sheetUrl }
          }));
          setSyncStatus('synced');
          setSyncLastTime(new Date());
        } else {
          console.log('[SVAKS] 👁️ Poll: Cloud data unchanged');
        }
      } catch (e) {
        console.warn('[SVAKS] Cloud poll error:', e.message);
      }
    };

    // Poll every 30 seconds
    pollIntervalRef.current = setInterval(pollCloud, 30000);

    // Initial poll after 3 seconds
    const initialPoll = setTimeout(pollCloud, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      clearTimeout(initialPoll);
    };
  }, [data.settings?.sheetUrl, sheetsLoaded]);

  // ========== STEP 5: SYNC ON VISIBILITY CHANGE (tab switch) ==========
  useEffect(() => {
    const sheetUrl = data.settings?.sheetUrl;
    if (!sheetUrl || !sheetsLoaded) return;

    const currentHashRef = useRef(lastSyncHash);

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[SVAKS] 👁️ Tab visible, checking cloud...');
        try {
          const loadUrl = sheetUrl.includes('/load') ? sheetUrl : sheetUrl.replace(/\/exec.*/, '/exec') + '/load';
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(loadUrl, { signal: controller.signal });
          clearTimeout(timer);

          if (!response.ok) return;

          const sheetData = await response.json();
          const newHash = generateDataHash(sheetData);

          if (newHash !== currentHashRef.current) {
            console.log('[SVAKS] 🔄 Cloud data changed! Syncing...');
            currentHashRef.current = newHash;
            setLastSyncHash(newHash);
            setData(prevData => ({
              members: sheetData.members || [],
              collections: sheetData.collections || [],
              expenditure: sheetData.expenditure || [],
              committee: sheetData.committee || defaultCommittee.map(c => ({ ...c })),
              notifications: sheetData.notifications || defaultNotifications.map(n => ({ ...n })),
              settings: { ...defaultSettings, ...(sheetData.settings || {}), sheetUrl }
            }));
            setSyncStatus('synced');
            setSyncLastTime(new Date());
          }
        } catch (e) {
          console.warn('[SVAKS] Visibility sync error:', e.message);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [data.settings?.sheetUrl, sheetsLoaded]);

  // ========== STEP 6: SYNC ON FOCUS (window focus) ==========
  useEffect(() => {
    const sheetUrl = data.settings?.sheetUrl;
    if (!sheetUrl || !sheetsLoaded) return;

    const currentHashRef = useRef(lastSyncHash);

    const handleWindowFocus = async () => {
      console.log('[SVAKS] 🎯 Window focused, checking cloud...');
      try {
        const loadUrl = sheetUrl.includes('/load') ? sheetUrl : sheetUrl.replace(/\/exec.*/, '/exec') + '/load';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(loadUrl, { signal: controller.signal });
        clearTimeout(timer);

        if (!response.ok) return;

        const sheetData = await response.json();
        const newHash = generateDataHash(sheetData);

        if (newHash !== currentHashRef.current) {
          console.log('[SVAKS] 🔄 Cloud data changed! Syncing...');
          currentHashRef.current = newHash;
          setLastSyncHash(newHash);
          setData(prevData => ({
            members: sheetData.members || [],
            collections: sheetData.collections || [],
            expenditure: sheetData.expenditure || [],
            committee: sheetData.committee || defaultCommittee.map(c => ({ ...c })),
            notifications: sheetData.notifications || defaultNotifications.map(n => ({ ...n })),
            settings: { ...defaultSettings, ...(sheetData.settings || {}), sheetUrl }
          }));
          setSyncStatus('synced');
          setSyncLastTime(new Date());
        }
      } catch (e) {
        console.warn('[SVAKS] Focus sync error:', e.message);
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [data.settings?.sheetUrl, sheetsLoaded]);

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
