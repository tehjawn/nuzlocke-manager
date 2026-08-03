import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { displayActionError } from "@/lib/action-error-display";

export type ActionError = {
  /** Short string safe to show in UI */
  error: string;
  /** Optional stable code for logs / support */
  code?: string;
};

/** Re-export for server callers that already import from this module. */
export { displayActionError };

const DOMAIN_MESSAGE_MAX = 120;

const PRISMA_SCHEMA_HINT =
  "Something’s out of date with the database schema. Ask a GM/dev to run migrations, then retry.";

const PRISMA_DEFAULT_HINT = "Database error — please retry.";

/** Prisma / stack dumps that must never reach the client as-is. */
function looksLikeFrameworkDump(message: string): boolean {
  return (
    message.startsWith("Invalid `") ||
    message.includes("Unknown argument") ||
    message.includes("Available options are marked") ||
    /\bprisma\b/i.test(message) ||
    message.includes("\n    at ") ||
    message.length > DOMAIN_MESSAGE_MAX
  );
}

function zodSummary(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  const msg = `${path}${issue.message}`.trim();
  return msg.length <= DOMAIN_MESSAGE_MAX ? msg : "Invalid input";
}

function prismaKnownHint(code: string): ActionError {
  switch (code) {
    case "P2022":
      return { error: PRISMA_SCHEMA_HINT, code: "PRISMA_SCHEMA_MISMATCH" };
    case "P2002":
      return { error: "That value is already in use", code: "PRISMA_UNIQUE" };
    case "P2003":
      return {
        error: "Related data is missing — refresh and try again.",
        code: "PRISMA_FK",
      };
    default:
      return { error: PRISMA_DEFAULT_HINT, code: `PRISMA_${code}` };
  }
}

/** Map thrown errors to a short UI string; keep intentional domain messages. */
export function toActionError(e: unknown, fallback: string): ActionError {
  if (e instanceof ZodError) {
    return { error: zodSummary(e), code: "VALIDATION" };
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    return { error: PRISMA_SCHEMA_HINT, code: "PRISMA_VALIDATION" };
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return prismaKnownHint(e.code);
  }

  if (e instanceof Error) {
    const message = e.message.trim();
    if (!message) return { error: fallback };
    if (!looksLikeFrameworkDump(message)) {
      return { error: message };
    }
    if (
      message.startsWith("Invalid `") ||
      message.includes("Unknown argument") ||
      message.includes("Available options are marked")
    ) {
      return { error: PRISMA_SCHEMA_HINT, code: "PRISMA_VALIDATION" };
    }
    return { error: fallback };
  }

  return { error: fallback };
}

export function logActionError(scope: string, e: unknown): void {
  console.error(`[${scope}]`, e);
}

/** Server-action catch helper: log full error, return sanitized ActionResult failure. */
export function failAction(
  scope: string,
  e: unknown,
  fallback: string,
): { ok: false; error: string; code?: string } {
  logActionError(scope, e);
  const mapped = toActionError(e, fallback);
  return mapped.code
    ? { ok: false, error: mapped.error, code: mapped.code }
    : { ok: false, error: mapped.error };
}
