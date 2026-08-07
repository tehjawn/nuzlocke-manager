/**
 * Lazy Prisma client (Prisma 7 + pg adapter).
 * Safe to import when DATABASE_URL is missing — call getPrisma() only when DB is configured.
 *
 * On Vercel Fluid, prefer Neon’s pooled DATABASE_URL and attachDatabasePool so idle
 * TCP connections close before the isolate suspends — otherwise warm isolates can
 * keep Neon’s Free-plan compute awake past the 5-minute scale-to-zero window.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  queryCount?: number;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function createPool(): Pool {
  // Serverless-friendly: few connections per isolate; prefer Neon pooler URL.
  // Short idle timeout (Vercel Fluid guidance) so Neon can scale to zero when quiet.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 3),
    idleTimeoutMillis: Number(process.env.PG_POOL_IDLE_MS ?? 5_000),
    connectionTimeoutMillis: 10_000,
  });
  attachDatabasePool(pool);
  return pool;
}

export function getPrisma(): PrismaClient {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not set");
  }

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const pool = globalForPrisma.pgPool ?? createPool();
  // Persist across HMR and serverless isolate reuse in all envs.
  globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log:
      process.env.PRISMA_QUERY_LOG === "1"
        ? [{ emit: "event", level: "query" }]
        : undefined,
  });

  if (process.env.PRISMA_QUERY_LOG === "1") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).$on("query", () => {
      globalForPrisma.queryCount = (globalForPrisma.queryCount ?? 0) + 1;
    });
  }

  globalForPrisma.prisma = prisma;
  return prisma;
}

/** Dev-only: read Prisma query counter when PRISMA_QUERY_LOG=1. */
export function getPrismaQueryCount(): number {
  return globalForPrisma.queryCount ?? 0;
}

export function resetPrismaQueryCount(): void {
  globalForPrisma.queryCount = 0;
}

/** @deprecated Prefer getPrisma() — kept for gradual migration */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});
