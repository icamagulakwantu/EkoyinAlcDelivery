-- Daily payouts (founder, 11 Nov 2026). Approved by the founder.
-- When an order was delivered (payouts are per delivery day). Older delivered
-- orders get their last-updated time as the best available guess.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED' AND "deliveredAt" IS NULL;

-- One row per person paid for a period, so nobody is paid twice.
CREATE TABLE IF NOT EXISTS "Payout" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "period" TEXT NOT NULL,
  "payeeType" TEXT NOT NULL,
  "payeeKey" TEXT NOT NULL,
  "payeeName" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "orderCodes" TEXT NOT NULL,
  "paidBy" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Payout_period_payeeType_payeeKey_key" ON "Payout"("period", "payeeType", "payeeKey");

-- The 12:00 summary email is sent once a day.
CREATE TABLE IF NOT EXISTS "PayoutEmail" (
  "day" TEXT NOT NULL PRIMARY KEY,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Payout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayoutEmail" ENABLE ROW LEVEL SECURITY;
