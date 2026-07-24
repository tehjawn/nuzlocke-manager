import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

  const result = await ensureTrainerForChallenge({
    userId: session.user.id,
    slug,
    allowAutoJoin: true,
  });

  if (!result.ok) {
    redirect(`/challenges/${slug}`);
  }

  redirect(`/challenges/${slug}/trainers/${result.trainerId}`);
}
