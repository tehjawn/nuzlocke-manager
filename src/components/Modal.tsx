"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[#1e2a24]/55"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-md border-4 border-frame bg-surface shadow-[6px_6px_0_var(--shadow)] outline-none sm:rounded-sm ${
          wide ? "sm:max-w-3xl" : "sm:max-w-xl"
        }`}
      >
        <header className="gba-frame-title flex items-center justify-between gap-3 px-3 py-2">
          <h2 id={titleId} className="text-sm font-bold tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="pressable rounded-sm bg-white/15 px-2 py-1 text-xs font-bold uppercase"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t-2 border-frame/30 bg-surface-2 px-3 py-3 sm:px-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
