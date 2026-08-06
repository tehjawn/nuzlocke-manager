import "server-only";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

/**
 * JWT sessions can outlive a local DB reset / Neon branch switch. When the
 * cookie still says "signed in" but User is gone (or Discord maps to a
 * different cuid), the rest of the app trips FKs (Notification P2003) and
 * looks half-logged-in. Callers should sign out on `orphan` only — never on
 * `unavailable` (DB blip).
 */

export type SessionUserResolution =
  | { status: "ok"; userId: string }
  | { status: "orphan" }
  | { status: "unavailable" };

export async function resolveSessionUser(input: {
  userId?: string | null;
  discordId?: string | null;
}): Promise<SessionUserResolution> {
  if (!isDatabaseConfigured()) return { status: "unavailable" };

  try {
    const prisma = getPrisma();
    const userId = input.userId?.trim() ?? "";
    if (userId) {
      const byId = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (byId) return { status: "ok", userId: byId.id };
    }

    const discordId = input.discordId?.trim() ?? "";
    if (discordId) {
      const byDiscord = await prisma.user.findUnique({
        where: { discordId },
        select: { id: true },
      });
      // Discord still maps to a User but JWT cuid is stale/missing — force
      // re-login so token.userId is rewritten. Don't silently swap ids for
      // this request; the rest of the tree still reads session.user.id.
      if (byDiscord) return { status: "orphan" };
    }

    // Session claimed a userId that isn't in DB (and Discord doesn't map).
    if (userId) return { status: "orphan" };

    // Cookie presents a user without a usable id — clear it.
    return { status: "orphan" };
  } catch (err) {
    console.warn("[session-user] resolve failed (fail-open)", err);
    return { status: "unavailable" };
  }
}

/** Login redirect after auto sign-out for orphan JWTs. */
export const SESSION_EXPIRED_LOGIN =
  "/login?reason=session-expired" as const;
