"use client";

import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  title: string;
  /** Optional line under the title (species · Lv, etc.). */
  subtitle?: ReactNode;
  /** Extra controls before Close (e.g. View / Edit toggle). */
  headerActions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** @deprecated Prefer `size="wide"`. */
  wide?: boolean;
  size?: "default" | "md" | "wide";
};

export function Modal({
  open,
  title,
  subtitle,
  headerActions,
  onClose,
  children,
  footer,
  wide = false,
  size,
}: ModalProps) {
  const titleId = useId();
  const resolvedSize = size ?? (wide ? "wide" : "default");
  const widthClass =
    resolvedSize === "wide"
      ? "sm:max-w-4xl"
      : resolvedSize === "md"
        ? "sm:max-w-2xl"
        : "sm:max-w-xl";

  if (!open || typeof document === "undefined") return null;

  // Portal above sticky rails / overflow parents; sit above body grain (z-80).
  return createPortal(
    <div
      data-modal-open=""
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-pointer bg-[var(--scrim)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        autoFocus
        className={`gba-frame relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden outline-none sm:rounded-xl ${widthClass}`}
      >
        <header className="gba-frame-title relative z-[1] flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="pressable border-interactive/35 bg-interactive-soft px-2.5 py-1 text-xs font-semibold text-ink"
            >
              Close
            </button>
          </div>
        </header>
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
        {footer ? (
          <footer className="relative z-[1] shrink-0 border-t border-frame/60 bg-surface-2/80 px-4 py-3 sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
