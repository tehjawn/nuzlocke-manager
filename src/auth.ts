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
        (typeof raw?.email === "string" && raw.email) ||
        (typeof mapped?.email === "string" && mapped.email) ||
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

      return true;
    },
    async jwt({ token, profile }) {
      if (profile?.id != null && isDatabaseConfigured()) {
        const discordId = String(profile.id);
        const user = await getPrisma().user.findUnique({
          where: { discordId },
        });
        if (user) {
          token.userId = user.id;
          token.discordId = discordId;
          token.displayName = user.displayName ?? user.name;
          token.picture = user.image ?? token.picture;
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
