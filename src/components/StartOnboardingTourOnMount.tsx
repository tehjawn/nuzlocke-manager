"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  writeOnboardingActive,
  writeOnboardingStep,
} from "@/lib/onboarding";

/**
 * Starts the overlay welcome tour when landing with `?tour=1` after /new-trainer.
 * Strips the query so refreshes don’t re-fire mid-tour.
 */
export function StartOnboardingTourOnMount() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldStart = searchParams.get("tour") === "1";

  useEffect(() => {
    if (!shouldStart) return;
    writeOnboardingStep(0);
    writeOnboardingActive(true);
    // Soft-notify LoggedInChrome if it’s already mounted without the active flag.
    window.dispatchEvent(new CustomEvent("nuzlocke-start-onboarding-tour"));
    const url = new URL(window.location.href);
    url.searchParams.delete("tour");
    router.replace(`${url.pathname}${url.search}${url.hash}`);
  }, [shouldStart, router]);

  return null;
}
