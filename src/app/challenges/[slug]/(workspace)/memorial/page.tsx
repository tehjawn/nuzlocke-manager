import { redirect } from "next/navigation";
import {
  parseStatsSection,
  seasonStatsHref,
} from "@/lib/tools-routes";


type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string }>;
};

/** Memorial folded into Season Stats (#288) — keep old links working. */
export default async function MemorialRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  redirect(seasonStatsHref(slug, { section: parseStatsSection(sp.section) }));
}
