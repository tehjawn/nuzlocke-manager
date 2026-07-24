"use client";

import { useEffect, useRef, useState } from "react";

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
    clearTimer.current = setTimeout(() => {
      setStatus({ kind: "idle" });
    }, 2200);
  }

  function markError(message: string) {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setStatus({ kind: "error", message });
  }

  function reset() {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setStatus({ kind: "idle" });
  }

  return { status, markSaving, markSaved, markError, reset };
}

export function SaveStatus({ status }: { status: SaveStatusState }) {
  if (status.kind === "idle") return null;

  const tone =
    status.kind === "error"
      ? "text-danger"
      : status.kind === "saving"
        ? "text-muted"
        : "text-accent-deep";

  return (
    <p className={`text-xs font-bold ${tone}`} role="status" aria-live="polite">
      {status.message ??
        (status.kind === "saving"
          ? "Saving…"
          : status.kind === "saved"
            ? "Saved"
            : "Error")}
    </p>
  );
}
