import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getChallenge } from "@/lib/challenges";
import { ensureTrainerForChallenge } from "@/lib/provision";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Logged-in shortcut: ensure board exists, then open it. */
export default async function MyBoardRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const challenge = await getChallenge(slug);
  if (!challenge) {
    redirect("/challenges");
  }

  const result = await ensureTrainerForChallenge({
    userId: session.user.id,
    slug,
    allowAutoJoin: challenge.visibility !== "INVITE",
  });

  if (!result.ok) {
    redirect(
      result.reason === "invite_required"
        ? `/challenges/${slug}/join`
        : `/challenges/${slug}`,
    );
  }

  redirect(`/challenges/${slug}/trainers/${result.trainerId}`);
}
