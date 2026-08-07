"use client";

import { HeaderMenu, type HeaderMenuItem } from "@/components/HeaderMenu";
import { MyTrainerIcon, TrainersIcon } from "@/components/nav-icons";

type TrainersMenuProps = {
  slug: string;
  /** Include the accented My Trainer row. Signed-in viewers only. */
  showMyTrainer?: boolean;
  className?: string;
};

/**
 * League board + personal board under one header pill (#287).
 *
 * Empty-state preference: keep the Trainers trigger whenever season chrome is
 * shown so All Trainers stays one click away before joining.
 *
 * My Trainer lives here and nowhere else in the top bar. It used to fall back to
 * a standalone accent pill in AuthButtons whenever the header lacked a resolved
 * `myTrainerId` — which is every global page, since the header shell is static
 * and cannot read auth. That produced the duplicate on the homepage: a pill next
 * to a Trainers menu missing its own My Trainer row. The menu now renders inside
 * SiteHeaderSession, which already awaits auth, so the row can be gated on the
 * session instead of on a prop the shell can't know.
 */
export function TrainersMenu({
  slug,
  showMyTrainer = false,
  className = "",
}: TrainersMenuProps) {
  const base = `/challenges/${slug}`;
  const items: HeaderMenuItem[] = [];
  if (showMyTrainer) {
    items.push({
      href: `${base}/me`,
      label: "My Trainer",
      description: "Your board",
      icon: <MyTrainerIcon className="h-4 w-4" />,
      accent: true,
    });
  }
  items.push({
    href: base,
    label: "All Trainers",
    description: "League board",
    icon: <TrainersIcon className="h-4 w-4" />,
  });

  return (
    <HeaderMenu
      label="Trainers"
      icon={<TrainersIcon className="h-4 w-4" />}
      className={className}
      menuClassName="w-56"
      triggerClassName="pressable inline-flex h-9 items-center gap-2 border border-accent/55 bg-accent/10 px-3.5 font-medium text-accent-deep hover:border-accent hover:bg-accent/16"
      iconClassName="text-accent-deep"
      chevronClassName="text-accent-deep"
      items={items}
    />
  );
}
