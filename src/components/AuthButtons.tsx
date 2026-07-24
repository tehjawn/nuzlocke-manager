import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { UserMenu } from "@/components/UserMenu";
import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";

const AFTER_LOGIN = `/challenges/${DEFAULT_CHALLENGE_SLUG}/me`;

type AuthButtonsProps = {
  /** When true, SiteHeader already shows My Trainer — skip the duplicate. */
  hideMyTrainer?: boolean;
};

export async function AuthButtons({ hideMyTrainer = false }: AuthButtonsProps) {
  const session = await auth();

  if (session?.user) {
    const name = session.user.name ?? "Account";
    const image =
      typeof session.user.image === "string" ? session.user.image : null;

    return (
      <div className="flex items-center gap-2">
        {!hideMyTrainer ? (
          <Link
            href={AFTER_LOGIN}
            className="pressable hidden h-9 items-center bg-accent px-3 text-sm font-bold text-white sm:inline-flex"
          >
            My Trainer
          </Link>
        ) : null}
        <UserMenu
          name={name}
          image={image}
          signOutAction={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        />
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
        className="pressable inline-flex h-9 items-center rounded-sm bg-accent px-3 text-sm font-bold text-white"
      >
        Discord login
      </button>
    </form>
  );
}
