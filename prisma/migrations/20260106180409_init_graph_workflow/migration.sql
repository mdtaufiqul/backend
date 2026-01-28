/*
  Warnings:

  - You are about to drop the `Workflow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkflowStep` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkflowStep" DROP CONSTRAINT "WorkflowStep_workflowId_fkey";

-- DropTable
DROP TABLE "Workflow";

-- DropTable
DROP TABLE "WorkflowStep";

-- CreateTable
CREATE TABLE "DoctorCommunicationProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postmarkSignatureId" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedEmail" TEXT,
    "confirmedByPostmark" BOOLEAN NOT NULL DEFAULT false,
    "smsAlphanumericId" TEXT,
    "whatsappWabaId" TEXT,
    "whatsappSenderNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorCommunicationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" TEXT NOT NULL,
    "patientType" TEXT NOT NULL DEFAULT 'ALL',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "currentNodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "contextData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorCommunicationProfile_userId_key" ON "DoctorCommunicationProfile"("userId");

-- AddForeignKey
ALTER TABLE "DoctorCommunicationProfile" ADD CONSTRAINT "DoctorCommunicationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
