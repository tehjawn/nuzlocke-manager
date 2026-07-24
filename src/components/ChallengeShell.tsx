import type { ReactNode } from "react";
import { ChallengeNav } from "@/components/ChallengeNav";
import { SiteHeader } from "@/components/SiteHeader";

type ChallengeShellProps = {
  slug: string;
  name: string;
  year: number;
  showGm?: boolean;
  myTrainerId?: string | null;
  children: ReactNode;
};

export function ChallengeShell({
  slug,
  name,
  year,
  showGm = false,
  myTrainerId = null,
  children,
}: ChallengeShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={slug}
        challengeName={name}
        showGm={showGm}
        myTrainerId={myTrainerId}
      />
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pb-16 pt-2 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 hidden font-display text-[11px] font-bold tracking-[0.18em] text-muted uppercase lg:block">
            Season menu
          </p>
          <ChallengeNav slug={slug} year={year} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
