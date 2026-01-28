-- DropForeignKey
ALTER TABLE "IntakeSession" DROP CONSTRAINT "IntakeSession_appointmentId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "recurringFreq" TEXT DEFAULT 'NONE',
ADD COLUMN     "recurringGroupId" TEXT,
ADD COLUMN     "recurringUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'CUSTOM';

-- AlterTable
ALTER TABLE "IntakeSession" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "patientId" TEXT,
ALTER COLUMN "appointmentId" DROP NOT NULL,
ALTER COLUMN "messages" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "bloodGroup" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "automaticWaitlist" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PatientNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vitals" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "encounterId" TEXT,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "temperature" DOUBLE PRECISION,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "spO2" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "encounterId" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "encounterId" TEXT,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "encounterId" TEXT,
    "substance" TEXT NOT NULL,
    "reaction" TEXT,
    "severity" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalEncounter" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "type" TEXT NOT NULL DEFAULT 'General',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "transcript" TEXT,
    "audioUrl" TEXT,
    "isAudioSaved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClinicalEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientObservation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "clinicId" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT,
    "unit" TEXT,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "position" TEXT,
    "method" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FINAL',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amendedFromId" TEXT,

    CONSTRAINT "PatientObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalEncounter_appointmentId_key" ON "ClinicalEncounter"("appointmentId");

-- CreateIndex
CREATE INDEX "ClinicalEncounter_clinicId_recordedAt_idx" ON "ClinicalEncounter"("clinicId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientObservation_amendedFromId_key" ON "PatientObservation"("amendedFromId");

-- CreateIndex
CREATE INDEX "PatientObservation_patientId_type_recordedAt_idx" ON "PatientObservation"("patientId", "type", "recordedAt");

-- CreateIndex
CREATE INDEX "PatientObservation_encounterId_idx" ON "PatientObservation"("encounterId");

-- CreateIndex
CREATE INDEX "PatientObservation_clinicId_recordedAt_idx" ON "PatientObservation"("clinicId", "recordedAt");

-- CreateIndex
CREATE INDEX "PatientObservation_clinicId_idx" ON "PatientObservation"("clinicId");

-- CreateIndex
CREATE INDEX "Appointment_clinicId_date_idx" ON "Appointment"("clinicId", "date");

-- AddForeignKey
ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSession" ADD CONSTRAINT "IntakeSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSession" ADD CONSTRAINT "IntakeSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vitals" ADD CONSTRAINT "Vitals_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vitals" ADD CONSTRAINT "Vitals_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vitals" ADD CONSTRAINT "Vitals_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vitals" ADD CONSTRAINT "Vitals_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientObservation" ADD CONSTRAINT "PatientObservation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientObservation" ADD CONSTRAINT "PatientObservation_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientObservation" ADD CONSTRAINT "PatientObservation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientObservation" ADD CONSTRAINT "PatientObservation_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientObservation" ADD CONSTRAINT "PatientObservation_amendedFromId_fkey" FOREIGN KEY ("amendedFromId") REFERENCES "PatientObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
