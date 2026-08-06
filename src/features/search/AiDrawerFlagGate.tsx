import { AiDrawerFlagSync } from "@/features/search/AiDrawerFlagSync";
import { aiDrawerFlag } from "@/flags";

/**
 * Server-side `ai-drawer` evaluation, isolated so the root layout can keep it
 * behind <Suspense> (#313).
 *
 * The Vercel Flags adapter reads request headers/cookies — so this component is
 * uncached by construction. Everything it renders is a null-output client sync,
 * which is why confining it here leaves the rest of the tree prerenderable.
 */
export async function AiDrawerFlagGate() {
  const enabled = await aiDrawerFlag();
  return <AiDrawerFlagSync enabled={enabled} />;
}
