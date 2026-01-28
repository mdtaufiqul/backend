/*
  Warnings:

  - A unique constraint covering the columns `[confirmationToken]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "confirmationToken" TEXT,
ADD COLUMN     "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "chatChannelSid" TEXT,
ADD COLUMN     "completedAppts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateCancellations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "noShowScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "totalMissed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleClientId" TEXT,
ADD COLUMN     "googleClientSecret" TEXT,
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "videoProvider" TEXT NOT NULL DEFAULT 'daily',
ADD COLUMN     "zoomAccountId" TEXT,
ADD COLUMN     "zoomClientId" TEXT,
ADD COLUMN     "zoomClientSecret" TEXT;

-- CreateTable
CREATE TABLE "AppointmentLog" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_triggerType_key" ON "Workflow"("triggerType");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_confirmationToken_key" ON "Appointment"("confirmationToken");

-- AddForeignKey
ALTER TABLE "AppointmentLog" ADD CONSTRAINT "AppointmentLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
