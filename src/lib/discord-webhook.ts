/**
 * Fire-and-forget Discord incoming webhook posts for season activity.
 * Never throws to callers — logging failures stay out of user flows.
 */

import { getPrisma } from "@/lib/db";

const WEBHOOK_TYPES = new Set([
  "DEATH",
  "BADGE_EARNED",
  "REVIVE_USED",
  "WIPE",
]);

function isDiscordWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "discord.com" ||
        parsed.hostname === "discordapp.com") &&
      parsed.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

export async function dispatchDiscordWebhook(input: {
  challengeId: string;
  type: string;
  message: string;
}): Promise<void> {
  if (!WEBHOOK_TYPES.has(input.type)) return;

  try {
    const challenge = await getPrisma().challenge.findUnique({
      where: { id: input.challengeId },
      select: { name: true, discordWebhookUrl: true },
    });
    if (!challenge) return;
    const url = challenge.discordWebhookUrl?.trim();
    if (!url || !isDiscordWebhookUrl(url)) return;

    const content = `**${challenge.name}** · ${input.message}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content.slice(0, 1900),
        allowed_mentions: { parse: [] },
      }),
    });
  } catch {
    // Swallow — season edits must not fail on Discord outages.
  }
}
