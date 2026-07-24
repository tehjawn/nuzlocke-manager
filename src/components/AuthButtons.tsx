import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";

const AFTER_LOGIN = `/challenges/${DEFAULT_CHALLENGE_SLUG}/me`;

export async function AuthButtons() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={AFTER_LOGIN}
          className="pressable hidden rounded-sm bg-accent px-3 py-1.5 text-sm font-bold text-white sm:inline-block"
        >
          My board
        </Link>
        <Link
          href="/account"
          className="pressable hidden rounded-sm bg-surface px-3 py-1.5 text-sm font-medium md:inline-block"
        >
          {session.user.name ?? "Account"}
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="pressable rounded-sm bg-surface px-3 py-1.5 text-sm font-medium"
          >
            Sign out
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
      <button
        type="submit"
        className="pressable rounded-sm bg-accent px-3 py-1.5 text-sm font-bold text-white"
      >
        Discord login
      </button>
    </form>
  );
}
