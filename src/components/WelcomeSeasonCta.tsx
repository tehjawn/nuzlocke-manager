"use client";

import { useState } from "react";
import { WelcomeModal } from "@/components/WelcomeModal";
import { CTA_PRIMARY } from "@/lib/cta";

export function WelcomeSeasonCta() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${CTA_PRIMARY} mt-4 w-full sm:w-auto`}
      >
        Welcome to Season 2026
      </button>
      <WelcomeModal open={open} onDismiss={() => setOpen(false)} />
    </>
  );
}
