import { useState, useCallback, createContext, useContext } from "react";
import { IconCheck, IconAlertTriangle, IconX } from "./Icons";

const ToastContext = createContext({ toast: () => {} });

let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "success") => {
    const id = ++counter;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const dismiss = id => setToasts(current => current.filter(item => item.id !== id));

  return (
    <ToastContext.Provider value={{ toast, toasts, dismiss }}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function ToastViewport() {
  const { toasts = [], dismiss = () => {} } = useContext(ToastContext);
  return <div className="toast-stack fixed bottom-20 md:bottom-5 right-4 left-4 md:left-auto space-y-2 z-50 pointer-events-none">
    {toasts.map(t => <div key={t.id} role={t.type === "error" ? "alert" : "status"}
      className="flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm pointer-events-auto max-w-md break-words"
      style={{ background: t.type === "error" ? "var(--danger-bg)" : t.type === "info" ? "var(--info-bg)" : "var(--success-bg)",
        color: t.type === "error" ? "var(--danger)" : t.type === "info" ? "var(--info)" : "var(--success)", border: "1px solid currentColor" }}>
      {t.type === "error" ? <IconAlertTriangle size={16} /> : <IconCheck size={16} />}
      <span className="min-w-0 flex-1">{t.message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="px-2 py-1 rounded font-semibold"><IconX size={14} /></button>
    </div>)}
  </div>;

}
