-- Bottles & crate charge on returnable quarts (founder, 10 Nov 2026), saved per order.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bottleDepositFee" DOUBLE PRECISION;
