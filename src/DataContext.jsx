import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
      return {
        members: parsed.members || [],
        collections: parsed.collections || [],
        expenditure: parsed.expenditure || [],
        committee: parsed.committee || defaultCommittee,
        notifications: parsed.notifications || defaultNotifications,
        settings: { ...defaultSettings, ...(parsed.settings || {}) }
      };
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
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
    console.error('Error saving to localStorage:', e);
  }
}

export function DataProvider({ children }) {
  const [data, setData] = useState(loadFromStorage);

  // Persist on every change
  useEffect(() => {
    saveToStorage(data);
  }, [data]);

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

  // ===== MEMBERS CRUD =====
  const addMember = useCallback((member) => {
    setData(prev => {
      const sanitized = validateAndSanitizeMember({ ...member, monthlyFee: member.monthlyFee || prev.settings.monthlyFee });
      return { ...prev, members: [...prev.members, sanitized] };
    });
  }, []);

  const updateMember = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === id ? { ...m, ...validateAndSanitizeMember({ ...m, ...fields }) } : m)
    }));
  }, []);

  const deleteMember = useCallback((id) => {
    setData(prev => ({
      ...prev,
      members: prev.members.filter(m => m.id !== id)
    }));
  }, []);

  // ===== COLLECTIONS CRUD =====
  const addCollection = useCallback((collection) => {
    setData(prev => {
      const sanitized = validateAndSanitizeCollection(collection);
      return { ...prev, collections: [...prev.collections, sanitized] };
    });
  }, []);

  const updateCollection = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      collections: prev.collections.map(c => c.id === id ? { ...c, ...validateAndSanitizeCollection({ ...c, ...fields }) } : c)
    }));
  }, []);

  const deleteCollection = useCallback((id) => {
    setData(prev => ({
      ...prev,
      collections: prev.collections.filter(c => c.id !== id)
    }));
  }, []);

  // ===== EXPENDITURE CRUD =====
  const addExpenditure = useCallback((expenditure) => {
    setData(prev => {
      const sanitized = validateAndSanitizeExpenditure(expenditure);
      return { ...prev, expenditure: [...prev.expenditure, sanitized] };
    });
  }, []);

  const updateExpenditure = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      expenditure: prev.expenditure.map(e => e.id === id ? { ...e, ...validateAndSanitizeExpenditure({ ...e, ...fields }) } : e)
    }));
  }, []);

  const deleteExpenditure = useCallback((id) => {
    setData(prev => ({
      ...prev,
      expenditure: prev.expenditure.filter(e => e.id !== id)
    }));
  }, []);

  // ===== NOTIFICATIONS CRUD =====
  const addNotification = useCallback((notification) => {
    setData(prev => {
      const sanitized = validateAndSanitizeNotification(notification);
      return { ...prev, notifications: [sanitized, ...prev.notifications] };
    });
  }, []);

  const updateNotification = useCallback((id, fields) => {
    setData(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => n.id === id ? { ...n, ...validateAndSanitizeNotification({ ...n, ...fields }) } : n)
    }));
  }, []);

  const deleteNotification = useCallback((id) => {
    setData(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id)
    }));
  }, []);

  // ===== GOOGLE SHEETS SYNC =====
  const syncToGoogleSheet = useCallback(async () => {
    const { sheetUrl } = data.settings;
    if (!sheetUrl) {
      alert('Pehle Settings mein Google Sheets URL setup karo!');
      return;
    }
    try {
      const response = await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });
      alert('Data Google Sheets pe sync ho gaya!');
    } catch (e) {
      console.error('Sync error:', e);
      alert('Sync mein error aaya. Console check karo.');
    }
  }, [data, data.settings]);

  const loadFromGoogleSheet = useCallback(async () => {
    const { sheetUrl } = data.settings;
    if (!sheetUrl) {
      alert('Pehle Settings mein Google Sheets URL setup karo!');
      return;
    }
    try {
      const scriptUrl = sheetUrl.replace('exec', 'exec') + '/load';
      const response = await fetch(scriptUrl);
      if (response.ok) {
        const sheetData = await response.json();
        if (sheetData.members) {
          setData({
            members: sheetData.members || [],
            collections: sheetData.collections || [],
            expenditure: sheetData.expenditure || [],
            committee: sheetData.committee || defaultCommittee,
            settings: { ...defaultSettings, ...(sheetData.settings || {}) }
          });
          alert('Google Sheets se data load ho gaya!');
        } else {
          alert('Sheets pe koi data nahi mila.');
        }
      }
    } catch (e) {
      console.error('Load error:', e);
      alert('Load karne mein error. Direct sheet se copy-paste karo.');
    }
  }, [data.settings]);

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
        const imported = JSON.parse(e.target.result);
        setData({
          members: imported.members || [],
          collections: imported.collections || [],
          expenditure: imported.expenditure || [],
          committee: imported.committee || defaultCommittee,
          settings: { ...defaultSettings, ...(imported.settings || {}) }
        });
        alert('Data import successful!');
      } catch (err) {
        alert('Invalid JSON file!');
      }
    };
    reader.readAsText(file);
  }, []);

  const value = {
    data,
    setData,
    update,
    // Members
    members: data.members,
    addMember,
    updateMember,
    deleteMember,
    // Collections
    collections: data.collections,
    addCollection,
    updateCollection,
    deleteCollection,
    // Expenditure
    expenditure: data.expenditure,
    addExpenditure,
    updateExpenditure,
    deleteExpenditure,
    // Committee
    committee: data.committee,
    updateCommittee,
    // Notifications
    notifications: data.notifications,
    addNotification,
    updateNotification,
    deleteNotification,
    // Settings
    settings: data.settings,
    updateSetting,
    // Sync
    syncToGoogleSheet,
    loadFromGoogleSheet,
    // Backup
    exportJSON,
    importJSON
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

export default DataContext;
