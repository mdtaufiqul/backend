-- DropIndex
DROP INDEX "Workflow_triggerType_key";

-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "appointmentId" TEXT;

-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'ALL';

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
