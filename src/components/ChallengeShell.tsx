import type { ReactNode } from "react";
import { ChallengeNav } from "@/components/ChallengeNav";
import { SiteHeader } from "@/components/SiteHeader";

type ChallengeShellProps = {
  slug: string;
  name: string;
  year: number;
  showGm?: boolean;
  myTrainerId?: string | null;
  /** Wider canvas for the league board (trainers + feed). */
  wide?: boolean;
  children: ReactNode;
};

export function ChallengeShell({
  slug,
  name,
  year,
  showGm = false,
  myTrainerId = null,
  wide = false,
  children,
}: ChallengeShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={slug}
        challengeName={name}
        showGm={showGm}
        myTrainerId={myTrainerId}
        wide={wide}
      />
      <div
        className={`mx-auto grid w-full flex-1 gap-5 px-4 pb-16 pt-2 sm:px-6 lg:grid-cols-[168px_minmax(0,1fr)] lg:gap-6 ${
          wide ? "max-w-7xl" : "max-w-6xl"
        }`}
      >
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 hidden font-display text-[11px] font-bold tracking-[0.18em] text-muted uppercase lg:block">
            Season
          </p>
          <ChallengeNav slug={slug} year={year} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
