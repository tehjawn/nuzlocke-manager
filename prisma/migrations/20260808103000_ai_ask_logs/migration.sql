-- Append-only Jump Ask run log (#394). Retention: keep forever for v1.

-- CreateTable
CREATE TABLE "AiAskLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT,
    "question" TEXT NOT NULL,
    "questionNorm" TEXT,
    "status" TEXT NOT NULL,
    "answerKind" TEXT,
    "answer" JSONB,
    "model" TEXT,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "preferRanking" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "snapshotHash" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "AiAskLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAskLog_userId_createdAt_idx" ON "AiAskLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAskLog_createdAt_idx" ON "AiAskLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiAskLog_status_createdAt_idx" ON "AiAskLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AiAskLog" ADD CONSTRAINT "AiAskLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAskLog" ADD CONSTRAINT "AiAskLog_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
