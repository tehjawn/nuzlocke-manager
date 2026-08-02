import {
  parseShowdownSpritePath,
  SHOWDOWN_ORIGIN,
} from "@/lib/showdown-sprites";


/** Long browser/CDN cache — sprites are immutable by filename. */
const CACHE_CONTROL =
  "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400";

const UPSTREAM_HEADERS = {
  Accept: "image/*,*/*;q=0.8",
  // Identify ourselves; some CDNs are harsher on empty / bot-like UAs.
  "User-Agent": "nuzlocke-manager-sprite-proxy/1.0",
  Referer: `${SHOWDOWN_ORIGIN}/`,
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function fetchUpstream(url: string): Promise<Response> {
  let last: Response | null = null;
  // Cloudflare occasionally 403s; one short retry usually clears it.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 150));
    }
    last = await fetch(url, {
      headers: UPSTREAM_HEADERS,
      // Cache hits on success; bypass cache on retry after 403/429.
      ...(attempt === 0
        ? { next: { revalidate: 604800 } }
        : { cache: "no-store" as const }),
    });
    if (last.ok) return last;
    if (last.status !== 403 && last.status !== 429) return last;
  }
  return last!;
}

function passthroughImage(upstream: Response): Response {
  const contentType = upstream.headers.get("content-type") ?? "image/png";
  const body = upstream.body;
  if (!body) {
    return new Response(null, { status: 502 });
  }
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": CACHE_CONTROL,
      // Sprites are safe to share across users/origins when cached.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { path } = await context.params;
  const parsed = parseShowdownSpritePath(path ?? []);
  if (!parsed) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const upstream = await fetchUpstream(parsed.upstreamUrl);
    if (upstream.status === 404) {
      return new Response("Not found", { status: 404 });
    }
    if (!upstream.ok) {
      return new Response("Upstream error", {
        status: 502,
        headers: {
          // Don't cache failures — next request should retry upstream.
          "Cache-Control": "no-store",
        },
      });
    }
    return passthroughImage(upstream);
  } catch {
    return new Response("Upstream unreachable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export async function HEAD(request: Request, context: RouteContext) {
  const res = await GET(request, context);
  return new Response(null, { status: res.status, headers: res.headers });
}
