import { redirect } from "next/navigation";
import { getDefaultSearchChallenge } from "@/lib/challenges";


/** Global /about soft-lands on the live season's About tab. */
export default async function AboutPage() {
  const challenge = await getDefaultSearchChallenge();
  if (challenge) {
    redirect(`/challenges/${challenge.slug}/about`);
  }
  redirect("/");
}
