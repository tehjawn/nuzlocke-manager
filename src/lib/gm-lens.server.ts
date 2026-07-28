import { cookies } from "next/headers";
import { gmLensCookieName } from "@/lib/gm-lens";

/** Server: whether this season’s GM lens cookie is on. */
export async function readGmLensOn(slug: string): Promise<boolean> {
  const jar = await cookies();
  return jar.get(gmLensCookieName(slug))?.value === "1";
}
