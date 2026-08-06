import { toggleActivityReactionAction } from "@/app/actions/challenge";

type RouteContext = {
  params: Promise<{ activityId: string }>;
};

/**
 * Reaction toggle via Route Handler — avoids Server Action POSTs to the PPR
 * activity page (Next E592 under cacheComponents).
 */
export async function POST(request: Request, context: RouteContext) {
  const { activityId } = await context.params;

  let emoji: unknown;
  try {
    const body = (await request.json()) as { emoji?: unknown };
    emoji = body.emoji;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (typeof emoji !== "string") {
    return Response.json(
      { ok: false, error: "emoji is required" },
      { status: 400 },
    );
  }

  const result = await toggleActivityReactionAction({ activityId, emoji });
  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
