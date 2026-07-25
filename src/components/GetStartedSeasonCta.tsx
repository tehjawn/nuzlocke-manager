import Link from "next/link";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/lib/cta";

type GetStartedSeasonCtaProps = {
  slug: string;
};

/** Primary + secondary CTAs in General info. */
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
      <Link
        href={`/challenges/${slug}/rules`}
        className={`${CTA_SECONDARY} w-full justify-center`}
      >
        Rules / FAQ
      </Link>
    </div>
  );
}
