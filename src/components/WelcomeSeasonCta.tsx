"use client";

import { useState } from "react";
import { WelcomeModal } from "@/components/WelcomeModal";

export function WelcomeSeasonCta() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable mt-4 inline-flex w-full items-center justify-center rounded-lg border-accent/40 bg-accent px-3.5 py-2 text-sm font-semibold text-[var(--on-accent)] sm:w-auto"
      >
        Welcome to Season 2026
      </button>
      <WelcomeModal open={open} onDismiss={() => setOpen(false)} />
    </>
  );
}
