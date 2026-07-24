import type { ChallengeStatus } from "@/lib/challenge-types";

/** Boards freeze when the season is archived (GM can reopen via status). */
export function isSeasonReadOnly(status: ChallengeStatus): boolean {
  return status === "ARCHIVED";
}

export function seasonStatusLabel(status: ChallengeStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Active";
    case "TOURNAMENT":
      return "Tournament";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}
