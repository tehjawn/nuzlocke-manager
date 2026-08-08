import Link from "next/link";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/lib/cta";

type GetStartedSeasonCtaProps = {
  slug: string;
  /** GM-only sibling for tournament authoring (#185). */
  isGm?: boolean;
};

/** Primary Get Started CTA in General info (+ optional GM tournament entry). */
export function GetStartedSeasonCta({
  slug,
  isGm = false,
}: GetStartedSeasonCtaProps) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <Link
        href={`/challenges/${slug}/setup`}
        data-tour="cta-setup"
        className={`${CTA_PRIMARY} w-full justify-center`}
      >
        Get Started →
      </Link>
      {isGm && (
        <Link
          href={`/challenges/${slug}/tournaments`}
          data-tour="cta-tournaments"
          className={`${CTA_SECONDARY} w-full justify-center`}
        >
          Manage Tournaments
        </Link>
      )}
    </div>
  );
}
