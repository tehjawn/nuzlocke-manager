import { revalidatePath, updateTag } from "next/cache";

/**
 * Season cache tag matrix (`challenge-cache.ts` loaders ↔ write paths):
 *
 * | Tag | Loaders | Invalidate on |
 * | --- | --- | --- |
 * | `season:${slug}:board` | League summary, shell Search, tools/stats/encounters, survival tallies/markets, headlines, home carousel, memorial, full board | Any write that changes shared/peer-visible board data |
 * | `season:${slug}:trainer:${id}` | `fetchChallengeTrainerRow`, `fetchTrainerBoardSlotRow` (Reserves / R.I.P. / Encountered) | Writes that touch that trainer’s board (and season-wide wipes via root tag) |
 * | `season:${slug}:meta` | Rules/setup/about chrome, tournament identities (+ board) | GM/settings/meta only (`revalidateChallenge`) |
 * | `season:${slug}` (root) | Most season loaders still tag it for mass bust | GM/join/settings only — **never** board party/badge/vote writes (#364) |
 * | `seasons:index` | Season list / search brief | Provision, create, visibility, delete |
 *
 * Board mutations use `revalidateBoardViews`: bump `:board` (shared views) and
 * `:trainer:${id}` when known so peer trainer pages stay warm. Do not call
 * `revalidateTag` / `updateTag` on bare `season:${slug}` here.
 */
export function revalidateBoardViews(slug: string, trainerId?: string) {
  updateTag(`season:${slug}:board`);
  if (trainerId) {
    updateTag(`season:${slug}:trainer:${trainerId}`);
  }
  revalidatePath(`/challenges/${slug}`);
  revalidatePath(`/challenges/${slug}/season-stats`);
  revalidatePath(`/challenges/${slug}/activity`);
  if (trainerId) {
    revalidatePath(`/challenges/${slug}/trainers/${trainerId}`);
  }
}
