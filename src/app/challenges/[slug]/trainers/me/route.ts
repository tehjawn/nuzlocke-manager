import { redirectToOwnTrainerBoard } from "@/lib/my-trainer-redirect";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/**
 * Shared “my board” link for a season (#238). Static `me` segment wins over
 * `trainers/[trainerId]` — same ensure-board / intro / redirect flow as `/me`.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  return redirectToOwnTrainerBoard({
    slug,
    loginCallbackPath: `/challenges/${slug}/trainers/me`,
  });
}
