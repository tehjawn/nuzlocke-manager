import { Suspense } from "react";
import { auth } from "@/auth";
import { HeadlineMoments } from "@/components/HeadlineMoments";
import {
  getChallengeAccessFields,
  listHeadlineActivities,
} from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";

type HeadlineMomentsRailProps = {
  slug: string;
};

/**
 * Async left-rail slot for Headline Moments. Wrapped in Suspense so season
 * chrome can paint tabs first (#322).
 */
export function HeadlineMomentsRail({ slug }: HeadlineMomentsRailProps) {
  return (
    <Suspense fallback={<HeadlineMomentsFallback />}>
      <HeadlineMomentsLoader slug={slug} />
    </Suspense>
  );
}

function HeadlineMomentsFallback() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-3 w-20 rounded bg-frame/20" />
      <div className="h-36 animate-pulse rounded-[var(--radius)] border border-frame/50 bg-surface-2/50" />
      <div className="mx-auto h-2 w-12 rounded-full bg-frame/20" />
    </div>
  );
}

async function HeadlineMomentsLoader({ slug }: { slug: string }) {
  const session = await auth();
  const [items, accessFields] = await Promise.all([
    listHeadlineActivities(slug, session?.user?.id),
    getChallengeAccessFields(slug),
  ]);

  const access = accessFields?.id
    ? await getAccessForChallenge(accessFields.id)
    : null;
  const canReact = Boolean(session?.user?.id && access?.role);

  return (
    <HeadlineMoments slug={slug} items={items} canReact={canReact} />
  );
}
