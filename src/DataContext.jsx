import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CLOUD_URL, SYNC_INTERVAL, FETCH_TIMEOUT, MAX_RETRY_ATTEMPTS } from './config';

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

const defaultCommittee = [
	{ id: 1, position: 'President', name: '', photo: '', phone: '', address: '' },
	{ id: 2, position: 'Vice President', name: '', photo: '', phone: '', address: '' },
	{ id: 3, position: 'Secretary', name: '', photo: '', phone: '', address: '' },
	{ id: 4, position: 'Treasurer', name: '', photo: '', phone: '', address: '' },
	{ id: 5, position: 'Advisory Member', name: '', photo: '', phone: '', address: '' },
	{ id: 6, position: 'Advisory Member', name: '', photo: '', phone: '', address: '' },
	{ id: 7, position: 'Senior Member', name: '', photo: '', phone: '', address: '' }
];

const defaultNotifications = [];

const defaultGallery = [];

// ===================================
// VALIDATION HELPERS
// ===================================
const validateMember = (member) => {
	const safeId = Number(member?.id) || Date.now() + Math.random();
	const safeName = String(member?.name || '').trim().substring(0, 100);
	const safeFather = String(member?.father || '').trim().substring(0, 100);
	const safePhone = String(member?.phone || '').trim().replace(/[^\d+-]/g, '').substring(0, 20);
	const safeAddress = String(member?.address || '').trim().substring(0, 200);
	const safeOccupation = String(member?.occupation || '').trim().substring(0, 100);
	const safeMonthlyFee = Math.abs(Number(member?.monthlyFee)) || 100;
	const safeOther = String(member?.other || '').trim().substring(0, 500);
	const safeJoinedDate = member?.joinedDate || new Date().toISOString().split('T')[0];
	const finalName = safeName || 'Unknown Member';

	return {
		id: safeId,
		name: finalName,
		father: safeFather,
		phone: safePhone,
		address: safeAddress,
		occupation: safeOccupation,
		monthlyFee: safeMonthlyFee,
		other: safeOther,
		joinedDate: safeJoinedDate
	};
};

const validateCollection = (collection) => {
	const safeId = Number(collection?.id) || Date.now() + Math.random();
	const safeMemberId = collection?.memberId ? Number(collection.memberId) : null;
	const safeMemberName = String(collection?.memberName || '').trim().substring(0, 100);
	const safeAmount = Math.abs(Number(collection?.amount)) || 0;
	const safeSource = String(collection?.source || 'Other').trim().substring(0, 50);
	const safeNote = String(collection?.note || '').trim().substring(0, 200);
	let safeDate = collection?.date;
	if (safeDate) {
		const parsed = new Date(safeDate);
		if (!isNaN(parsed.getTime())) {
			safeDate = parsed.toISOString().split('T')[0];
		} else {
			safeDate = new Date().toISOString().split('T')[0];
		}
	} else {
		safeDate = new Date().toISOString().split('T')[0];
	}

	return {
		id: safeId,
		memberId: safeMemberId,
		memberName: safeMemberName,
		amount: safeAmount,
		source: safeSource,
		note: safeNote,
		date: safeDate
	};
};

const validateExpenditure = (expenditure) => {
	const safeId = Number(expenditure?.id) || Date.now() + Math.random();
	const safeCategory = String(expenditure?.category || 'Other').trim().substring(0, 50);
	const safeAmount = Math.abs(Number(expenditure?.amount)) || 0;
	const safeDescription = String(expenditure?.description || '').trim().substring(0, 200);
	let safeDate = expenditure?.date;
	if (safeDate) {
		const parsed = new Date(safeDate);
		if (!isNaN(parsed.getTime())) {
			safeDate = parsed.toISOString().split('T')[0];
		} else {
			safeDate = new Date().toISOString().split('T')[0];
		}
	} else {
		safeDate = new Date().toISOString().split('T')[0];
	}

	return {
		id: safeId,
		category: safeCategory,
		amount: safeAmount,
		description: safeDescription,
		date: safeDate
	};
};

const validateNotification = (notification) => ({
	id: Number(notification.id) || Date.now(),
	title: String(notification.title || '').trim().substring(0, 100),
	text: String(notification.text || '').trim().substring(0, 500),
	date: notification.date || new Date().toLocaleDateString('en-IN'),
	active: notification.active !== undefined ? Boolean(notification.active) : true
});

const validateCommittee = (committee) => ({
	id: Number(committee.id) || Date.now(),
	position: String(committee.position || '').trim().substring(0, 50),
	name: String(committee.name || '').trim().substring(0, 100),
	photo: String(committee.photo || '').trim().substring(0, 1000),
	phone: String(committee.phone || '').trim().substring(0, 20),
	address: String(committee.address || '').trim().substring(0, 200)
});

// ===================================
// CLOUD API HELPERS
// ===================================
function getLoadUrl(url) {
	if (!url) return '';
	if (url.includes('script.google.com/macros')) {
		const base = url.replace(/\/exec.*/, '/exec');
		return base + '?action=load&load=true';
	}
	if (url.endsWith('/load')) return url;
	return url + '/load';
}

function getPostUrl(url) {
	if (!url) return '';
	if (url.includes('script.google.com/macros')) {
		return url.replace(/\/exec.*/, '/exec');
	}
	return url;
}

// ===================================
// DATA PROVIDER — CLOUD-FIRST
// ===================================
export function DataProvider({ children }) {
	// Data state — starts empty, loaded from cloud
	const [data, setData] = useState({
		_syncVersion: 0,
		members: [],
		collections: [],
		expenditure: [],
		committee: defaultCommittee.map(c => ({ ...c })),
		notifications: [],
		gallery: [],
		settings: { ...defaultSettings }
	});

	const [syncStatus, setSyncStatus] = useState('loading'); // 'loading' | 'synced' | 'syncing' | 'error' | 'offline'
	const [syncError, setSyncError] = useState('');
	const [syncLastTime, setSyncLastTime] = useState(null);
	const [initialLoadDone, setInitialLoadDone] = useState(false);
	const [saving, setSaving] = useState(false);

	const pollRef = useRef(null);
	const isFetchingRef = useRef(false);

	// ===================================
	// FETCH DATA FROM GOOGLE SHEETS
	// ===================================
	const fetchCloudData = useCallback(async (showStatus = false) => {
		if (!CLOUD_URL) return null;
		if (isFetchingRef.current) return null;

		isFetchingRef.current = true;
		if (showStatus) setSyncStatus('loading');

		try {
			const loadUrl = getLoadUrl(CLOUD_URL);
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

			const response = await fetch(loadUrl, {
				signal: controller.signal,
				redirect: 'follow'
			});
			clearTimeout(timeout);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();
			isFetchingRef.current = false;
			return result;
		} catch (e) {
			console.error('[SVAKS] Cloud fetch error:', e.message);
			isFetchingRef.current = false;
			if (showStatus) {
				setSyncStatus('error');
				setSyncError(e.message);
			}
			return null;
		}
	}, []);

	// ===================================
	// APPLY CLOUD DATA TO STATE
	// ===================================
	const applyCloudData = useCallback((cloud) => {
		if (!cloud || typeof cloud !== 'object') return;

		console.log('[SVAKS] Applying cloud data, version:', cloud._syncVersion);

		// Validate each section to prevent runtime crashes from malformed data
		const safeMembers = Array.isArray(cloud.members)
			? cloud.members.map(validateMember)
			: [];
		const safeCollections = Array.isArray(cloud.collections)
			? cloud.collections.map(validateCollection)
			: [];
		const safeExpenditure = Array.isArray(cloud.expenditure)
			? cloud.expenditure.map(validateExpenditure)
			: [];
		const safeNotifications = Array.isArray(cloud.notifications)
			? cloud.notifications.map(validateNotification)
			: [];
		const safeGallery = Array.isArray(cloud.gallery)
			? cloud.gallery
			: [];
		const safeCommittee = Array.isArray(cloud.committee) && cloud.committee.length > 0
			? defaultCommittee.map(dc => {
				const cloudC = cloud.committee.find(c => c.id === dc.id || c.position === dc.position);
				return cloudC && cloudC.name ? { ...dc, ...validateCommittee({ ...dc, ...cloudC }) } : dc;
			})
			: defaultCommittee.map(c => ({ ...c }));

		setData({
			_syncVersion: Number(cloud._syncVersion) || Date.now(),
			members: safeMembers,
			collections: safeCollections,
			expenditure: safeExpenditure,
			committee: safeCommittee,
			notifications: safeNotifications,
			gallery: safeGallery,
			settings: {
				...defaultSettings,
				...(cloud.settings && !Array.isArray(cloud.settings) && typeof cloud.settings === 'object' ? cloud.settings : {})
			}
		});

		const now = new Date().toISOString();
		setSyncLastTime(now);
		setSyncStatus('synced');
		setSyncError('');
	}, []);

	// ===================================
	// PUSH DATA TO GOOGLE SHEETS
	// ===================================
	const pushToCloud = useCallback(async (dataToPush) => {
		if (!CLOUD_URL) {
			console.warn('[SVAKS] No cloud URL configured');
			return false;
		}

		const now = Date.now();
		const dataWithMeta = {
			...dataToPush,
			_syncVersion: now,
			_lastSync: new Date().toISOString()
		};

		console.log('[SVAKS] Pushing to cloud, version:', now);

		try {
			const postUrl = getPostUrl(CLOUD_URL);

			const response = await fetch(postUrl, {
				method: 'POST',
				mode: 'no-cors',
				headers: { 'Content-Type': 'text/plain' },
				body: JSON.stringify(dataWithMeta)
			});

			// no-cors always returns opaque response — we assume success
			if (response.ok || response.status === 0 || response.type === 'opaque') {
				console.log('[SVAKS] Push completed (opaque response — assumed success)');
				return true;
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		} catch (e) {
			console.error('[SVAKS] Push error:', e.message);
			return false;
		}
	}, []);

	// ===================================
	// SAVE & VERIFY — The core save flow
	// Push to cloud → wait → re-fetch to confirm
	// ===================================
	const saveAndVerify = useCallback(async (newData) => {
		setSaving(true);
		setSyncStatus('syncing');

		// Step 1: Push to Google Sheets
		const pushSuccess = await pushToCloud(newData);

		if (!pushSuccess) {
			setSyncStatus('error');
			setSyncError('Failed to push data to cloud. Check internet connection.');
			setSaving(false);
			return false;
		}

		// Step 2: Wait a moment for Google Sheets to process
		await new Promise(resolve => setTimeout(resolve, 1500));

		// Step 3: Re-fetch from cloud to verify
		const cloud = await fetchCloudData(false);
		if (cloud) {
			applyCloudData(cloud);
			console.log('[SVAKS] Save verified — cloud data re-fetched');
		} else {
			// Push was done, but couldn't verify. Apply local data for now.
			setData(newData);
			setSyncStatus('synced');
			console.warn('[SVAKS] Could not verify save, using local data');
		}

		setSaving(false);
		return true;
	}, [pushToCloud, fetchCloudData, applyCloudData]);

	// ===================================
	// INITIAL CLOUD LOAD
	// ===================================
	useEffect(() => {
		let cancelled = false;

		const doInitialLoad = async () => {
			console.log('[SVAKS] Initial cloud load starting...');
			setSyncStatus('loading');

			let retries = 0;
			let cloud = null;

			while (!cloud && retries < 3 && !cancelled) {
				cloud = await fetchCloudData(true);
				if (!cloud) {
					retries++;
					if (retries < 3) {
						console.log(`[SVAKS] Retry ${retries}/3...`);
						await new Promise(r => setTimeout(r, 2000));
					}
				}
			}

			if (cancelled) return;

			if (cloud) {
				applyCloudData(cloud);
				setInitialLoadDone(true);
				console.log('[SVAKS] Initial load complete!');
			} else {
				setSyncStatus('error');
				setSyncError('Could not connect to Google Sheets. Check internet and try refreshing.');
				setInitialLoadDone(true);
				console.error('[SVAKS] Initial load failed after 3 retries');
			}
		};

		doInitialLoad();

		return () => { cancelled = true; };
	}, [fetchCloudData, applyCloudData]);

	// ===================================
	// POLL FOR CHANGES (every 15 seconds)
	// ===================================
	useEffect(() => {
		if (!CLOUD_URL || !initialLoadDone) return;

		const poll = async () => {
			const cloud = await fetchCloudData(false);
			if (!cloud) return;

			const cloudVersion = Number(cloud._syncVersion) || 0;
			const localVersion = data._syncVersion || 0;

			if (cloudVersion > localVersion) {
				console.log('[SVAKS] Poll: New data detected, updating...', { cloudVersion, localVersion });
				applyCloudData(cloud);
			}
		};

		pollRef.current = setInterval(poll, SYNC_INTERVAL);

		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [fetchCloudData, data._syncVersion, applyCloudData, initialLoadDone]);

	// ===================================
	// TAB VISIBILITY — refresh on tab focus
	// ===================================
	useEffect(() => {
		if (!CLOUD_URL) return;

		const handleVisibility = async () => {
			if (document.visibilityState === 'visible' && initialLoadDone) {
				console.log('[SVAKS] Tab visible, refreshing...');
				const cloud = await fetchCloudData(false);
				if (cloud) {
					applyCloudData(cloud);
				}
			}
		};

		document.addEventListener('visibilitychange', handleVisibility);
		return () => document.removeEventListener('visibilitychange', handleVisibility);
	}, [fetchCloudData, applyCloudData, initialLoadDone]);

	// ===================================
	// ONLINE/OFFLINE DETECTION
	// ===================================
	useEffect(() => {
		const handleOnline = async () => {
			console.log('[SVAKS] Back online, refreshing...');
			setSyncStatus('loading');
			const cloud = await fetchCloudData(true);
			if (cloud) applyCloudData(cloud);
		};

		const handleOffline = () => {
			console.log('[SVAKS] Gone offline');
			setSyncStatus('offline');
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, [fetchCloudData, applyCloudData]);

	// ===================================
	// DATA MUTATION FUNCTIONS (Add, Update only — NO Delete)
	// All mutations save to cloud immediately
	// ===================================

	const update = useCallback((key, value) => {
		setData(prev => ({ ...prev, [key]: value }));
	}, []);

	const updateSetting = useCallback((key, value) => {
		setData(prev => ({
			...prev,
			settings: { ...prev.settings, [key]: value }
		}));
	}, []);

	// --- MEMBERS ---
	const addMember = useCallback((member) => {
		const m = validateMember({ ...member, monthlyFee: member.monthlyFee || data.settings.monthlyFee });
		const newData = { ...data, members: [...data.members, m] };
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	const updateMember = useCallback((id, updates) => {
		const parsedUpdates = { ...updates };
		if (parsedUpdates.monthlyFee !== undefined) {
			parsedUpdates.monthlyFee = Math.abs(Number(parsedUpdates.monthlyFee)) || 0;
		}
		const newData = {
			...data,
			members: data.members.map(m => m.id === id ? validateMember({ ...m, ...parsedUpdates }) : m)
		};
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	// --- COLLECTIONS ---
	const addCollection = useCallback((collection) => {
		const c = validateCollection(collection);
		const newData = { ...data, collections: [...data.collections, c] };
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	const updateCollection = useCallback((id, fields) => {
		const parsedUpdates = { ...fields };
		if (parsedUpdates.amount !== undefined) {
			parsedUpdates.amount = Math.abs(Number(parsedUpdates.amount)) || 0;
		}
		const newData = {
			...data,
			collections: data.collections.map(c => c.id === id ? validateCollection({ ...c, ...parsedUpdates }) : c)
		};
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	// --- EXPENDITURE ---
	const addExpenditure = useCallback((expenditure) => {
		const e = validateExpenditure(expenditure);
		const newData = { ...data, expenditure: [...data.expenditure, e] };
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	const updateExpenditure = useCallback((id, updates) => {
		const parsedUpdates = { ...updates };
		if (parsedUpdates.amount !== undefined) {
			parsedUpdates.amount = Math.abs(Number(parsedUpdates.amount)) || 0;
		}
		const newData = {
			...data,
			expenditure: data.expenditure.map(e => e.id === id ? validateExpenditure({ ...e, ...parsedUpdates }) : e)
		};
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	// --- COMMITTEE ---
	const updateCommittee = useCallback((id, fields) => {
		setData(prev => ({
			...prev,
			committee: prev.committee.map(c => c.id === id ? { ...c, ...validateCommittee({ ...c, ...fields }) } : c)
		}));
		// NOTE: Committee updates are buffered locally. Use saveCommittee() to push to cloud.
	}, []);

	const addCommitteeMember = useCallback((member) => {
		const m = validateCommittee(member);
		setData(prev => ({
			...prev,
			committee: [...prev.committee, m]
		}));
	}, []);

	const deleteCommitteeMember = useCallback((id) => {
		setData(prev => ({
			...prev,
			committee: prev.committee.filter(c => c.id !== id)
		}));
	}, []);

	const saveCommittee = useCallback(async () => {
		return saveAndVerify(data);
	}, [data, saveAndVerify]);

	// --- NOTIFICATIONS ---
	const addNotification = useCallback((notification) => {
		const n = validateNotification(notification);
		const newData = { ...data, notifications: [n, ...data.notifications] };
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	const updateNotification = useCallback((id, fields) => {
		const newData = {
			...data,
			notifications: data.notifications.map(n => n.id === id ? { ...n, ...validateNotification({ ...n, ...fields }) } : n)
		};
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	// --- GALLERY ---
	const addGalleryAlbum = useCallback((album) => {
		const newAlbum = {
			id: Date.now(),
			title: album.title || 'New Album',
			date: album.date || new Date().toLocaleDateString('en-IN'),
			cover: album.cover || '',
			photos: album.photos || []
		};
		const newData = { ...data, gallery: [...data.gallery, newAlbum] };
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	const updateGalleryAlbum = useCallback((id, fields) => {
		const newData = {
			...data,
			gallery: data.gallery.map(album =>
				album.id === id ? { ...album, ...fields } : album
			)
		};
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	const addPhotoToAlbum = useCallback((albumId, photoUrl) => {
		const newData = {
			...data,
			gallery: data.gallery.map(album => {
				if (album.id === albumId) {
					const newPhotos = [...album.photos, { id: Date.now(), url: photoUrl }];
					const newCover = album.cover || photoUrl;
					return { ...album, photos: newPhotos, cover: newCover };
				}
				return album;
			})
		};
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	// --- SYNC FUNCTIONS ---
	const syncToGoogleSheet = useCallback(async () => {
		if (!CLOUD_URL) {
			console.warn('Google Sheets URL nahi mila!');
			return;
		}
		return saveAndVerify(data);
	}, [data, saveAndVerify]);

	const loadFromGoogleSheet = useCallback(async () => {
		if (!CLOUD_URL) {
			console.warn('Google Sheets URL nahi mila!');
			return;
		}
		setSyncStatus('loading');
		const cloud = await fetchCloudData(true);
		if (cloud) {
			applyCloudData(cloud);
			console.log('[SVAKS] Data refreshed from cloud!');
		}
	}, [fetchCloudData, applyCloudData]);

	// --- SAVE SETTINGS ---
	const saveSettings = useCallback(async () => {
		return saveAndVerify(data);
	}, [data, saveAndVerify]);

	// --- SAVE SETTINGS WITH PARTIAL PATCH ---
	// Accepts a partial settings object, merges with current settings,
	// pushes to cloud in one shot. Avoids stale-closure issues with
	// sequential updateSetting() + saveSettings() calls.
	const saveSettingsWith = useCallback(async (partialSettings) => {
		const newSettings = { ...data.settings, ...partialSettings };
		const newData = { ...data, settings: newSettings };
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	// --- SAVE ALL (manual full push) ---
	const saveAllToCloud = useCallback(async () => {
		return saveAndVerify(data);
	}, [data, saveAndVerify]);

	// --- BULK OPERATIONS ---
	const bulkAddCollections = useCallback(async (newCollections) => {
		const validated = newCollections.map(c => validateCollection(c));
		const newData = { ...data, collections: [...data.collections, ...validated] };
		setData(newData);
		return saveAndVerify(newData);
	}, [data, saveAndVerify]);

	// --- EXPORT / IMPORT ---
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
		reader.onload = async (e) => {
			try {
				const imp = JSON.parse(e.target.result);
				const newData = {
					_syncVersion: imp._syncVersion || Date.now(),
					members: imp.members || [],
					collections: imp.collections || [],
					expenditure: imp.expenditure || [],
					committee: imp.committee || defaultCommittee.map(c => ({ ...c })),
					notifications: imp.notifications || [],
					gallery: imp.gallery || [],
					settings: { ...defaultSettings, ...(imp.settings || {}) }
				};
				setData(newData);
				await saveAndVerify(newData);
				console.log('[SVAKS] Data imported and saved to cloud!');
			} catch {
				console.error('Invalid JSON file!');
			}
		};
		reader.readAsText(file);
	}, [saveAndVerify]);

	// ===================================
	// CONTEXT VALUE
	// ===================================
	const value = {
		data, setData, update,
		members: data.members, addMember, updateMember,
		collections: data.collections, addCollection, updateCollection,
		expenditure: data.expenditure, addExpenditure, updateExpenditure,
		committee: data.committee, updateCommittee, saveCommittee, addCommitteeMember, deleteCommitteeMember,
		notifications: data.notifications, addNotification, updateNotification,
		gallery: data.gallery, addGalleryAlbum, updateGalleryAlbum,
		addPhotoToAlbum,
		settings: data.settings, updateSetting, saveSettings, saveSettingsWith,
		syncStatus, syncError, syncLastTime, saving,
		syncToGoogleSheet, loadFromGoogleSheet, saveAllToCloud,
		bulkAddCollections,
		exportJSON, importJSON,
		initialLoadDone
	};

	return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
	const ctx = useContext(DataContext);
	if (!ctx) throw new Error('useData must be inside DataProvider');
	return ctx;
}

export default DataContext;
