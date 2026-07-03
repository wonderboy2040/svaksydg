import { useState, useEffect } from 'react';

// ===========================================
// SVAKS PWA Install Hook
// Listens for 'beforeinstallprompt' event from browser
// and exposes an install() function
// ===========================================

export function usePWAInstall() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone === true) {
        setIsInstalled(true);
      }
    };
    checkInstalled();

    const handleBeforeInstall = (e) => {
      // Prevent the default browser prompt
      e.preventDefault();
      // Stash the event so we can trigger it later
      setInstallPromptEvent(e);
      console.log('[SVAKS PWA] Install prompt ready');
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
      console.log('[SVAKS PWA] App installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPromptEvent) {
      return { outcome: 'unavailable' };
    }
    try {
      installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        console.log('[SVAKS PWA] User accepted install');
        setIsInstalled(true);
      } else {
        console.log('[SVAKS PWA] User dismissed install');
      }
      setInstallPromptEvent(null);
      return choice;
    } catch (e) {
      console.error('[SVAKS PWA] Install prompt error:', e);
      return { outcome: 'error', error: e };
    }
  };

  return {
    canInstall: !!installPromptEvent && !isInstalled,
    isInstalled,
    promptInstall
  };
}

// ===========================================
// SW Registration Hook
// Registers the service worker on mount and reports status
// ===========================================
export function useServiceWorker() {
  const [status, setStatus] = useState('unregistered'); // 'unregistered' | 'registering' | 'registered' | 'error'
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setStatus('error');
      return;
    }

    // Only register in production (Vite dev server has its own HMR SW)
    if (import.meta.env.DEV) {
      setStatus('registered'); // Skip in dev
      return;
    }

    setStatus('registering');
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SVAKS SW] Registered with scope:', registration.scope);
        setStatus('registered');

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                setUpdateAvailable(true);
              }
            });
          }
        });

        // Check for updates every hour
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      })
      .catch((error) => {
        console.error('[SVAKS SW] Registration failed:', error);
        setStatus('error');
      });

    // Listen for messages from SW (e.g., background sync trigger)
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'BACKGROUND_SYNC') {
        console.log('[SVAKS PWA] Background sync event received');
        // Dispatch a custom event the app can listen for
        window.dispatchEvent(new CustomEvent('svaks-background-sync'));
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  const applyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage('SKIP_WAITING');
          window.location.reload();
        }
      });
    }
  };

  return { status, updateAvailable, applyUpdate };
}

// ===========================================
// Online/Offline Status Hook
// ===========================================
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
