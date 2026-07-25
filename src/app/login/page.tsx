import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { DiscordIcon, DISCORD_BTN_CLASS } from "@/components/DiscordIcon";
import { Frame } from "@/components/Frame";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Login",
};

const DEFAULT_AFTER_LOGIN = `/challenges/${DEFAULT_CHALLENGE_SLUG}/me`;

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/** Only allow same-origin relative paths (no protocol / open redirects). */
function safeCallbackUrl(raw: string | undefined): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_AFTER_LOGIN;
  return raw;
}

async function discordSignIn(formData: FormData) {
  "use server";
  const raw = formData.get("callbackUrl");
  const redirectTo = safeCallbackUrl(
    typeof raw === "string" ? raw : undefined,
  );
  await signIn("discord", { redirectTo });
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { callbackUrl: rawCallback } = await searchParams;
  const afterLogin = safeCallbackUrl(rawCallback);

  const session = await auth();
  if (session?.user?.id) {
    redirect(afterLogin);
  }

  const discordReady = Boolean(
    process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET,
  );

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main
        className={`mx-auto w-full flex-1 px-4 py-10 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        <div className="max-w-lg">
          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-2 text-muted">
            Discord login joins you to Season 2026, then walks you through your
            trainer board, the league, and how to get started.
          </p>

          <div className="mt-8 space-y-4">
            <Frame title="Discord">
              {discordReady ? (
                <form action={discordSignIn}>
                  <input type="hidden" name="callbackUrl" value={afterLogin} />
                  <button
                    type="submit"
                    className={`${DISCORD_BTN_CLASS} btn-cta btn-cta-lg`}
                  >
                    <DiscordIcon className="h-5 w-5" />
                    Continue with Discord
                  </button>
                </form>
              ) : (
                <p className="text-sm leading-relaxed text-muted">
                  Discord OAuth is not configured yet. Add{" "}
                  <code>AUTH_DISCORD_ID</code>, <code>AUTH_DISCORD_SECRET</code>
                  , and <code>AUTH_SECRET</code> to enable login.
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
        </div>
      </main>
    </div>
  );
}
