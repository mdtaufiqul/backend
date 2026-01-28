-- CreateEnum
CREATE TYPE "SmsTier" AS ENUM ('PERSONAL_NUMBER', 'CUSTOM_BRANDING', 'SYSTEM_DEFAULT');

-- CreateEnum
CREATE TYPE "WhatsAppTier" AS ENUM ('META_OFFICIAL', 'QR_CODE', 'SYSTEM_FALLBACK');

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "fromIdentity" TEXT,
ADD COLUMN     "tierUsed" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customSenderName" TEXT,
ADD COLUMN     "metaAccessToken" TEXT,
ADD COLUMN     "metaBusinessId" TEXT,
ADD COLUMN     "metaTokenIv" TEXT,
ADD COLUMN     "personalSmsNumber" TEXT,
ADD COLUMN     "smsNumberVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsTier" "SmsTier" NOT NULL DEFAULT 'SYSTEM_DEFAULT',
ADD COLUMN     "whatsappPhoneNumber" TEXT,
ADD COLUMN     "whatsappQrExpiry" TIMESTAMP(3),
ADD COLUMN     "whatsappQrSession" TEXT,
ADD COLUMN     "whatsappTier" "WhatsAppTier" NOT NULL DEFAULT 'SYSTEM_FALLBACK';
