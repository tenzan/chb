import { useEffect, type ReactNode } from "react";

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  maxWidth?: number;
  children: ReactNode;
}

export function Modal({ title, onClose, maxWidth, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="jr-modal-backdrop" onClick={onClose}>
      <div
        className="jr-modal"
        role="dialog"
        aria-modal="true"
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jr-modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmLabel, busy, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="jr-confirm-text">{message}</div>
      <div className="jr-modal-actions">
        <button className="jr-btn-secondary" onClick={onCancel}>Отмена</button>
        <button className="jr-btn-danger" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
