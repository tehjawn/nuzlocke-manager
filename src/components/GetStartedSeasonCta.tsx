import Link from "next/link";
import { CTA_PRIMARY } from "@/lib/cta";

type GetStartedSeasonCtaProps = {
  slug: string;
};

/** Primary Get Started CTA in General info. */
export function GetStartedSeasonCta({ slug }: GetStartedSeasonCtaProps) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <Link
        href={`/challenges/${slug}/setup`}
        data-tour="cta-setup"
        className={`${CTA_PRIMARY} w-full justify-center`}
      >
        Get Started →
      </Link>
    </div>
  );
}
