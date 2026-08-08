import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Legacy single-tournament route → multi-tournament lobby. */
export default async function LegacyTournamentRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/challenges/${slug}/tournaments`);
}
