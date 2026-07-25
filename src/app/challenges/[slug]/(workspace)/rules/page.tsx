import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { RulesFaqView } from "@/components/RulesFaqView";
import { getChallenge } from "@/lib/challenges";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { tab } = await searchParams;
  const challenge = await getChallenge(slug);
  if (!challenge) return { title: "Rules / FAQ" };
  return {
    title:
      tab === "faq"
        ? `FAQ · ${challenge.name}`
        : `Rules · ${challenge.name}`,
  };
}

export default async function RulesPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const initialTab = tab === "faq" ? "faq" : "rules";

  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted">Loading rules & FAQ…</p>
      }
    >
      <RulesFaqView
        slug={challenge.slug}
        challengeName={challenge.name}
        rules={challenge.rules}
        faqs={challenge.faqs}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
