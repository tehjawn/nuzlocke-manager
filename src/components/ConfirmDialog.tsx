"use client";

import { useCallback, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions (delete, spend revive). */
  tone?: "danger" | "primary";
};

type ConfirmDialogProps = ConfirmOptions & {
  open: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Compact in-app confirm — replaces window.confirm for destructive / spendy actions.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();

  if (!open || typeof document === "undefined") return null;

  const confirmClass =
    tone === "danger"
      ? "pressable btn-cta btn-cta-sm border-danger/40 bg-danger text-white hover:brightness-105"
      : CTA_PRIMARY_SM;

  return createPortal(
    <div
      data-modal-open=""
      className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onCancel();
      }}
    >
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 cursor-pointer bg-[var(--scrim)] backdrop-blur-[2px]"
        disabled={pending}
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        autoFocus
        className="gba-frame relative z-10 w-full max-w-md overflow-hidden outline-none sm:rounded-xl"
      >
        <div className="relative z-[1] space-y-3 p-4 sm:p-5">
          <h2 id={titleId} className="text-base font-bold tracking-tight">
            {title}
          </h2>
          {description && (
            <p id={descId} className="text-sm leading-relaxed text-muted">
              {description}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              className={CTA_SECONDARY_SM}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              className={`${confirmClass} disabled:opacity-60`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type PendingConfirm = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

/** Promise-based confirm for async click handlers. */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const dialog = (
    <ConfirmDialog
      open={pending != null}
      title={pending?.title ?? ""}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      tone={pending?.tone}
      onCancel={() => {
        pending?.resolve(false);
        setPending(null);
      }}
      onConfirm={() => {
        pending?.resolve(true);
        setPending(null);
      }}
    />
  );

  return { confirm, dialog };
}
