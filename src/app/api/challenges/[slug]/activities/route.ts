import { fetchChallengeActivitiesAction } from "@/app/actions/challenge";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/**
 * Paginated activity feed over a Route Handler — not a Server Action POST to
 * the PPR `/challenges/[slug]/activity` page. Those POSTs currently trip Next
 * invariant E592 (postponed state + fallback params) under cacheComponents.
 */
export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const page = await fetchChallengeActivitiesAction({
    slug,
    cursor,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return Response.json(page, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
