import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
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
  return { title: challenge ? `FAQ · ${challenge.name}` : "FAQ" };
}

export default async function FaqPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  return (
    <>
      <header className="mb-6">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">
          FAQ
        </h2>
        <p className="mt-2 text-muted">
          Common questions for {challenge.name}.
        </p>
      </header>

      <div className="space-y-4">
        {challenge.faqs.map((faq) => (
          <Frame key={faq.id} title={faq.question}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {faq.answer}
            </p>
          </Frame>
        ))}
      </div>
    </>
  );
}
