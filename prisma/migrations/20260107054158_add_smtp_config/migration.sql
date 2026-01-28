-- CreateTable
CREATE TABLE "DoctorSmtpConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "user" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "senderName" TEXT,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSmtpConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSmtpConfig_userId_key" ON "DoctorSmtpConfig"("userId");

-- AddForeignKey
ALTER TABLE "DoctorSmtpConfig" ADD CONSTRAINT "DoctorSmtpConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
