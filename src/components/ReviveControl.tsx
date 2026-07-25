"use client";

import type { ReactNode } from "react";

type ReviveControlProps = {
  used: boolean;
  /** Owner can spend the token. */
  canUse?: boolean;
  /** GM can reset a spent token. */
  canReset?: boolean;
  disabled?: boolean;
  onUse: () => void;
  onReset: () => void;
  /** Optional save-status / hint beside the control. */
  status?: ReactNode;
  className?: string;
};

/**
 * Single revive control: ready → clickable use; used → status (GM can reset).
 */
export function ReviveControl({
  used,
  canUse = false,
  canReset = false,
  disabled = false,
  onUse,
  onReset,
  status,
  className = "",
}: ReviveControlProps) {
  const interactiveUse = !used && canUse;
  const interactiveReset = used && canReset;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {interactiveUse ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onUse}
          className="pressable inline-flex h-9 items-center gap-1.5 border-accent/30 bg-accent/10 px-3 text-xs font-semibold tracking-tight text-accent-deep disabled:opacity-60"
        >
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          Revive ready
        </button>
      ) : interactiveReset ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onReset}
          className="pressable inline-flex h-9 items-center gap-1.5 border-danger/25 bg-danger/10 px-3 text-xs font-semibold tracking-tight text-danger disabled:opacity-60"
          title="Reset revive token"
        >
          <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />
          Revive used · Reset
        </button>
      ) : (
        <div
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold tracking-tight ${
            used
              ? "border-danger/25 bg-danger/10 text-danger"
              : "border-accent/30 bg-accent/10 text-accent-deep"
          }`}
          role="status"
        >
          <span
            className={`h-2 w-2 rounded-full ${used ? "bg-danger" : "bg-accent"}`}
            aria-hidden
          />
          Revive {used ? "used" : "ready"}
        </div>
      )}
      {status}
    </div>
  );
}
