-- CreateTable
CREATE TABLE "DoctorSmsConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountSid" TEXT NOT NULL,
    "authTokenEncrypted" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSmsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSmsConfig_userId_key" ON "DoctorSmsConfig"("userId");

-- AddForeignKey
ALTER TABLE "DoctorSmsConfig" ADD CONSTRAINT "DoctorSmsConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
