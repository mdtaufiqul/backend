-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "priority" INTEGER,
ADD COLUMN     "waitlistAddedAt" TIMESTAMP(3),
ADD COLUMN     "waitlistReason" TEXT;
