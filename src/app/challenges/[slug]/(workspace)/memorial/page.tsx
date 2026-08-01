import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { MemorialBoard } from "@/components/MemorialBoard";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { getChallenge } from "@/lib/challenges";
import { canEditTrainerBoard } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getAccessForChallenge } from "@/lib/permissions";
import { isSeasonReadOnly } from "@/lib/season-status";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) return { title: "Memorial" };
  return { title: `Memorial · ${challenge.name}` };
}

export default async function MemorialPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const gmLensOn = access?.isGm
    ? await readGmLensOn(challenge.slug)
    : false;
  const seasonReadOnly = isSeasonReadOnly(challenge.status);
  const editableTrainerIds = challenge.trainers
    .filter((trainer) =>
      canEditTrainerBoard(
        access,
        trainer.userId,
        gmLensOn,
        seasonReadOnly,
      ),
    )
    .map((trainer) => trainer.id);

  return (
    <>
      <DataSourceBanner source={challenge.source} />
      <div className="mb-4">
        <SeasonStatusBanner slug={challenge.slug} status={challenge.status} />
      </div>
      <MemorialBoard
        challenge={challenge}
        editableTrainerIds={editableTrainerIds}
      />
    </>
  );
}
