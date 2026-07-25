import type { ChallengeVisibility } from "@/lib/challenge-types";

/**
 * Invite-gated seasons are membership-only.
 * PUBLIC / UNLISTED stay open for spectators; seed data stays readable for demos.
 */
export function canViewChallenge(input: {
  visibility: ChallengeVisibility;
  source: "seed" | "database";
  hasMembership: boolean;
}): boolean {
  if (input.source === "seed") return true;
  if (input.visibility !== "INVITE") return true;
  return input.hasMembership;
}

export function isInviteOnly(visibility: ChallengeVisibility): boolean {
  return visibility === "INVITE";
}
