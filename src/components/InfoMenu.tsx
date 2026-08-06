"use client";

import { HeaderMenu } from "@/components/HeaderMenu";
import {
  AboutIcon,
  ActivityIcon,
  FaqIcon,
  GetStartedIcon,
  RulesIcon,
} from "@/components/nav-icons";

type InfoMenuProps = {
  slug: string;
};

/**
 * Orientation destinations under one header pill (#287): Get Started, About,
 * Rules, FAQ, Activity. FAQ deep-links the rules page FAQ tab (`?tab=faq`);
 * `/faq` also redirects there. Get Started is accented as the primary setup CTA.
 */
export function InfoMenu({ slug }: InfoMenuProps) {
  const base = `/challenges/${slug}`;
  return (
    <HeaderMenu
      label="Info"
      icon={<AboutIcon className="h-4 w-4" />}
      menuClassName="w-56"
      items={[
        {
          href: `${base}/setup`,
          label: "Get Started",
          description: "ROM, Afterplay & save",
          icon: <GetStartedIcon className="h-4 w-4" />,
          accent: true,
        },
        {
          href: `${base}/about`,
          label: "About",
          description: "Season overview",
          icon: <AboutIcon className="h-4 w-4" />,
        },
        {
          href: `${base}/rules`,
          label: "Rules",
          description: "Challenge ruleset",
          icon: <RulesIcon className="h-4 w-4" />,
        },
        {
          href: `${base}/rules?tab=faq`,
          label: "FAQ",
          description: "Common questions",
          icon: <FaqIcon className="h-4 w-4" />,
        },
        {
          href: `${base}/activity`,
          label: "Activity",
          description: "Season feed",
          icon: <ActivityIcon className="h-4 w-4" />,
        },
      ]}
    />
  );
}
