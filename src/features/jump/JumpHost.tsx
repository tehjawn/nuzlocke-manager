"use client";

import type { ReactNode } from "react";
import { JumpPalette } from "@/features/jump/JumpPalette";
import { JumpProvider } from "@/features/jump/JumpProvider";

/** Root mount: provider + portal palette above the whole app. */
export function JumpHost({ children }: { children: ReactNode }) {
  return (
    <JumpProvider>
      {children}
      <JumpPalette />
    </JumpProvider>
  );
}
