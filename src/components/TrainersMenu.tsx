"use client";

import { HeaderMenu, type HeaderMenuItem } from "@/components/HeaderMenu";
import { MyTrainerIcon, TrainersIcon } from "@/components/nav-icons";

type TrainersMenuProps = {
  slug: string;
  /** When set, include the accented My Trainer row. */
  myTrainerId?: string | null;
};

/**
 * League board + personal board under one header pill (#287).
 *
 * Empty-state preference: keep the Trainers trigger whenever season chrome is
 * shown so All Trainers stays one click away before joining. Only the My Trainer
 * row is gated on `myTrainerId` (same join gate as the old accent pill). Callers
 * that want the old “no pill until joined” behavior can omit this menu when
 * `myTrainerId` is null.
 */
export function TrainersMenu({ slug, myTrainerId = null }: TrainersMenuProps) {
  const base = `/challenges/${slug}`;
  const items: HeaderMenuItem[] = [];
  if (myTrainerId) {
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
      menuClassName="w-56"
      triggerClassName="pressable inline-flex h-9 items-center gap-2 border border-accent/55 bg-accent/10 px-3.5 font-medium text-accent-deep hover:border-accent hover:bg-accent/16"
      iconClassName="text-accent-deep"
      chevronClassName="text-accent-deep"
      items={items}
    />
  );
}
