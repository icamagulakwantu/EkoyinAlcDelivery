-- Staff files (founder approved 22 Nov 2026): one record per driver or dispatcher
-- with ID, address, licence, vehicle and bank details (ID, licence and account
-- numbers are stored encrypted by the app). New table only. Nothing existing is
-- changed or deleted. Row level security is applied by scripts/ensure-schema.js.
CREATE TABLE IF NOT EXISTS "StaffProfile" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "driverId" TEXT,
  "adminEmail" TEXT,
  "fullName" TEXT NOT NULL,
  "idNumberEnc" TEXT NOT NULL,
  "idNumberHash" TEXT NOT NULL,
  "idLast4" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "addressLine" TEXT NOT NULL,
  "suburb" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "licenceNumberEnc" TEXT,
  "licenceLast4" TEXT,
  "licenceCode" TEXT,
  "licenceExpiry" TIMESTAMP(3),
  "vehicleMake" TEXT,
  "vehicleModel" TEXT,
  "vehicleColour" TEXT,
  "vehicleYear" INTEGER,
  "numberPlate" TEXT,
  "vehicleRegNumber" TEXT,
  "vehicleDiscExpiry" TIMESTAMP(3),
  "bankName" TEXT,
  "accountHolder" TEXT,
  "accountNumberEnc" TEXT,
  "accountLast4" TEXT,
  "branchCode" TEXT,
  "accountType" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_driverId_key" ON "StaffProfile"("driverId");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_adminEmail_key" ON "StaffProfile"("adminEmail");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_idNumberHash_key" ON "StaffProfile"("idNumberHash");
