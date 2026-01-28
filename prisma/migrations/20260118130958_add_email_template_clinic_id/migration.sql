/*
  Warnings:

  - A unique constraint covering the columns `[category,clinicId]` on the table `EmailTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN     "clinicId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_category_clinicId_key" ON "EmailTemplate"("category", "clinicId");

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
