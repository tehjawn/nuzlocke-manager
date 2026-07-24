import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { provisionForActiveSeasons } from "@/lib/provision";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      if (!isDatabaseConfigured()) {
        return true;
      }
      const discordId = profile?.id != null ? String(profile.id) : null;
      if (!discordId) return false;

      const prisma = getPrisma();
      const user = await prisma.user.upsert({
        where: { discordId },
        create: {
          discordId,
          email: profile?.email ?? null,
          name: profile?.name ?? null,
          displayName: profile?.name ?? null,
          image:
            typeof profile?.image === "string"
              ? profile.image
              : profile?.image
                ? String(profile.image)
                : null,
        },
        update: {
          email: profile?.email ?? undefined,
          name: profile?.name ?? undefined,
          image:
            typeof profile?.image === "string"
              ? profile.image
              : profile?.image
                ? String(profile.image)
                : undefined,
        },
      });

      try {
        await provisionForActiveSeasons(user.id);
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
