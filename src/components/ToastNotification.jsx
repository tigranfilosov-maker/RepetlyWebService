import { useEffect } from "react";

export function ToastNotification({ toast, onClose }) {
  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) {
    return null;
  }

  return (
    <div className={`toast-notification toast-notification--${toast.type}`} role="status" aria-live="polite">
      <strong>{toast.type === "success" ? "Готово" : "Ошибка"}</strong>
      <span>{toast.message}</span>
    </div>
  );
}
