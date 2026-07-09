import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import '../styles/Toast.css';

const ToastContext = createContext(null);

const Toast = ({ id, message, type = 'info', duration = 3000, onClose }) => {
  useEffect(() => {
    // onClose is now stable (useCallback) — timer won't reset when other toasts change
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  // Screen-reader friendly semantics: alerts for warnings/errors, status for info/success
  const role = type === 'danger' || type === 'warning' ? 'alert' : 'status';
  const ariaLive = type === 'danger' || type === 'warning' ? 'assertive' : 'polite';

  return (
    <div className={`toast ${type}`} role={role} aria-live={ariaLive}>
      <div className="toast-content">{message}</div>
      <button className="toast-close" onClick={() => onClose(id)} aria-label="Close notification">✕</button>
    </div>
  );
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // Stable callback — doesn't change between renders, so Toast's useEffect
  // won't re-run (and reset its timer) when other toasts are added/removed.
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    setToasts(prev => {
      // Deduplicate: skip if an identical toast (same message + type) is already on screen
      const isDuplicate = prev.some(t => t.message === message && t.type === type);
      if (isDuplicate) return prev;

      const id = Date.now() + Math.floor(Math.random() * 1000);
      return [...prev, { id, message, type, duration }];
    });
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <Toast
            key={t.id}
            id={t.id}
            message={t.message}
            type={t.type}
            duration={t.duration}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
