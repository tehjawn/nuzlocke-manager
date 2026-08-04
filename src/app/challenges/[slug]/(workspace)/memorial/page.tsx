import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { MemorialBoard } from "@/components/MemorialBoard";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import {
  getChallengeWithPokemonSlots,
  getSeasonMemorialGraves,
} from "@/lib/challenges";
import { canEditTrainerBoard } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getAccessForChallenge } from "@/lib/permissions";
import { isSeasonReadOnly } from "@/lib/season-status";


type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeWithPokemonSlots(slug, ["GRAVEYARD"]);
  if (!challenge) return { title: "Memorial" };
  return { title: `Memorial · ${challenge.name}` };
}

export default async function MemorialPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallengeWithPokemonSlots(
    slug,
    ["GRAVEYARD"],
    session?.user?.id,
  );
  if (!challenge) notFound();

  const [access, gravesByTrainerId] = await Promise.all([
    challenge.id ? getAccessForChallenge(challenge.id) : null,
    getSeasonMemorialGraves(challenge.slug, challenge.trainers),
  ]);
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
        gravesByTrainerId={gravesByTrainerId}
      />
    </>
  );
}
