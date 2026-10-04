import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const AUTO_DISMISS_MS = 4000;

const VARIANTS = {
  success: {
    container: 'bg-emerald-900 text-emerald-50 border-emerald-700',
    icon: 'check_circle',
    role: 'status',
  },
  error: {
    container: 'bg-rose-900 text-rose-50 border-rose-700',
    icon: 'error',
    role: 'alert',
  },
  info: {
    container: 'bg-primary text-on-primary border-primary-container',
    icon: 'info',
    role: 'status',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (msg, type = 'success') => {
      if (!msg) return;
      const id = ++idRef.current;
      const variant = VARIANTS[type] ? type : 'info';
      setToasts((prev) => [...prev.slice(-2), { id, msg: String(msg), type: variant }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      );
    },
    [dismiss]
  );

  const success = useCallback((msg) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg) => toast(msg, 'error'), [toast]);
  const info = useCallback((msg) => toast(msg, 'info'), [toast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ toast, success, error, info, dismiss, toasts }),
    [toast, success, error, info, dismiss, toasts]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function Toaster({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2 max-w-[calc(100vw-3rem)] pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const variant = VARIANTS[t.type] || VARIANTS.info;
        return (
          <div
            key={t.id}
            role={variant.role}
            className={`pointer-events-auto px-4 py-2.5 rounded shadow-lg flex items-center gap-2 border text-[13px] font-medium ${variant.container}`}
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">{variant.icon}</span>
            <span className="leading-snug">{t.msg}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 p-0.5 rounded opacity-70 hover:opacity-100 focus:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
