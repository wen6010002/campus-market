'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  sm?: boolean;
  children: React.ReactNode;
}

/** 通用弹窗（对应原型 .modal-mask > .modal） */
export function Modal({ open, onClose, sm, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-mask show" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${sm ? 'sm' : ''}`}>{children}</div>
    </div>,
    document.body,
  );
}

export function ModalHead({
  title,
  sub,
  onClose,
}: {
  title: string;
  sub?: string;
  onClose?: () => void;
}) {
  return (
    <div className="modal-head">
      <div>
        <h3>{title}</h3>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {onClose ? (
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
      ) : null}
    </div>
  );
}

export function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="modal-body">{children}</div>;
}

export function ModalFoot({ children }: { children: React.ReactNode }) {
  return <div className="modal-foot">{children}</div>;
}
