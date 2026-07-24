"use client";

import { useState, useTransition } from "react";
import { claimTrainerAction } from "@/app/actions/challenge";

export function ClaimTrainerButton({
  slug,
  trainerId,
  handle,
}: {
  slug: string;
  trainerId: string;
  handle: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="pressable rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
        onClick={() => {
          startTransition(async () => {
            const result = await claimTrainerAction({ slug, trainerId });
            if (!result.ok) setError(result.error);
            else setError(null);
          });
        }}
      >
        Claim {handle}
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
