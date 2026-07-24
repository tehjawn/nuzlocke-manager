import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Frame } from "@/components/Frame";
import { SiteHeader } from "@/components/SiteHeader";
import { getChallenge } from "@/lib/challenges";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return [{ slug: "2026-trash-pack" }];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = getChallenge(slug);
  return { title: challenge ? `FAQ · ${challenge.name}` : "FAQ" };
}

export default async function FaqPage({ params }: PageProps) {
  const { slug } = await params;
  const challenge = getChallenge(slug);
  if (!challenge) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeName={challenge.name}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-2 sm:px-6">
        <Link
          href={`/challenges/${challenge.slug}`}
          className="text-sm text-muted hover:text-ink"
        >
          ← League board
        </Link>
        <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight">
          FAQ
        </h1>
        <p className="mt-2 text-muted">
          Common questions for {challenge.name}.
        </p>

        <div className="mt-8 space-y-4">
          {challenge.faqs.map((faq) => (
            <Frame key={faq.id} title={faq.question}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {faq.answer}
              </p>
            </Frame>
          ))}
        </div>
      </main>
    </div>
  );
}
