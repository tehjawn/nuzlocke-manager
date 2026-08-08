import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AskAnswer } from "@/features/search/ask-types";
import { normalizeJumpAskQuestion } from "@/lib/ai/answer-cache";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

/**
 * Durable Jump Ask run log (#394).
 *
 * Append-only ops telemetry — not user-facing chat history. Never throws into
 * the Ask response path; insert failures are console-only.
 */

export type AiAskLogStatus =
  | "ok"
  | "cached"
  | "rate_limited"
  | "guard_blocked"
  | "upstream_error"
  | "not_configured"
  | "bad_request";

export type LogAiAskRunInput = {
  userId: string;
  challengeId?: string | null;
  question: string;
  status: AiAskLogStatus;
  answer?: AskAnswer | null;
  model?: string | null;
  cached?: boolean;
  preferRanking?: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  snapshotHash?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

type CreateData = {
  userId: string;
  challengeId: string | null;
  question: string;
  questionNorm: string;
  status: AiAskLogStatus;
  answerKind: string | null;
  answer: Prisma.InputJsonValue | typeof Prisma.DbNull;
  model: string | null;
  cached: boolean;
  preferRanking: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  snapshotHash: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

function toCreateData(
  input: LogAiAskRunInput,
  challengeId: string | null,
): CreateData {
  return {
    userId: input.userId,
    challengeId,
    question: input.question,
    questionNorm: normalizeJumpAskQuestion(input.question),
    status: input.status,
    answerKind: input.answer?.kind ?? null,
    answer:
      input.answer != null
        ? (input.answer as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    model: input.model ?? null,
    cached: Boolean(input.cached),
    preferRanking: Boolean(input.preferRanking),
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    latencyMs: input.latencyMs != null ? Math.round(input.latencyMs) : null,
    snapshotHash: input.snapshotHash ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
  };
}

export async function logAiAskRun(input: LogAiAskRunInput): Promise<void> {
  if (!isDatabaseConfigured()) return;

  const challengeId = input.challengeId?.trim() || null;

  try {
    const prisma = getPrisma();
    await prisma.aiAskLog.create({
      data: toCreateData(input, challengeId),
    });
  } catch (error) {
    // Stale / unknown challengeId fails the FK — retry without season context.
    if (challengeId) {
      try {
        const prisma = getPrisma();
        await prisma.aiAskLog.create({
          data: toCreateData(input, null),
        });
        return;
      } catch (retryError) {
        console.error("[logAiAskRun]", retryError);
        return;
      }
    }
    console.error("[logAiAskRun]", error);
  }
}
