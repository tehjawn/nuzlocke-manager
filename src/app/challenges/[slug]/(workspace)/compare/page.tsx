import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
};

/** Compare lives under Tools — keep old links working. */
export default async function CompareRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { a, b } = await searchParams;
  const qs = new URLSearchParams();
  if (a) qs.set("a", a);
  if (b) qs.set("b", b);
  const suffix = qs.toString();
  redirect(
    suffix
      ? `/challenges/${slug}/tools?${suffix}`
      : `/challenges/${slug}/tools`,
  );
}
