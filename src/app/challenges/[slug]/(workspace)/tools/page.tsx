import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ToolsView } from "@/components/ToolsView";
import { getChallenge } from "@/lib/challenges";
import { canViewCompetitiveDetails } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getAccessForChallenge } from "@/lib/permissions";
import { redactTrainerCompetitiveDetails } from "@/lib/pokemon-privacy";
import {
  parseToolsId,
  toolsTitle,
  type ToolsId,
} from "@/lib/tools-routes";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tool?: string;
    tab?: string;
    a?: string;
    b?: string;
    id?: string;
  }>;
};

function resolveTool(
  tool: string | undefined,
  tab: string | undefined,
  hasCompareIds: boolean,
): ToolsId | null {
  const parsed = parseToolsId(tool, tab);
  if (parsed) return parsed;
  // Legacy /compare redirects land with ?a=&b= and no tool.
  if (hasCompareIds) return "compare";
  return null;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { tool, tab, a, b } = await searchParams;
  const challenge = await getChallenge(slug);
  if (!challenge) return { title: "Tools" };

  const resolved = resolveTool(tool, tab, Boolean(a || b));
  if (!resolved) return { title: `Tools · ${challenge.name}` };
  return {
    title: `${toolsTitle(resolved)} · Tools · ${challenge.name}`,
  };
}

export default async function ToolsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { tool, tab, a, b, id } = await searchParams;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
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

  const initialTool = resolveTool(tool, tab, Boolean(a || b));
  const dexIdRaw = id != null ? Number(id) : NaN;
  const initialDexId =
    Number.isFinite(dexIdRaw) && dexIdRaw > 0 ? dexIdRaw : null;

  return (
    <Suspense
      fallback={<p className="text-sm text-muted">Loading tools…</p>}
    >
      <ToolsView
        slug={challenge.slug}
        challengeName={challenge.name}
        trainers={trainers}
        badges={challenge.badges}
        myTrainerId={myTrainerId}
        signedIn={Boolean(session?.user)}
        initialTool={initialTool}
        initialCompareA={a}
        initialCompareB={b}
        initialDexId={initialDexId}
      />
    </Suspense>
  );
}
