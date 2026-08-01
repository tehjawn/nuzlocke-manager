import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutView } from "@/components/AboutView";
import { getChallenge } from "@/lib/challenges";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  return {
    title: challenge ? `About · ${challenge.name}` : "About",
    description:
      "About Trash Pack's Nuzlocke Challenge Manager, Nuzlockes, and the Trash Pack crew.",
  };
}

export default async function SeasonAboutPage({ params }: PageProps) {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) notFound();

  return <AboutView />;
}
