
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  addToast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`pointer-events-auto min-w-[300px] max-w-sm rounded-xl shadow-lg border p-4 flex items-start gap-3 animate-in slide-in-from-right-full fade-in duration-300 ${
              toast.type === 'success' ? 'bg-white border-green-200' :
              toast.type === 'error' ? 'bg-white border-red-200' :
              toast.type === 'warning' ? 'bg-white border-orange-200' :
              'bg-white border-blue-200'
            }`}
          >
            <div className={`mt-0.5 ${
               toast.type === 'success' ? 'text-green-500' :
               toast.type === 'error' ? 'text-red-500' :
               toast.type === 'warning' ? 'text-orange-500' :
               'text-blue-500'
            }`}>
              {toast.type === 'success' && <CheckCircle2 size={18} />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'warning' && <AlertTriangle size={18} />}
              {toast.type === 'info' && <Info size={18} />}
            </div>
            <div className="flex-1">
              <h4 className={`text-sm font-bold ${
                 toast.type === 'success' ? 'text-green-800' :
                 toast.type === 'error' ? 'text-red-800' :
                 toast.type === 'warning' ? 'text-orange-800' :
                 'text-gray-800'
              }`}>{toast.title}</h4>
              {toast.message && <p className="text-xs text-gray-500 mt-1">{toast.message}</p>}
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
