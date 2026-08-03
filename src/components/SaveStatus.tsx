"use client";

import { useEffect, useRef, useState } from "react";
import { pushSnackbar } from "@/components/Snackbar";
import { displayActionError } from "@/lib/action-error-display";

export type SaveStatusKind = "idle" | "saving" | "saved" | "error";

export type SaveStatusState = {
  kind: SaveStatusKind;
  message?: string;
};

export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatusState>({ kind: "idle" });
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  function markSaving(message = "Saving…") {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setStatus({ kind: "saving", message });
  }

  function markSaved(message = "Saved") {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setStatus({ kind: "saved", message });
    pushSnackbar(message, "success");
    clearTimer.current = setTimeout(() => {
      setStatus({ kind: "idle" });
    }, 400);
  }

  function markError(message: string) {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    const safe = displayActionError(message);
    setStatus({ kind: "error", message: safe });
    pushSnackbar(safe, "error");
  }

  function reset() {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setStatus({ kind: "idle" });
  }

  return { status, markSaving, markSaved, markError, reset };
}

type SaveStatusProps = {
  status: SaveStatusState;
  /** Use on green frame titles where accent-deep / danger lack contrast. */
  onAccent?: boolean;
};

/**
 * Inline working state only — success/error surface via snackbar.
 */
export function SaveStatus({ status, onAccent = false }: SaveStatusProps) {
  if (status.kind !== "saving") return null;

  const tone = onAccent ? "text-white/80" : "text-muted";

  return (
    <p className={`text-xs font-bold ${tone}`} role="status" aria-live="polite">
      {status.message ?? "Saving…"}
    </p>
  );
}
