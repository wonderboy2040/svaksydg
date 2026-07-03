import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import { DataProvider } from './DataContext';
import { ToastProvider } from './components/Toast';
import { LanguageProvider } from './i18n';
import ErrorBoundary from './components/ErrorBoundary';

// ===========================================
// Register Service Worker for PWA + Offline Mode
// Only register in production builds (dev has HMR)
// ===========================================
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SVAKS] Service Worker registered:', registration.scope);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SVAKS] New version available — reload to update');
                // Optionally dispatch event to show "Update available" UI
                window.dispatchEvent(new CustomEvent('svaks-update-available'));
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[SVAKS] SW registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <DataProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </DataProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
