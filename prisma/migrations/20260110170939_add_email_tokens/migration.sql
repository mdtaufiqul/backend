-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "EmailToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailToken_token_key" ON "EmailToken"("token");

-- CreateIndex
CREATE INDEX "EmailToken_token_idx" ON "EmailToken"("token");

-- CreateIndex
CREATE INDEX "EmailToken_appointmentId_idx" ON "EmailToken"("appointmentId");

-- AddForeignKey
ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
