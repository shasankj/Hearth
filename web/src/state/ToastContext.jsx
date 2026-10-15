import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 0;

function useToastState() {
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((message, tone = 'info') => {
    const id = ++nextId;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3800);
  }, []);
  return [toasts, notify];
}

function ToastRegion({ toasts }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => <p key={t.id} className={`toast ${t.tone}`}>{t.message}</p>)}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, notify] = useToastState();
  const value = useMemo(() => ({ notify }), [notify]);
  return <ToastContext value={value}>{children}<ToastRegion toasts={toasts} /></ToastContext>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
