import { auth, signIn, signOut } from "@/auth";
import { DiscordIcon, DISCORD_BTN_CLASS } from "@/components/DiscordIcon";
import { LoggedInChrome } from "@/components/LoggedInChrome";
import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";
import { isDatabaseConfigured } from "@/lib/db";
import { listNotificationsForUser } from "@/lib/notifications";
import { resolveSessionUser, SESSION_EXPIRED_LOGIN } from "@/lib/session-user";

const AFTER_LOGIN = `/challenges/${DEFAULT_CHALLENGE_SLUG}/me`;

type AuthButtonsProps = {
  /** Desktop profile menu GM link; mobile keeps GM in the hamburger drawer. */
  gmHref?: string | null;
  feedbackHref?: string | null;
};

/**
 * Session chrome only. My Trainer deliberately lives in TrainersMenu — this
 * component used to render a standalone accent pill as a fallback, which showed
 * up as a duplicate next to the Trainers menu on every page that could not
 * resolve `myTrainerId`.
 */
export async function AuthButtons({
  feedbackHref = null,
  gmHref = null,
}: AuthButtonsProps) {
  const session = await auth();

  if (session?.user) {
    const name = session.user.name ?? "Account";
    const image =
      typeof session.user.image === "string" ? session.user.image : null;

    let notifications: Awaited<ReturnType<typeof listNotificationsForUser>> =
      [];

    if (isDatabaseConfigured()) {
      const resolution = await resolveSessionUser({
        userId: session.user.id,
        discordId: session.user.discordId,
      });

      if (resolution.status === "orphan") {
        console.warn(
          "[AuthButtons] orphan session — signing out (re-login required)",
          { userId: session.user.id, discordId: session.user.discordId },
        );
        await signOut({ redirectTo: SESSION_EXPIRED_LOGIN });
        return null;
      }

      if (resolution.status === "ok") {
        try {
          notifications = await listNotificationsForUser(resolution.userId);
        } catch (err) {
          console.warn("[AuthButtons] notifications unavailable", err);
        }
      }
    }

    return (
      <div className="flex items-center gap-2">
        <LoggedInChrome
          feedbackHref={feedbackHref}
          gmHref={gmHref}
          image={image}
          name={name}
          notifications={notifications}
          signOutAction={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        />
      </div>
    );
  }

  return (
    // On mobile the Discord login lives in the nav drawer (MobileMenuAuth).
    <form
      className="hidden sm:block"
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: AFTER_LOGIN });
      }}
    >
      <button type="submit" className={`${DISCORD_BTN_CLASS} h-9 px-3 text-sm`}>
        <DiscordIcon className="h-4 w-4" />
        Discord login
      </button>
    </form>
  );
}
