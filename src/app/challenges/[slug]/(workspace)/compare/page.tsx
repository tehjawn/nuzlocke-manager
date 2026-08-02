import { redirect } from "next/navigation";
import { toolsHref } from "@/lib/tools-routes";


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
  redirect(toolsHref(slug, "compare", { a, b }));
}
