import type { ChallengeStatus } from "@/lib/challenge-types";

/** Boards freeze when the season is archived (GM can reopen via status). */
export function isSeasonReadOnly(status: ChallengeStatus): boolean {
  return status === "ARCHIVED";
}

export function isSeasonArchived(status: ChallengeStatus): boolean {
  return status === "ARCHIVED";
}

/** Live / upcoming seasons (not yet closed). */
export function isSeasonLive(status: ChallengeStatus): boolean {
  return status === "DRAFT" || status === "ACTIVE" || status === "TOURNAMENT";
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

/** Chip surface for season status — Active stays warm olive. */
export function seasonStatusChipClass(status: ChallengeStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-accent-2/20 text-accent-ink";
    case "TOURNAMENT":
      return "bg-accent/15 text-accent-deep";
    case "ARCHIVED":
      return "bg-rip text-muted";
    case "DRAFT":
    default:
      return "bg-surface-2 text-muted";
  }
}
