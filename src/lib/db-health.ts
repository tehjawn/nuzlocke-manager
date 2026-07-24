import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

/**
 * Bump when a deploy requires a migrate/push (new required columns/tables).
 * Used only for human-readable messaging — readiness is probed live below.
 */
export const SCHEMA_REVISION = 3;

export type DatabaseHealth =
  | { ok: true; mode: "database" | "unconfigured" }
  | {
      ok: false;
      kind: "schema_mismatch" | "unreachable";
      detail: string;
      revision: number;
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isSchemaMismatchError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || // table does not exist
      error.code === "P2022") // column does not exist
  ) {
    return true;
  }

  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("no such column") ||
    message.includes("no such table") ||
    message.includes("unknown column") ||
    (message.includes("column") && message.includes("not found"))
  );
}

export function isUnreachableDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P1001" ||
      error.code === "P1002" ||
      error.code === "P1017")
  ) {
    return true;
  }
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("can't reach database") ||
    message.includes("databasenotreachable") ||
    message.includes("econnrefused") ||
    message.includes("connection timed out") ||
    message.includes("connection timeout")
  );
}

/**
 * Lightweight probe for columns/relations the running app expects.
 * When you ship a migration that adds required schema, extend this select.
 */
async function probeRequiredSchema(): Promise<void> {
  const prisma = getPrisma();
  await prisma.challenge.findFirst({
    select: {
      id: true,
      // Phase 3 markers — missing → schema_mismatch
      discordWebhookUrl: true,
      tournament: { select: { id: true } },
    },
  });
}

/** Request-deduped health check for layouts / data loaders. */
export const getDatabaseHealth = cache(async (): Promise<DatabaseHealth> => {
  if (!isDatabaseConfigured()) {
    return { ok: true, mode: "unconfigured" };
  }

  try {
    await probeRequiredSchema();
    return { ok: true, mode: "database" };
  } catch (error) {
    const detail = errorMessage(error);
    console.error("[db-health] probe failed", detail);

    if (isSchemaMismatchError(error)) {
      return {
        ok: false,
        kind: "schema_mismatch",
        detail,
        revision: SCHEMA_REVISION,
      };
    }

    return {
      ok: false,
      kind: "unreachable",
      detail,
      revision: SCHEMA_REVISION,
    };
  }
});

/** False when root layout is showing the maintenance screen. */
export async function isDatabaseServing(): Promise<boolean> {
  return (await getDatabaseHealth()).ok;
}
