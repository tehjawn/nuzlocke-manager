import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export async function AuthButtons() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/account"
          className="pressable hidden rounded-sm bg-surface px-3 py-1.5 text-sm font-medium sm:inline-block"
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
        await signIn("discord", {
          redirectTo: "/challenges/2026-trash-pack",
        });
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
