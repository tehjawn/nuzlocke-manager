-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_userId_archivedAt_idx" ON "Notification"("userId", "archivedAt");
