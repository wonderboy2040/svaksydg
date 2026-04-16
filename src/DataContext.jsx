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

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        _syncVersion: parsed._syncVersion || 0,
        members: parsed.members || [],
        collections: parsed.collections || [],
        expenditure: parsed.expenditure || [],
        committee: parsed.committee || defaultCommittee.map(c => ({ ...c })),
        notifications: parsed.notifications || defaultNotifications.map(n => ({ ...n })),
        settings: { ...defaultSettings, ...(parsed.settings || {}) }
      };
    }
  } catch (e) {
    console.error('[SVAKS] localStorage error:', e);
  }
  return {
    _syncVersion: 0,
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      _syncVersion: data._syncVersion || 0,
      members: data.members,
      collections: data.collections,
      expenditure: data.expenditure,
      committee: data.committee,
      notifications: data.notifications,
      settings: data.settings
    }));
  } catch (e) {
    console.error('[SVAKS] save error:', e);
  }
}

const validateMember = (member) => ({
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

const validateCollection = (collection) => ({
  id: Number(collection.id) || Date.now(),
  memberId: Number(collection.memberId) || null,
  memberName: String(collection.memberName || '').trim().substring(0, 100),
  amount: Math.abs(Number(collection.amount)) || 0,
  source: String(collection.source || 'Other').trim().substring(0, 50),
  note: String(collection.note || '').trim().substring(0, 200),
  date: collection.date || new Date().toISOString().split('T')[0]
});

const validateExpenditure = (expenditure) => ({
  id: Number(expenditure.id) || Date.now(),
  category: String(expenditure.category || 'Other').trim().substring(0, 50),
  amount: Math.abs(Number(expenditure.amount)) || 0,
  description: String(expenditure.description || '').trim().substring(0, 200),
  date: expenditure.date || new Date().toISOString().split('T')[0]
});

const validateNotification = (notification) => ({
  id: Number(notification.id) || Date.now(),
  title: String(notification.title || '').trim().substring(0, 100),
  text: String(notification.text || '').trim().substring(0, 500),
  date: notification.date || new Date().toLocaleDateString('en-IN'),
  active: Boolean(notification.active)
});

const validateCommittee = (committee) => ({
  id: Number(committee.id) || Date.now(),
  position: String(committee.position || '').trim().substring(0, 50),
  name: String(committee.name || '').trim().substring(0, 100),
  photo: String(committee.photo || '').trim().substring(0, 500),
  phone: String(committee.phone || '').trim().substring(0, 20),
  address: String(committee.address || '').trim().substring(0, 200)
});

export function DataProvider({ children }) {
  const [data, setData] = useState(loadFromStorage);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState('');
  const [syncLastTime, setSyncLastTime] = useState(null);
  const [cloudData, setCloudData] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const syncTimeoutRef = useRef(null);
  const pollRef = useRef(null);
  const isSyncingRef = useRef(false);
  const lastPushRef = useRef(0);

  const sheetUrl = data.settings?.sheetUrl;

  const getLoadUrl = (url) => {
    if (!url) return '';
    if (url.includes('/load')) return url;
    return url.replace(/\/exec.*/, '/exec') + '/load';
  };

  const fetchCloudData = useCallback(async (showStatus = false) => {
    if (!sheetUrl) return null;
    if (showStatus) setSyncStatus('loading');

    try {
      const loadUrl = getLoadUrl(sheetUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(loadUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        if (showStatus) setSyncStatus('idle');
        return null;
      }

      const result = await response.json();
      return result;
    } catch (e) {
      console.error('[SVAKS] Fetch error:', e.message);
      if (showStatus) {
        setSyncStatus('error');
        setSyncError(e.message);
      }
      return null;
    }
  }, [sheetUrl]);

  const pushToCloud = useCallback(async (dataToPush) => {
    if (!sheetUrl || isSyncingRef.current) return false;
    isSyncingRef.current = true;

    try {
      const now = Date.now();
      if (now - lastPushRef.current < 2000) {
        isSyncingRef.current = false;
        return false;
      }
      lastPushRef.current = now;

      const syncVersion = now;
      const dataWithMeta = {
        ...dataToPush,
        _syncVersion: syncVersion,
        _lastSync: new Date().toISOString()
      };

      console.log('[SVAKS] Pushing to cloud, version:', syncVersion);

      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(dataWithMeta)
      });

      setData(prev => ({ ...prev, _syncVersion: syncVersion }));

      setSyncStatus('synced');
      setSyncLastTime(new Date());
      setSyncError('');
      return true;
    } catch (e) {
      console.error('[SVAKS] Push error:', e.message);
      setSyncStatus('error');
      setSyncError(e.message);
      return false;
    } finally {
      isSyncingRef.current = false;
    }
  }, [sheetUrl]);

  const loadFromCloud = useCallback(async () => {
    const cloud = await fetchCloudData(true);
    if (!cloud) return;

    const hasContent =
      (cloud.members?.length > 0) ||
      (cloud.committee?.some(c => c.name)) ||
      (cloud.collections?.length > 0) ||
      cloud.settings?.pin;

    if (!hasContent) {
      setSyncStatus('idle');
      return;
    }

    // Check _syncVersion at root level, not in settings
    const localVersion = data._syncVersion || 0;
    const cloudVersion = Number(cloud._syncVersion) || 0;

    console.log('[SVAKS] Comparing versions - Local:', localVersion, 'Cloud:', cloudVersion);

    if (cloudVersion > localVersion || !initialLoadDone) {
      console.log('[SVAKS] Updating from cloud...');
      setData({
        _syncVersion: cloudVersion,
        members: Array.isArray(cloud.members) ? cloud.members : [],
        collections: Array.isArray(cloud.collections) ? cloud.collections : [],
        expenditure: Array.isArray(cloud.expenditure) ? cloud.expenditure : [],
        committee: Array.isArray(cloud.committee)
          ? cloud.committee.map(c => ({ ...defaultCommittee.find(dc => dc.position === c.position), ...c }))
          : defaultCommittee.map(c => ({ ...c })),
        notifications: Array.isArray(cloud.notifications)
          ? cloud.notifications
          : defaultNotifications.map(n => ({ ...n })),
        settings: { ...defaultSettings, ...(cloud.settings || {}), sheetUrl }
      });
      setInitialLoadDone(true);
    }

    setSyncStatus('synced');
    setSyncLastTime(new Date());
  }, [fetchCloudData, data._syncVersion, initialLoadDone, sheetUrl]);

  useEffect(() => {
    if (sheetUrl && !initialLoadDone) {
      console.log('[SVAKS] Initial cloud load...');
      loadFromCloud();
    }
  }, [sheetUrl, initialLoadDone, loadFromCloud]);

  useEffect(() => {
    if (!sheetUrl || !data.settings?.pin) return;
    
    const timer = setTimeout(() => {
      if (!initialLoadDone) {
        loadFromCloud();
      }
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [sheetUrl, data.settings?.pin, initialLoadDone]);

  useEffect(() => {
    const timer = setTimeout(() => saveToStorage(data), 100);
    return () => clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (!sheetUrl) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    setSyncStatus('syncing');
    syncTimeoutRef.current = setTimeout(() => {
      pushToCloud(data);
    }, 2000);

    return () => clearTimeout(syncTimeoutRef.current);
  }, [data, sheetUrl, pushToCloud]);

  useEffect(() => {
    if (!sheetUrl) return;

    const poll = async () => {
      const cloud = await fetchCloudData(false);
      if (!cloud) return;

      const cloudVersion = Number(cloud._syncVersion) || 0;
      const localVersion = data._syncVersion || 0;

      if (cloudVersion > localVersion) {
        console.log('[SVAKS] Poll: New data detected, updating...');

        setData({
          _syncVersion: cloudVersion,
          members: Array.isArray(cloud.members) ? cloud.members : [],
          collections: Array.isArray(cloud.collections) ? cloud.collections : [],
          expenditure: Array.isArray(cloud.expenditure) ? cloud.expenditure : [],
          committee: Array.isArray(cloud.committee)
            ? cloud.committee.map(c => ({ ...defaultCommittee.find(dc => dc.position === c.position), ...c }))
            : defaultCommittee.map(c => ({ ...c })),
          notifications: Array.isArray(cloud.notifications)
            ? cloud.notifications
            : defaultNotifications.map(n => ({ ...n })),
          settings: { ...defaultSettings, ...(cloud.settings || {}), sheetUrl }
        });

        setSyncStatus('synced');
        setSyncLastTime(new Date());
      }
    };

    pollRef.current = setInterval(poll, 10000);

    const quickCheck = setTimeout(poll, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(quickCheck);
    };
  }, [sheetUrl, fetchCloudData, data.settings?._syncVersion]);

  useEffect(() => {
    if (!sheetUrl) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[SVAKS] Tab visible, syncing...');
        loadFromCloud();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [sheetUrl, loadFromCloud]);

  useEffect(() => {
    if (!sheetUrl) return;

    const handleFocus = () => {
      console.log('[SVAKS] Window focused...');
      loadFromCloud();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [sheetUrl, loadFromCloud]);

  const syncToGoogleSheet = useCallback(async () => {
    if (!sheetUrl) {
      alert('Google Sheets URL nahi mila!');
      return;
    }
    setSyncStatus('syncing');
    const success = await pushToCloud(data);
    if (success) {
      alert('Data Google Sheets mein save ho gaya!');
    }
  }, [sheetUrl, pushToCloud, data]);

  const loadFromGoogleSheet = useCallback(async () => {
    if (!sheetUrl) {
      alert('Google Sheets URL nahi mila!');
      return;
    }
    if (!confirm('Cloud se data load karna hai?')) return;

    setSyncStatus('loading');
    await loadFromCloud();
    alert('Data load ho gaya!');
  }, [sheetUrl, loadFromCloud]);

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
      committee: prev.committee.map(c => c.id === id ? { ...c, ...validateCommittee({ ...c, ...fields }) } : c)
    }));
  }, []);

  const addMember = useCallback((member) => {
    setData(prev => {
      const m = validateMember({ ...member, monthlyFee: member.monthlyFee || prev.settings.monthlyFee });
      return { ...prev, members: [...prev.members, m] };
    });
  }, []);

  const updateMember = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === id ? { ...m, ...validateMember({ ...m, ...fields }) } : m)
    }));
  }, []);

  const deleteMember = useCallback((id) => {
    setData(prev => ({ ...prev, members: prev.members.filter(m => m.id !== id) }));
  }, []);

  const addCollection = useCallback((collection) => {
    setData(prev => {
      const c = validateCollection(collection);
      return { ...prev, collections: [...prev.collections, c] };
    });
  }, []);

  const updateCollection = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      collections: prev.collections.map(c => c.id === id ? { ...c, ...validateCollection({ ...c, ...fields }) } : c)
    }));
  }, []);

  const deleteCollection = useCallback((id) => {
    setData(prev => ({ ...prev, collections: prev.collections.filter(c => c.id !== id) }));
  }, []);

  const addExpenditure = useCallback((expenditure) => {
    setData(prev => {
      const e = validateExpenditure(expenditure);
      return { ...prev, expenditure: [...prev.expenditure, e] };
    });
  }, []);

  const updateExpenditure = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      expenditure: prev.expenditure.map(e => e.id === id ? { ...e, ...validateExpenditure({ ...e, ...fields }) } : e)
    }));
  }, []);

  const deleteExpenditure = useCallback((id) => {
    setData(prev => ({ ...prev, expenditure: prev.expenditure.filter(e => e.id !== id) }));
  }, []);

  const addNotification = useCallback((notification) => {
    setData(prev => {
      const n = validateNotification(notification);
      return { ...prev, notifications: [n, ...prev.notifications] };
    });
  }, []);

  const updateNotification = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => n.id === id ? { ...n, ...validateNotification({ ...n, ...fields }) } : n)
    }));
  }, []);

  const deleteNotification = useCallback((id) => {
    setData(prev => ({ ...prev, notifications: prev.notifications.filter(n => n.id !== id) }));
  }, []);

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
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
}

export default DataContext;