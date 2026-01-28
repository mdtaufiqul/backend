/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('IN_APP', 'SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'UNDELIVERED');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('INSTANT', 'SCHEDULED', 'APPOINTMENT_LINKED', 'STANDALONE');

-- CreateEnum
CREATE TYPE "MeetingProvider" AS ENUM ('INTERNAL', 'GOOGLE_MEET', 'ZOOM');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('HOST', 'ATTENDEE');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'LEFT', 'DECLINED');

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "clinicId" TEXT;

-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "clinicId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "channel" "Channel" NOT NULL DEFAULT 'IN_APP',
ADD COLUMN     "direction" "MessageDirection" NOT NULL DEFAULT 'OUTBOUND',
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "onBehalfOfId" TEXT,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'SENT';

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "assignedDoctorId" TEXT,
ADD COLUMN     "clinicId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "clinicId" TEXT,
ADD COLUMN     "doctorId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "clinicId" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "isPermissionOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissions" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "verificationToken" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkflowDefinition" ADD COLUMN     "clinicId" TEXT,
ADD COLUMN     "formId" TEXT,
ADD COLUMN     "uiData" JSONB,
ALTER COLUMN "nodes" DROP NOT NULL,
ALTER COLUMN "edges" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkflowInstance" ADD COLUMN     "nextRunAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermissionTemplate" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermissionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" JSONB,
    "isPermissionOverridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecutionLog" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHasHtml" BOOLEAN NOT NULL DEFAULT false,
    "bodyHtml" TEXT,
    "bodyText" TEXT NOT NULL,
    "variables" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "delayMinutes" INTEGER,
    "channel" TEXT,
    "templateId" TEXT,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userData" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "userId" TEXT,
    "clinicId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicMeetingProvider" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "enabledProviders" TEXT[],
    "googleClientId" TEXT,
    "googleClientSecret" TEXT,
    "googleRefreshToken" TEXT,
    "googleEncryptionIv" TEXT,
    "zoomAccountId" TEXT,
    "zoomClientId" TEXT,
    "zoomClientSecret" TEXT,
    "zoomEncryptionIv" TEXT,
    "defaultProvider" TEXT NOT NULL DEFAULT 'INTERNAL',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicMeetingProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clinicId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "meetingType" "MeetingType" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "provider" "MeetingProvider" NOT NULL,
    "meetingLink" TEXT NOT NULL,
    "providerMeetingId" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "patientId" TEXT,
    "role" "ParticipantRole" NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAuditLog" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "patientId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermissionTemplate_clinicId_role_key" ON "RolePermissionTemplate"("clinicId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicMember_userId_clinicId_key" ON "ClinicMember"("userId", "clinicId");

-- CreateIndex
CREATE INDEX "EmailVerification_email_idx" ON "EmailVerification"("email");

-- CreateIndex
CREATE INDEX "EmailVerification_code_idx" ON "EmailVerification"("code");

-- CreateIndex
CREATE INDEX "SystemLog_module_idx" ON "SystemLog"("module");

-- CreateIndex
CREATE INDEX "SystemLog_clinicId_idx" ON "SystemLog"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicMeetingProvider_clinicId_key" ON "ClinicMeetingProvider"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_appointmentId_key" ON "Meeting"("appointmentId");

-- CreateIndex
CREATE INDEX "Meeting_clinicId_idx" ON "Meeting"("clinicId");

-- CreateIndex
CREATE INDEX "Meeting_createdBy_idx" ON "Meeting"("createdBy");

-- CreateIndex
CREATE INDEX "Meeting_startTime_idx" ON "Meeting"("startTime");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "MeetingParticipant_meetingId_idx" ON "MeetingParticipant"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingParticipant_meetingId_userId_key" ON "MeetingParticipant"("meetingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingParticipant_meetingId_patientId_key" ON "MeetingParticipant"("meetingId", "patientId");

-- CreateIndex
CREATE INDEX "MeetingAuditLog_meetingId_idx" ON "MeetingAuditLog"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingAuditLog_timestamp_idx" ON "MeetingAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "Conversation_clinicId_idx" ON "Conversation"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_externalId_key" ON "Message"("externalId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_onBehalfOfId_idx" ON "Message"("onBehalfOfId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissionTemplate" ADD CONSTRAINT "RolePermissionTemplate_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMember" ADD CONSTRAINT "ClinicMember_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMember" ADD CONSTRAINT "ClinicMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecutionLog" ADD CONSTRAINT "WorkflowExecutionLog_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_onBehalfOfId_fkey" FOREIGN KEY ("onBehalfOfId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMeetingProvider" ADD CONSTRAINT "ClinicMeetingProvider_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMeetingProvider" ADD CONSTRAINT "ClinicMeetingProvider_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAuditLog" ADD CONSTRAINT "MeetingAuditLog_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
