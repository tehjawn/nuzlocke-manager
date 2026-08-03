"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
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

  return (
    <Link
      href={href}
      className={className}
      aria-busy={pending || undefined}
      onClick={(event) => {
        event.preventDefault();
        startTransition(async () => {
          writeOnboardingActive(false);
          await completeFirstRunAction();
          router.push(href);
          router.refresh();
        });
      }}
    >
      {children}
    </Link>
  );
}
