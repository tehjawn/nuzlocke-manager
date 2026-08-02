import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutView } from "@/components/AboutView";
import { getChallengeMeta } from "@/lib/challenges";


type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeMeta(slug);
  return {
    title: challenge ? `About · ${challenge.name}` : "About",
    description:
      "About Trash Pack's Nuzlocke Challenge Manager, Nuzlockes, and the Trash Pack crew.",
  };
}

export default async function SeasonAboutPage({ params }: PageProps) {
  const { slug } = await params;
  const challenge = await getChallengeMeta(slug);
  if (!challenge) notFound();

  return <AboutView />;
}
