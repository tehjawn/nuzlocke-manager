import { redirect } from "next/navigation";

/**
 * TEMP: Seasons index is hidden while only one season exists.
 * The old listing UI lived here in a comment block and was the only caller of
 * the uncached full-board listChallenges(); both were removed in #313. Rebuild
 * from listSeasonIndex() when multi-season navigation returns.
 */
export default function ChallengesPage() {
  redirect("/");
}
