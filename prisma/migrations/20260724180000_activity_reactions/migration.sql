-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityReaction" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityReaction_activityId_idx" ON "ActivityReaction"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityReaction_activityId_userId_emoji_key" ON "ActivityReaction"("activityId", "userId", "emoji");

-- AddForeignKey
DO $$ BEGIN
 ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActivityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
