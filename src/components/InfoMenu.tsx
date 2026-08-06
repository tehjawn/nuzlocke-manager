"use client";

import { HeaderMenu } from "@/components/HeaderMenu";
import { AboutIcon, FaqIcon, RulesIcon } from "@/components/nav-icons";

type InfoMenuProps = {
  slug: string;
};

/**
 * Orientation destinations under one header pill (#287): About, Rules, FAQ.
 * FAQ deep-links the rules page FAQ tab (`?tab=faq`); `/faq` also redirects there.
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
      ]}
    />
  );
}
