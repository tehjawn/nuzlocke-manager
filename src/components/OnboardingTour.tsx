"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";
import {
  ONBOARDING_STEPS,
  onboardingStepIndex,
} from "@/lib/onboarding";

type OnboardingTourProps = {
  open: boolean;
  onDismiss: () => void;
};

export function OnboardingTour({ open, onDismiss }: OnboardingTourProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const titleId = useId();
  const matched = onboardingStepIndex(pathname);
  const [stepIndex, setStepIndex] = useState(() =>
    matched >= 0 ? matched : 0,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (matched >= 0) setStepIndex(matched);
  }, [open, matched]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "12rem";
    return () => {
      document.body.style.paddingBottom = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const step = ONBOARDING_STEPS[stepIndex] ?? ONBOARDING_STEPS[0];
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= ONBOARDING_STEPS.length - 1;
  const onTourPage = matched === stepIndex;

  function goTo(index: number) {
    const target = ONBOARDING_STEPS[index];
    if (!target) return;
    setStepIndex(index);
    if (!target.match(pathname)) {
      router.push(target.href);
    }
  }

  function onNext() {
    if (isLast) {
      onDismiss();
      return;
    }
    goTo(stepIndex + 1);
  }

  function onBack() {
    if (isFirst) return;
    goTo(stepIndex - 1);
  }

  function onContinue() {
    goTo(stepIndex);
  }

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      role="region"
      aria-labelledby={titleId}
    >
      <div className="pointer-events-auto gba-frame w-full max-w-lg shadow-[0_-8px_32px_rgba(0,0,0,0.18)]">
        <header className="gba-frame-title relative z-[1] flex items-center justify-between gap-3 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Tour · {stepIndex + 1} of {ONBOARDING_STEPS.length}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="pressable border-interactive/35 bg-interactive-soft px-2.5 py-1 text-xs font-semibold text-ink"
          >
            Skip
          </button>
        </header>

        <div className="relative z-[1] space-y-3 px-4 py-4 sm:px-5">
          <div className="flex gap-1.5" aria-hidden>
            {ONBOARDING_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 flex-1 rounded-sm ${
                  i <= stepIndex ? "bg-accent" : "bg-surface-2"
                }`}
              />
            ))}
          </div>

          <div>
            <h2
              id={titleId}
              className="text-base font-semibold tracking-tight text-ink"
            >
              {step.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {step.body}
            </p>
          </div>

          {!onTourPage ? (
            <p className="text-xs font-medium text-accent-deep">
              You&apos;re off the tour path — continue to jump back to this step.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onBack}
              disabled={isFirst}
              className={`${CTA_SECONDARY_SM} disabled:opacity-40`}
            >
              Back
            </button>
            <div className="flex flex-wrap gap-2">
              {!onTourPage ? (
                <button
                  type="button"
                  onClick={onContinue}
                  className={CTA_SECONDARY_SM}
                >
                  Continue →
                </button>
              ) : null}
              <button type="button" onClick={onNext} className={CTA_PRIMARY_SM}>
                {isLast ? "Let’s go!" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
