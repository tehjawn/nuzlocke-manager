"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { completeFirstRunAction } from "@/app/actions/notifications";
import { requestEndOnboardingTour } from "@/lib/onboarding";

type CompleteFirstRunLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/**
 * Marks welcome/first-run complete, ends any active tour, then navigates.
 * Used when leaving Get Started for the full league board so SeasonTabs chrome
 * unlocks on the next render.
 */
export function CompleteFirstRunLink({
  href,
  className,
  children,
}: CompleteFirstRunLinkProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <Link
        href={href}
        className={className}
        aria-busy={pending || undefined}
        onClick={(event) => {
          event.preventDefault();
          if (pending) return;
          setError(null);
          setPending(true);
          void (async () => {
            try {
              // End the tour first so its route-guard cannot yank us back to
              // the current step after we leave Get Started.
              requestEndOnboardingTour();
              const result = await completeFirstRunAction();
              if (!result.ok) {
                setError(result.error || "Couldn’t finish Get Started");
                return;
              }
              router.push(href);
              router.refresh();
            } catch {
              setError("Couldn’t finish Get Started — try again");
            } finally {
              setPending(false);
            }
          })();
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
