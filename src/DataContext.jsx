import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CLOUD_URL, SYNC_INTERVAL, INITIAL_LOAD_DELAY, MAX_RETRY_ATTEMPTS } from './config';

// Debounce interval for auto-push (ms)
const AUTO_PUSH_DEBOUNCE = 2000;

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
const SYNC_QUEUE_KEY = 'svaks_sync_queue';
const LAST_SYNC_KEY = 'svaks_last_sync';

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

function loadSyncQueue() {
	try {
		const raw = localStorage.getItem(SYNC_QUEUE_KEY);
		if (raw) {
			return JSON.parse(raw);
		}
	} catch (e) {
		console.error('[SVAKS] Sync queue load error:', e);
	}
	return [];
}

function saveSyncQueue(queue) {
	try {
		localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
	} catch (e) {
		console.error('[SVAKS] Sync queue save error:', e);
	}
}

function getLastSyncTime() {
	try {
		return localStorage.getItem(LAST_SYNC_KEY);
	} catch {
		return null;
	}
}

function setLastSyncTime(time) {
	try {
		localStorage.setItem(LAST_SYNC_KEY, time);
	} catch (e) {
		console.error('[SVAKS] Last sync time save error:', e);
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
	const [syncLastTime, setSyncLastTime] = useState(getLastSyncTime());
	const [initialLoadDone, setInitialLoadDone] = useState(false);
	const [pendingCount, setPendingCount] = useState(0);

	const syncQueueRef = useRef(loadSyncQueue());
	const isSyncingRef = useRef(false);
	const retryTimeoutRef = useRef(null);
	const pollRef = useRef(null);
	const lastPushRef = useRef(0);

	const getLoadUrl = (url) => {
		if (!url) return '';
		if (url.includes('script.google.com/macros')) {
			const base = url.replace(/\/exec.*/, '/exec');
			return base + '?action=load&load=true';
		}
		if (url.endsWith('/load')) return url;
		return url + '/load';
	};

	const processQueue = useCallback(async () => {
		const isAdmin = sessionStorage.getItem('svaks_admin') === 'true';
		if (!isAdmin) return;

		if (!CLOUD_URL || isSyncingRef.current || syncQueueRef.current.length === 0) {
			return;
		}

		const queue = [...syncQueueRef.current];
		if (queue.length === 0) return;

		isSyncingRef.current = true;
		setSyncStatus('syncing');

		let successCount = 0;
		let failedItems = [];

		for (const item of queue) {
			try {
				const now = Date.now();
				const dataWithMeta = {
					...item.data,
					_syncVersion: now,
					_lastSync: new Date().toISOString(),
					_queueId: item.id
				};

				let postUrl = CLOUD_URL;
				if (postUrl.includes('script.google.com/macros')) {
					postUrl = postUrl.replace(/\/exec.*/, '/exec');
				}

				const response = await fetch(postUrl, {
					method: 'POST',
					mode: 'no-cors',
					headers: { 'Content-Type': 'text/plain' },
					body: JSON.stringify(dataWithMeta)
				});

				if (response.ok || response.status === 0 || response.type === 'opaque') {
					successCount++;
					console.log('[SVAKS] Queue item synced successfully');
				} else {
					console.error('[SVAKS] Queue item failed:', response.status);
					failedItems.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
				}
			} catch (e) {
				console.error('[SVAKS] Queue push error:', e.message);
				failedItems.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
			}
		}

		syncQueueRef.current = failedItems.filter(item => (item.retryCount || 0) < MAX_RETRY_ATTEMPTS);
		saveSyncQueue(syncQueueRef.current);
		setPendingCount(syncQueueRef.current.length);

		if (syncQueueRef.current.length === 0) {
			setSyncStatus('synced');
			setSyncError('');
			const now = new Date().toISOString();
			setLastSyncTime(now);
			setSyncLastTime(now);
		} else {
			setSyncStatus('error');
			setSyncError(`${syncQueueRef.current.length} pending syncs`);
			scheduleRetry();
		}

		isSyncingRef.current = false;
	}, []);

	const scheduleRetry = useCallback(() => {
		if (retryTimeoutRef.current) {
			clearTimeout(retryTimeoutRef.current);
		}

		const queue = syncQueueRef.current;
		if (queue.length === 0) return;

		const baseDelay = 2000;
		const maxDelay = 30000;

		const avgRetryCount = queue.reduce((sum, item) => sum + (item.retryCount || 0), 0) / queue.length;
		const delay = Math.min(baseDelay * Math.pow(2, avgRetryCount), maxDelay);

		console.log(`[SVAKS] Scheduling retry in ${delay}ms (avg retries: ${avgRetryCount.toFixed(1)})`);

		retryTimeoutRef.current = setTimeout(() => {
			processQueue();
		}, delay);
	}, [processQueue]);

	// INSTANT cloud push - NO THROTTLE
	const pushToCloud = useCallback(async (dataToPush) => {
		const isAdmin = sessionStorage.getItem('svaks_admin') === 'true';
		if (!isAdmin) return false;

		if (!CLOUD_URL) {
			console.warn('[SVAKS] No cloud URL configured');
			return false;
		}

		const now = Date.now();
		const syncVersion = now;
		const dataWithMeta = {
			...dataToPush,
			_syncVersion: syncVersion,
			_lastSync: new Date().toISOString()
		};

		console.log('[SVAKS] Pushing to cloud, version:', syncVersion);
		setSyncStatus('syncing');

		try {
			let postUrl = CLOUD_URL;
			if (postUrl.includes('script.google.com/macros')) {
				postUrl = postUrl.replace(/\/exec.*/, '/exec');
			}

			const response = await fetch(postUrl, {
				method: 'POST',
				mode: 'no-cors',
				headers: { 'Content-Type': 'text/plain' },
				body: JSON.stringify(dataWithMeta)
			});

			// Check if request was successful
			if (response.ok || response.status === 0 || response.type === 'opaque') {
				console.log('[SVAKS] Push successful!');
				const nowISO = new Date().toISOString();
				setLastSyncTime(nowISO);
				setSyncLastTime(nowISO);
				setSyncStatus('synced');
				setSyncError('');
				setInitialLoadDone(true);

				syncQueueRef.current = syncQueueRef.current.filter(
					item => Math.abs(item.data._syncVersion - syncVersion) > 1000
				);
				saveSyncQueue(syncQueueRef.current);
				setPendingCount(syncQueueRef.current.length);

				return true;
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		} catch (e) {
			console.error('[SVAKS] Push error:', e.message);
			setSyncStatus('offline');
			setSyncError(e.message);

			// Save to localStorage when offline (hybrid mode)
			saveToStorage(dataToPush);

			const queueItem = {
				id: Date.now(),
				data: dataWithMeta,
				retryCount: 0,
				timestamp: now
			};
			syncQueueRef.current.push(queueItem);
			saveSyncQueue(syncQueueRef.current);
			setPendingCount(syncQueueRef.current.length);

			scheduleRetry();

			return false;
		}
	}, [scheduleRetry]);

	const fetchCloudData = useCallback(async (showStatus = false) => {
		if (!CLOUD_URL) return null;
		if (showStatus) setSyncStatus('loading');

		try {
			const loadUrl = getLoadUrl(CLOUD_URL);
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15000);

			const response = await fetch(loadUrl, {
				signal: controller.signal,
				redirect: 'follow'
			});
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
	}, []);

	const applyCloudData = useCallback((cloud) => {
		if (!cloud) return;

		const hasContent =
			(cloud.members?.length > 0) ||
			(cloud.committee?.some(c => c.name)) ||
			(cloud.collections?.length > 0) ||
			(cloud.expenditure?.length > 0) ||
			(cloud.notifications?.length > 0) ||
			cloud.settings?.pin || 
			cloud.settings?.appName !== defaultSettings.appName;

		if (!hasContent) {
			return;
		}

		const cloudVersion = Number(cloud._syncVersion) || 0;

		console.log('[SVAKS] Applying cloud data, version:', cloudVersion);

		// Mark that the next data change should NOT trigger a push (prevents infinite loop)
		skipNextPushRef.current = true;

		setData({
			_syncVersion: cloudVersion,
			members: Array.isArray(cloud.members) ? cloud.members : [],
			collections: Array.isArray(cloud.collections) ? cloud.collections : [],
			expenditure: Array.isArray(cloud.expenditure) ? cloud.expenditure : [],
			committee: Array.isArray(cloud.committee) && cloud.committee.length > 0
				? cloud.committee.map(c => ({ ...(defaultCommittee.find(dc => dc.position === c.position) || {}), ...c }))
				: defaultCommittee.map(c => ({ ...c })),
			notifications: Array.isArray(cloud.notifications) && cloud.notifications.length > 0
				? cloud.notifications
				: defaultNotifications.map(n => ({ ...n })),
			settings: { ...defaultSettings, ...(Array.isArray(cloud.settings) ? {} : (cloud.settings || {})) }
		});
	}, []);

	const loadFromCloud = useCallback(async () => {
		const cloud = await fetchCloudData(true);
		if (!cloud) return;

		const localVersion = data._syncVersion || 0;
		const cloudVersion = Number(cloud._syncVersion) || 0;

		console.log('[SVAKS] Comparing versions - Local:', localVersion, 'Cloud:', cloudVersion);

		if (cloudVersion > localVersion || !initialLoadDone) {
			console.log('[SVAKS] Updating from cloud...');
			applyCloudData(cloud);
			setInitialLoadDone(true);
		}

		setSyncStatus('synced');
		const now = new Date().toISOString();
		setLastSyncTime(now);
		setSyncLastTime(now);
	}, [fetchCloudData, data._syncVersion, initialLoadDone, applyCloudData]);

	// Initial cloud load
	useEffect(() => {
		if (!initialLoadDone) {
			console.log('[SVAKS] Initial cloud load...');
			loadFromCloud();
		}
	}, [initialLoadDone, loadFromCloud]);

	// Faster initial load delay
	useEffect(() => {
		const timer = setTimeout(() => {
			if (!initialLoadDone) {
				loadFromCloud();
			}
		}, INITIAL_LOAD_DELAY);
		return () => clearTimeout(timer);
	}, [initialLoadDone, loadFromCloud]);

	// Auto-sync: Push data to cloud with DEBOUNCE to prevent infinite loop
	const autoPushTimerRef = useRef(null);
	const skipNextPushRef = useRef(false);

	useEffect(() => {
		if (!CLOUD_URL) return;

		const isAdmin = sessionStorage.getItem('svaks_admin') === 'true';
		if (!isAdmin) return;

		// Skip push if this data change came from cloud fetch (prevents infinite loop)
		if (skipNextPushRef.current) {
			skipNextPushRef.current = false;
			saveToStorage(data);
			return;
		}

		// Only auto-sync if there's actual data to sync
		const hasData = data.members?.length > 0 ||
			data.collections?.length > 0 ||
			data.expenditure?.length > 0 ||
			data.committee?.some(c => c.name) ||
			data.notifications?.length > 0;

		if (hasData) {
			// Save to localStorage immediately
			saveToStorage(data);

			// Debounce cloud push
			if (autoPushTimerRef.current) clearTimeout(autoPushTimerRef.current);
			autoPushTimerRef.current = setTimeout(() => {
				pushToCloud(data);
			}, AUTO_PUSH_DEBOUNCE);
		}

		return () => {
			if (autoPushTimerRef.current) clearTimeout(autoPushTimerRef.current);
		};
	}, [data, pushToCloud]);

	// Poll for changes from cloud - FASTER (3 seconds)
	useEffect(() => {
		if (!CLOUD_URL) return;

		const poll = async () => {
			const cloud = await fetchCloudData(false);
			if (!cloud) return;

			const cloudVersion = Number(cloud._syncVersion) || 0;
			const localVersion = data._syncVersion || 0;

			if (cloudVersion > localVersion) {
				console.log('[SVAKS] Poll: New data detected, updating...');
				applyCloudData(cloud);
				setSyncStatus('synced');
				const now = new Date().toISOString();
				setLastSyncTime(now);
				setSyncLastTime(now);
			}

			if (syncQueueRef.current.length > 0) {
				processQueue();
			}
		};

		pollRef.current = setInterval(poll, SYNC_INTERVAL); // 3 seconds
		const quickCheck = setTimeout(poll, 1000); // Quick first check

		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
			clearTimeout(quickCheck);
		};
	}, [fetchCloudData, data._syncVersion, applyCloudData, processQueue]);

	// Tab visibility sync
	useEffect(() => {
		const handleVisibility = () => {
			if (document.visibilityState === 'visible') {
				console.log('[SVAKS] Tab visible, syncing...');
				loadFromCloud();
				if (syncQueueRef.current.length > 0) {
					processQueue();
				}
			}
		};

		document.addEventListener('visibilitychange', handleVisibility);
		return () => document.removeEventListener('visibilitychange', handleVisibility);
	}, [loadFromCloud, processQueue]);

	// Window focus sync
	useEffect(() => {
		const handleFocus = () => {
			console.log('[SVAKS] Window focused...');
			loadFromCloud();
			if (syncQueueRef.current.length > 0) {
				processQueue();
			}
		};

		window.addEventListener('focus', handleFocus);
		return () => window.removeEventListener('focus', handleFocus);
	}, [loadFromCloud, processQueue]);

	// Online/Offline detection for hybrid mode
	useEffect(() => {
		const handleOnline = () => {
			console.log('[SVAKS] Back online, syncing...');
			setSyncStatus('syncing');
			loadFromCloud();
			if (syncQueueRef.current.length > 0) {
				processQueue();
			}
		};

		const handleOffline = () => {
			console.log('[SVAKS] Gone offline, will save to localStorage');
			setSyncStatus('offline');
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, [loadFromCloud, processQueue]);

	// Load sync queue on mount
	useEffect(() => {
		const queue = loadSyncQueue();
		syncQueueRef.current = queue;
		setPendingCount(queue.length);
		if (queue.length > 0) {
			scheduleRetry();
		}
	}, [scheduleRetry]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	const syncToGoogleSheet = useCallback(async () => {
		if (!CLOUD_URL) {
			console.warn('Google Sheets URL nahi mila!');
			return;
		}
		setSyncStatus('syncing');
		const success = await pushToCloud(data);
		if (success) {
			console.log('Data Google Sheets mein save ho gaya!');
		}
	}, [pushToCloud, data]);

	const loadFromGoogleSheet = useCallback(async () => {
		if (!CLOUD_URL) {
			console.warn('Google Sheets URL nahi mila!');
			return;
		}
		if (!confirm('Cloud se data load karna hai? Current local data replace ho jayega.')) return;

		setSyncStatus('loading');
		await loadFromCloud();
		console.log('Data load ho gaya!');
	}, [loadFromCloud]);

	const clearSyncQueue = useCallback(() => {
		syncQueueRef.current = [];
		saveSyncQueue([]);
		setPendingCount(0);
		setSyncError('');
		console.log('[SVAKS] Sync queue cleared');
	}, []);

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
					_syncVersion: imp._syncVersion || 0,
					members: imp.members || [],
					collections: imp.collections || [],
					expenditure: imp.expenditure || [],
					committee: imp.committee || defaultCommittee.map(c => ({ ...c })),
					notifications: imp.notifications || defaultNotifications.map(n => ({ ...n })),
					settings: { ...defaultSettings, ...(imp.settings || {}) }
				});
				console.log('Data import successful!');
			} catch {
				console.error('Invalid JSON file!');
			}
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
		syncStatus, syncError, syncLastTime, pendingCount,
		syncToGoogleSheet, loadFromGoogleSheet, clearSyncQueue,
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
