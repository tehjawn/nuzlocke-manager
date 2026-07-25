"use client";

import type { ReactNode } from "react";
import { JumpPalette } from "@/features/jump/JumpPalette";
import { JumpProvider } from "@/features/jump/JumpProvider";
import type { JumpSeasonContext } from "@/features/jump/jump-types";

/** Root mount: provider + portal palette above the whole app. */
export function JumpHost({
  children,
  defaultSeason = null,
}: {
  children: ReactNode;
  defaultSeason?: JumpSeasonContext | null;
}) {
  return (
    <JumpProvider defaultSeason={defaultSeason}>
      {children}
      <JumpPalette />
    </JumpProvider>
  );
}
