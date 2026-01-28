-- CreateTable
CREATE TABLE "RecallOpportunity" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "draftMessage" TEXT,
    "lastContacted" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecallOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecallOpportunity_patientId_idx" ON "RecallOpportunity"("patientId");

-- CreateIndex
CREATE INDEX "RecallOpportunity_status_idx" ON "RecallOpportunity"("status");

-- AddForeignKey
ALTER TABLE "RecallOpportunity" ADD CONSTRAINT "RecallOpportunity_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
