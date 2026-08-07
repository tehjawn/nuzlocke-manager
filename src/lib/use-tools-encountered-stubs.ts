"use client";

import { useEffect, useState } from "react";
import { fetchToolsEncounteredStubsAction } from "@/app/actions/tools-pokemon";
import type { TrainerProfile } from "@/lib/challenge-types";
import {
  mergeToolsEncounteredStubs,
  type ToolsHydrateTrainerSlice,
} from "@/lib/tools-pokemon-hydrate";

type StubsCache = {
  slug: string;
  trainers: ToolsHydrateTrainerSlice[];
};

/**
 * Deferred ENCOUNTERED stubs for Tools surfaces that need “seen” status (#382).
 * Tools SSR ships owned slots only; enable when tracker / Pokédex paints
 * encounter state. Caches per slug so toggling Ownership modes doesn’t refetch.
 */
export function useToolsEncounteredStubs(slug: string, enabled: boolean) {
  const [cache, setCache] = useState<StubsCache | null>(null);
  const [failedSlug, setFailedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (cache?.slug === slug || failedSlug === slug) return;

    let cancelled = false;
    void (async () => {
      const result = await fetchToolsEncounteredStubsAction({ slug });
      if (cancelled) return;
      if (result.ok) {
        setCache({ slug, trainers: result.trainers });
        setFailedSlug(null);
      } else {
        setFailedSlug(slug);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, slug, cache, failedSlug]);

  const ready = !enabled || cache?.slug === slug || failedSlug === slug;

  function withStubs(owned: TrainerProfile[]): TrainerProfile[] {
    if (!cache || cache.slug !== slug) return owned;
    return mergeToolsEncounteredStubs(owned, cache.trainers);
  }

  return { ready, withStubs };
}
