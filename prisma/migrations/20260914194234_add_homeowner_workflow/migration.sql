-- AlterTable
ALTER TABLE "Lease" ADD COLUMN "landlordSignatureData" TEXT;
ALTER TABLE "Lease" ADD COLUMN "landlordSignedAt" DATETIME;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "invitationSentAt" DATETIME;

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSession_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "Landlord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_token_key" ON "AuthSession"("token");

-- CreateIndex
CREATE INDEX "AuthSession_landlordId_idx" ON "AuthSession"("landlordId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
