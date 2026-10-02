import { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

let _toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast toast-${t.type}`}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              layout
            >
              <span className="toast-icon" aria-hidden="true">
                {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '⚠'}
              </span>
              <span className="toast-msg">{t.message}</span>
              <button
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <style>{`
        .toast-stack {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: none;
        }
        .toast {
          pointer-events: all;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: var(--radius);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          font-size: 14px;
          font-family: var(--font-sans);
          max-width: 360px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          border: 1px solid;
        }
        .toast-success {
          background: rgba(22, 163, 74, 0.15);
          border-color: rgba(22, 163, 74, 0.3);
          color: var(--success);
        }
        .toast-error {
          background: rgba(220, 38, 38, 0.15);
          border-color: rgba(220, 38, 38, 0.3);
          color: var(--danger);
        }
        .toast-warning {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.3);
          color: var(--warning);
        }
        .toast-icon { font-size: 13px; font-weight: 700; flex-shrink: 0; }
        .toast-msg { flex: 1; color: var(--text); }
        .toast-close {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
          transition: color var(--transition);
        }
        .toast-close:hover { color: var(--text); }
        @media (max-width: 640px) {
          .toast-stack {
            bottom: 80px;
            left: 16px;
            right: 16px;
          }
          .toast { max-width: 100%; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
