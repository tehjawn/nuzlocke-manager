export const ACTIVITY_FORCE_REFRESH_AFTER_UNCHANGED_POLLS = 5;

/** Periodically bypass KV so a missed watermark can never stall the feed forever. */
export function activityPollHead(
  head: string | null,
  unchangedPolls: number,
): string | null {
  return unchangedPolls >= ACTIVITY_FORCE_REFRESH_AFTER_UNCHANGED_POLLS
    ? null
    : head;
}
