import NextAuth from "next-auth";
import Discord, { type DiscordProfile } from "next-auth/providers/discord";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { provisionForDefaultLeague } from "@/lib/provision";

function discordAvatarUrl(profile: DiscordProfile): string {
  if (profile.avatar === null) {
    const defaultAvatarNumber =
      profile.discriminator === "0"
        ? Number(BigInt(profile.id) >> BigInt(22)) % 6
        : parseInt(profile.discriminator, 10) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  }
  const format = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
}

type DiscordAuthProfile = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  discordUsername?: string | null;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.id,
          name: profile.global_name ?? profile.username,
          email: profile.email,
          image: discordAvatarUrl(profile),
          discordUsername: profile.username,
        } satisfies DiscordAuthProfile;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, profile }) {
      if (!isDatabaseConfigured()) {
        return true;
      }
      // `profile` is the raw Discord /users/@me payload; `user` is our
      // provider `profile()` mapping. Prefer raw fields so we never miss
      // username / global_name when Auth.js shape drifts.
      const raw = profile as DiscordProfile | undefined;
      const mapped = user as DiscordAuthProfile | undefined;
      const discordId =
        raw?.id != null
          ? String(raw.id)
          : mapped?.id != null
            ? String(mapped.id)
            : null;
      if (!discordId) return false;

      const discordUsername =
        (typeof raw?.username === "string" && raw.username.trim()) ||
        (typeof mapped?.discordUsername === "string" &&
          mapped.discordUsername.trim()) ||
        null;
      const displayName =
        (typeof raw?.global_name === "string" && raw.global_name.trim()) ||
        (typeof mapped?.name === "string" && mapped.name.trim()) ||
        discordUsername ||
        null;
      const image =
        (typeof mapped?.image === "string" && mapped.image) ||
        (raw ? discordAvatarUrl(raw) : null);
      const email =
        (typeof raw?.email === "string" && raw.email.trim()) ||
        (typeof mapped?.email === "string" && mapped.email.trim()) ||
        null;

      const prisma = getPrisma();
      const dbUser = await prisma.user.upsert({
        where: { discordId },
        create: {
          discordId,
          discordUsername,
          email,
          name: displayName,
          displayName,
          image,
        },
        update: {
          email: email ?? undefined,
          name: displayName ?? undefined,
          displayName: displayName ?? undefined,
          discordUsername: discordUsername ?? undefined,
          image: image ?? undefined,
        },
      });

      // Always auto-join Trash Pack 2026 for now
      try {
        await provisionForDefaultLeague(dbUser.id);
      } catch (err) {
        console.error("Auto-provision failed", err);
      }

      // Welcome once at sign-in (idempotent) — not on every header render.
      try {
        const { ensureWelcomeNotification } = await import(
          "@/lib/notifications"
        );
        await ensureWelcomeNotification(dbUser.id);
      } catch (err) {
        console.error("Welcome notification ensure failed", err);
      }

      return true;
    },
    async jwt({ token, user, profile, trigger }) {
      // Only hit Neon when the JWT is being established / refreshed with a
      // Discord profile — not on every subsequent session read.
      const discordIdFromProfile =
        profile?.id != null ? String(profile.id) : null;
      const needsDbLookup =
        isDatabaseConfigured() &&
        discordIdFromProfile != null &&
        (trigger === "signIn" ||
          trigger === "signUp" ||
          typeof token.userId !== "string" ||
          !token.userId);

      if (needsDbLookup && discordIdFromProfile) {
        const dbUser = await getPrisma().user.findUnique({
          where: { discordId: discordIdFromProfile },
          select: {
            id: true,
            displayName: true,
            name: true,
            image: true,
          },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.discordId = discordIdFromProfile;
          token.displayName = dbUser.displayName ?? dbUser.name;
          token.picture = dbUser.image ?? token.picture;
        }
      } else if (user && typeof (user as { id?: string }).id === "string") {
        // OAuth account id is Discord snowflake; DB user id is set above on sign-in.
        if (typeof token.discordId !== "string" && profile?.id != null) {
          token.discordId = String(profile.id);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : "";
        session.user.discordId =
          typeof token.discordId === "string" ? token.discordId : null;
        if (typeof token.displayName === "string") {
          session.user.name = token.displayName;
        }
      }
      return session;
    },
  },
  trustHost: true,
});
