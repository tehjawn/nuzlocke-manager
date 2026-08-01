import { redirect } from "next/navigation";
import { getDefaultJumpChallenge } from "@/lib/challenges";

export const dynamic = "force-dynamic";

/** Global /about soft-lands on the live season's About tab. */
export default async function AboutPage() {
  const challenge = await getDefaultJumpChallenge();
  if (challenge) {
    redirect(`/challenges/${challenge.slug}/about`);
  }
  redirect("/");
}
