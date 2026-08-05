import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ActivityFeedInfinite } from "@/components/ActivityFeed";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { getAccessForChallenge } from "@/lib/permissions";
import { getChallengeMeta, listChallengeActivities } from "@/lib/challenges";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeMeta(slug);
  if (!challenge) return { title: "Activity" };
  return { title: `Activity · ${challenge.name}` };
}

export default async function ActivityPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallengeMeta(slug);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const canReact = Boolean(session?.user?.id && access?.role);

  const page = await listChallengeActivities(slug, session?.user?.id, {
    limit: 30,
  });

  return (
    <>
      <DataSourceBanner source={challenge.source} />
      <div className="mb-4">
        <SeasonStatusBanner
          slug={challenge.slug}
          status={challenge.status}
          isGm={Boolean(access?.isGm)}
        />
      </div>
      <ActivityFeedInfinite
        slug={challenge.slug}
        initialItems={page.items}
        initialCursor={page.nextCursor}
        canReact={canReact}
      />
    </>
  );
}
