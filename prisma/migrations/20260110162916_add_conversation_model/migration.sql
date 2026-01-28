/*
  Migration: Add Conversation Model
  
  This migration:
  1. Creates Conversation table
  2. Migrates existing messages to conversations
  3. Updates Message table structure
*/

-- Step 1: Create Conversation table
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create indexes on Conversation
CREATE INDEX "Conversation_doctorId_idx" ON "Conversation"("doctorId");
CREATE INDEX "Conversation_patientId_idx" ON "Conversation"("patientId");
CREATE UNIQUE INDEX "Conversation_doctorId_patientId_key" ON "Conversation"("doctorId", "patientId");

-- Step 3: Add foreign keys to Conversation
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Create conversations from existing messages
INSERT INTO "Conversation" ("id", "doctorId", "patientId", "createdAt", "updatedAt", "lastMessageAt")
SELECT 
    gen_random_uuid(),
    "doctorId",
    "patientId",
    MIN("createdAt"),
    NOW(),
    MAX("createdAt")
FROM "Message"
WHERE "doctorId" IS NOT NULL AND "patientId" IS NOT NULL
GROUP BY "doctorId", "patientId";

-- Step 5: Add new columns to Message table (nullable first)
ALTER TABLE "Message" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "Message" ADD COLUMN "content" TEXT;

-- Step 6: Migrate data from old columns to new columns
UPDATE "Message" m
SET 
    "conversationId" = c."id",
    "content" = m."text"
FROM "Conversation" c
WHERE m."doctorId" = c."doctorId" 
  AND m."patientId" = c."patientId";

-- Step 7: Make new columns NOT NULL
ALTER TABLE "Message" ALTER COLUMN "conversationId" SET NOT NULL;
ALTER TABLE "Message" ALTER COLUMN "content" SET NOT NULL;

-- Step 8: Drop old foreign keys
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_doctorId_fkey";
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_patientId_fkey";

-- Step 9: Drop old columns
ALTER TABLE "Message" DROP COLUMN "doctorId";
ALTER TABLE "Message" DROP COLUMN "patientId";
ALTER TABLE "Message" DROP COLUMN "text";

-- Step 10: Create indexes on Message
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- Step 11: Add foreign key to Message
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
