-- CreateTable
CREATE TABLE "IntakeSession" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "messages" JSONB NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSession_appointmentId_key" ON "IntakeSession"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSession_token_key" ON "IntakeSession"("token");

-- AddForeignKey
ALTER TABLE "IntakeSession" ADD CONSTRAINT "IntakeSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
