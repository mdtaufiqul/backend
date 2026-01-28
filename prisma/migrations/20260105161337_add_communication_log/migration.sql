-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "workflowId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerId" TEXT,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);
