-- CreateTable
CREATE TABLE "WaitlistOffer" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistOffer_token_key" ON "WaitlistOffer"("token");

-- CreateIndex
CREATE INDEX "WaitlistOffer_token_idx" ON "WaitlistOffer"("token");

-- CreateIndex
CREATE INDEX "WaitlistOffer_appointmentId_idx" ON "WaitlistOffer"("appointmentId");

-- CreateIndex
CREATE INDEX "WaitlistOffer_patientId_idx" ON "WaitlistOffer"("patientId");

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
