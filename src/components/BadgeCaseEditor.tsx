"use client";

import { useTransition } from "react";
import { setBadgeProgressAction } from "@/app/actions/challenge";
import { BadgeCase } from "@/components/BadgeCase";
import type { BadgeDefinition } from "@/lib/challenge-types";

type BadgeCaseEditorProps = {
  trainerId: string;
  badges: BadgeDefinition[];
  earnedKeys: string[];
  compact?: boolean;
};

export function BadgeCaseEditor({
  trainerId,
  badges,
  earnedKeys,
  compact,
}: BadgeCaseEditorProps) {
  const [pending, startTransition] = useTransition();

  return (
    <BadgeCase
      badges={badges}
      earnedKeys={earnedKeys}
      compact={compact}
      pending={pending}
      onToggle={(badgeKey, earned) => {
        startTransition(async () => {
          await setBadgeProgressAction({ trainerId, badgeKey, earned });
        });
      }}
    />
  );
}
