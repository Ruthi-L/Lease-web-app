-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaseId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dateOfBirth" DATETIME NOT NULL,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "signatureData" TEXT,
    "signed_at" DATETIME,
    "sectionData" JSONB NOT NULL,
    CONSTRAINT "Tenant_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Tenant" ("accessToken", "dateOfBirth", "email", "firstName", "id", "isMinor", "lastName", "leaseId", "sectionData", "signatureData", "signed_at") SELECT "accessToken", "dateOfBirth", "email", "firstName", "id", "isMinor", "lastName", "leaseId", "sectionData", "signatureData", "signed_at" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
CREATE UNIQUE INDEX "Tenant_accessToken_key" ON "Tenant"("accessToken");
CREATE INDEX "Tenant_leaseId_idx" ON "Tenant"("leaseId");
CREATE INDEX "Tenant_email_idx" ON "Tenant"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
