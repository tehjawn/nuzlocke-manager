"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { completeFirstRunAction } from "@/app/actions/notifications";
import { writeOnboardingActive } from "@/lib/onboarding";

type CompleteFirstRunLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/**
 * Marks welcome/first-run complete, then navigates. Used when leaving Get Started
 * for the full league board so SeasonTabs chrome unlocks on the next render.
 */
export function CompleteFirstRunLink({
  href,
  className,
  children,
}: CompleteFirstRunLinkProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <Link
        href={href}
        className={className}
        aria-busy={pending || undefined}
        onClick={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              const result = await completeFirstRunAction();
              if (!result.ok) {
                setError(result.error || "Couldn’t finish Get Started");
                return;
              }
              writeOnboardingActive(false);
              router.push(href);
              router.refresh();
            } catch {
              setError("Couldn’t finish Get Started — try again");
            }
          });
        }}
      >
        {children}
      </Link>
      {error ? (
        <p className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </span>
  );
}
