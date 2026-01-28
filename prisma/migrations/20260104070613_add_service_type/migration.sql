/*
  Warnings:

  - A unique constraint covering the columns `[systemType]` on the table `Form` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "systemType" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'In-person';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consultationType" TEXT NOT NULL DEFAULT 'Mixed',
ADD COLUMN     "schedule" JSONB,
ADD COLUMN     "specialties" TEXT[];

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Form_systemType_key" ON "Form"("systemType");

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
