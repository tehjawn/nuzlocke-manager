import { redirect } from "next/navigation";
import { legacyCompareHref } from "@/lib/tools-routes";


type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Compare retired into Team Planner's vs Trainer mode — keep old links working. */
export default async function CompareRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(legacyCompareHref(slug));
}
