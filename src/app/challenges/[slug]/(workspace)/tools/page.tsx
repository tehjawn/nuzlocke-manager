import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ToolsView } from "@/components/ToolsView";
import {
  getChallengeMeta,
  getChallengeToolsSummary,
} from "@/lib/challenges";
import { canViewCompetitiveDetails } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getAccessForChallenge } from "@/lib/permissions";
import { redactTrainerCompetitiveDetails } from "@/lib/pokemon-privacy";
import {
  isLegacyCompareUrl,
  legacyCompareHref,
  parseBountyMode,
  parsePlannerMode,
  parseToolsId,
  toolsTitle,
} from "@/lib/tools-routes";


type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tool?: string;
    tab?: string;
    a?: string;
    b?: string;
    id?: string;
    chapter?: string;
    mode?: string;
  }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { tool, tab, a, b } = await searchParams;
  const challenge = await getChallengeMeta(slug);
  if (!challenge) return { title: "Tools" };

  // Metadata resolves before the page's redirect, so match the destination.
  const resolved = isLegacyCompareUrl({ a, b, tab, tool })
    ? "planner"
    : parseToolsId(tool, tab);
  if (!resolved) return { title: `Tools · ${challenge.name}` };
  return {
    title: `${toolsTitle(resolved)} · Tools · ${challenge.name}`,
  };
}

export default async function ToolsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { tool, tab, a, b, id, mode } = await searchParams;
  if (isLegacyCompareUrl({ a, b, tab, tool })) {
    redirect(legacyCompareHref(slug));
  }
  const session = await auth();
  const challenge = await getChallengeToolsSummary(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const gmLensOn = access?.isGm
    ? await readGmLensOn(challenge.slug)
    : false;

  const trainers = challenge.trainers.map((trainer) =>
    canViewCompetitiveDetails(access, trainer.userId, gmLensOn)
      ? trainer
      : redactTrainerCompetitiveDetails(trainer),
  );

  const myTrainerId =
    challenge.trainers.find((t) => t.userId === session?.user?.id)?.id ?? null;

  const initialTool = parseToolsId(tool, tab);
  const dexIdRaw = id != null ? Number(id) : NaN;
  const initialDexId =
    Number.isFinite(dexIdRaw) && dexIdRaw > 0 ? dexIdRaw : null;
  const initialBountyMode =
    initialTool === "bounty" ? parseBountyMode(mode) : null;
  const initialPlannerMode =
    initialTool === "planner" ? parsePlannerMode(mode) : null;

  return (
    <Suspense
      fallback={<p className="text-sm text-muted">Loading tools…</p>}
    >
      <ToolsView
        slug={challenge.slug}
        challengeName={challenge.name}
        trainers={trainers}
        myTrainerId={myTrainerId}
        signedIn={Boolean(session?.user)}
        initialTool={initialTool}
        initialDexId={initialDexId}
        initialBountyMode={initialBountyMode}
        initialPlannerMode={initialPlannerMode}
      />
    </Suspense>
  );
}
