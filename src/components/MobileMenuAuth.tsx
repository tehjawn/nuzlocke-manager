import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { DiscordIcon, DISCORD_BTN_CLASS } from "@/components/DiscordIcon";
import { FeedbackIcon, PreferencesIcon } from "@/components/nav-icons";
import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";

const AFTER_LOGIN = `/challenges/${DEFAULT_CHALLENGE_SLUG}/me`;

/**
 * Auth section for the mobile nav drawer. Renders account actions on the server
 * (My Profile + Sign Out, or Discord login) so the sign-in/out server actions
 * can live here; the client drawer just slots it in as children. On desktop the
 * same actions live in the header's UserMenu / Discord button.
 */
export async function MobileMenuAuth({
  feedbackHref = null,
}: {
  feedbackHref?: string | null;
}) {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex flex-col gap-1">
        <Link
          href="/account"
          className="flex h-11 items-center gap-2 rounded-md border border-transparent bg-surface px-3 text-sm font-medium hover:border-interactive/40 hover:bg-interactive-soft/60"
        >
          <ProfileIcon />
          My Profile
        </Link>
        <Link
          className="flex h-11 items-center gap-2 rounded-md border border-transparent bg-surface px-3 text-sm font-medium hover:border-interactive/40 hover:bg-interactive-soft/60"
          href="/preferences"
        >
          <PreferencesIcon className="h-4 w-4 text-accent-deep" />
          Preferences
        </Link>
        {feedbackHref && (
          <Link
            className="flex h-11 items-center gap-2 rounded-md border border-transparent bg-surface px-3 text-sm font-medium hover:border-interactive/40 hover:bg-interactive-soft/60"
            data-testid="feedback-menu-link"
            href={feedbackHref}
          >
            <FeedbackIcon className="h-4 w-4 text-accent-deep" />
            Feedback / Support
          </Link>
        )}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="flex h-11 w-full items-center gap-2 rounded-md border border-transparent bg-surface px-3 text-left text-sm font-medium hover:border-danger/40 hover:bg-danger/10"
          >
            <SignOutIcon />
            Sign Out
          </button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: AFTER_LOGIN });
      }}
    >
      <button type="submit" className={`${DISCORD_BTN_CLASS} h-11 w-full px-3`}>
        <DiscordIcon className="h-4 w-4" />
        Discord login
      </button>
    </form>
  );
}

function ProfileIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4 text-accent-deep"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="10" cy="7" r="3.25" />
      <path
        d="M4.5 16.5c1.2-2.4 3.1-3.5 5.5-3.5s4.3 1.1 5.5 3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4 text-danger"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M8 4H4.5A1.5 1.5 0 003 5.5v9A1.5 1.5 0 004.5 16H8"
        strokeLinecap="round"
      />
      <path d="M11 10h6M14 7l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
