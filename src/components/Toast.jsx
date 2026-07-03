import React, { useState, useEffect, createContext, useContext } from 'react';
import '../styles/Toast.css';

const ToastContext = createContext(null);

const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast ${type}`}>
      <div className="toast-content">{message}</div>
      <button className="toast-close" onClick={onClose}>✕</button>
    </div>
  );
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 3000) => {
    setToasts(prev => {
      // Deduplicate: skip if an identical toast (same message + type) is
      // already on screen. This prevents spam when a button is clicked
      // repeatedly or a polling loop fires the same warning many times.
      const isDuplicate = prev.some(t => t.message === message && t.type === type);
      if (isDuplicate) return prev;

      const id = Date.now() + Math.floor(Math.random() * 1000);
      return [...prev, { id, message, type, duration }];
    });
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            duration={t.duration}
            onClose={() => removeToast(t.id)}
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
