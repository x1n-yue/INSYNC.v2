import { useEffect, useId, useRef } from "react";
import { IconX } from "./Icons";
import { ToastViewport } from "./Toast";

export default function Modal({ title, onClose, children, width = "460px", busy = false, drawer = false }) {
  const dialog = useRef(null), titleId = useId();
  useEffect(() => {
    const previous = document.activeElement, element = dialog.current;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby={titleId} aria-modal="true"
      className={`modal-overlay ${drawer ? "drawer-overlay" : ""}`}
      onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
      onClick={(e) => !busy && e.target === e.currentTarget && onClose()}
    >
      <div
        className={`dialog-panel w-full rounded-2xl shadow-xl overflow-hidden ${drawer ? "drawer-panel" : ""}`}
        style={{ maxWidth: width, background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            disabled={busy} aria-label={`Close ${title}`}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-lg transition-opacity hover:opacity-60"
            style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
          >
            <IconX size={17} />
          </button>
        </div>
        <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: "calc(90dvh - 72px)" }}>{children}</div>
      </div>
      <ToastViewport />
    </dialog>
  );
}
