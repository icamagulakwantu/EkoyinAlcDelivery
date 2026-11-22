-- Tavern receipt details (founder approved 22 Nov 2026): the selling outlet's legal name, VAT number,
-- liquor licence number and address, shown on the customer's receipt. Four optional columns on "Tavern".
-- Nothing existing is changed or deleted.
ALTER TABLE "Tavern" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "Tavern" ADD COLUMN IF NOT EXISTS "vatNumber" TEXT;
ALTER TABLE "Tavern" ADD COLUMN IF NOT EXISTS "liquorLicenceNumber" TEXT;
ALTER TABLE "Tavern" ADD COLUMN IF NOT EXISTS "address" TEXT;
