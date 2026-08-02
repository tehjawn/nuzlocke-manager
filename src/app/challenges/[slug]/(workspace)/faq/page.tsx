import { redirect } from "next/navigation";


type PageProps = {
  params: Promise<{ slug: string }>;
};

/** FAQ lives under Rules / FAQ — keep old links working. */
export default async function FaqRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/challenges/${slug}/rules?tab=faq`);
}
