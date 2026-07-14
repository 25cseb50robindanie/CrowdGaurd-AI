import React, { useEffect } from 'react';

export default function Toast({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onClose={() => onRemove(toast.id)} 
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="bg-surface-container-highest/95 backdrop-blur border border-primary-container text-on-surface px-4 py-3 rounded-lg shadow-2xl flex items-center justify-between gap-4 pointer-events-auto animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
          <span className="material-symbols-outlined text-lg">notifications_active</span>
        </div>
        <div>
          <p className="font-body-md font-bold text-sm text-primary">Station Dispatch</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{toast.message}</p>
        </div>
      </div>
      <button 
        onClick={onClose} 
        className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
}
