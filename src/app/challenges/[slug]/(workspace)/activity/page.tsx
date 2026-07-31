import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ActivityFeedInfinite } from "@/components/ActivityFeed";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { getAccessForChallenge } from "@/lib/permissions";
import { getChallenge, listChallengeActivities } from "@/lib/challenges";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) return { title: "Pack feed" };
  return { title: `Pack feed · ${challenge.name}` };
}

export default async function ActivityPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const canReact = Boolean(access?.role);

  const page = await listChallengeActivities(slug, session?.user?.id, {
    limit: 30,
  });

  return (
    <>
      <DataSourceBanner source={challenge.source} />
      <div className="mb-4">
        <SeasonStatusBanner slug={challenge.slug} status={challenge.status} />
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
