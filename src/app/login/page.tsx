import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Frame } from "@/components/Frame";
import { SiteHeader } from "@/components/SiteHeader";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Login",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/challenges/2026-trash-pack");
  }

  const discordReady = Boolean(
    process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET,
  );

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Sign in
        </h1>
        <p className="mt-2 text-muted">
          Sign in with Discord — public seasons create your trainer board
          automatically.
        </p>

        <div className="mt-8 space-y-4">
          <Frame title="Discord">
            {discordReady ? (
              <form
                action={async () => {
                  "use server";
                  await signIn("discord", {
                    redirectTo: "/challenges/2026-trash-pack",
                  });
                }}
              >
                <button
                  type="submit"
                  className="pressable rounded-sm bg-accent px-5 py-3 font-display text-sm font-bold tracking-wide text-white uppercase"
                >
                  Continue with Discord
                </button>
              </form>
            ) : (
              <p className="text-sm leading-relaxed text-muted">
                Discord OAuth is not configured yet. Add{" "}
                <code>AUTH_DISCORD_ID</code>, <code>AUTH_DISCORD_SECRET</code>,
                and <code>AUTH_SECRET</code> to enable login.
              </p>
            )}
          </Frame>

          {!isDatabaseConfigured() ? (
            <Frame title="Database">
              <p className="text-sm leading-relaxed text-muted">
                Set <code>DATABASE_URL</code>, run migrations, then{" "}
                <code>npm run db:seed</code> so memberships and edits persist.
              </p>
            </Frame>
          ) : null}

          <p className="text-sm text-muted">
            <Link href="/challenges" className="underline hover:text-ink">
              Browse seasons without signing in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
