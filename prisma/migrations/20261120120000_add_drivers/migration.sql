-- Driver app (founder approved 20 Nov 2026): drivers sign in with phone + PIN.
-- New table only: nothing existing is changed or deleted.
CREATE TABLE IF NOT EXISTS "Driver" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "vehicle" TEXT,
  "pinHash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "failedLogins" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "sessionHash" TEXT,
  "sessionExpiresAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Driver_phone_key" ON "Driver"("phone");
CREATE INDEX IF NOT EXISTS "Driver_sessionHash_idx" ON "Driver"("sessionHash");
