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
// Only register in production builds (dev has HMR).
// The useServiceWorker() hook in Admin.jsx attaches update listeners
// to this registration — registration itself happens here only.
// ===========================================
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SVAKS] Service Worker registered:', registration.scope);
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
