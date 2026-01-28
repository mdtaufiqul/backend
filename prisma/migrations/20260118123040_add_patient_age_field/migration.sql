-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('INTERNAL', 'VISITOR', 'SUPPORT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'ASSIGNED', 'CLOSED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "AppointmentLog" DROP CONSTRAINT "AppointmentLog_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropIndex
DROP INDEX "Conversation_doctorId_patientId_key";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "visitorId" TEXT,
ALTER COLUMN "doctorId" DROP NOT NULL,
ALTER COLUMN "patientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "visitorId" TEXT,
ALTER COLUMN "senderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "timezone" DROP NOT NULL,
ALTER COLUMN "timezone" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "fingerprint" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_token_key" ON "Visitor"("token");

-- CreateIndex
CREATE INDEX "Visitor_clinicId_idx" ON "Visitor"("clinicId");

-- CreateIndex
CREATE INDEX "Visitor_token_idx" ON "Visitor"("token");

-- CreateIndex
CREATE INDEX "Visitor_email_idx" ON "Visitor"("email");

-- CreateIndex
CREATE INDEX "Conversation_visitorId_idx" ON "Conversation"("visitorId");

-- AddForeignKey
ALTER TABLE "AppointmentLog" ADD CONSTRAINT "AppointmentLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
