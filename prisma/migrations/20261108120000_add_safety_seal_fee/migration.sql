-- Optional Safety Seal add-on (R10, spirits only), saved per order.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "safetySealFee" DOUBLE PRECISION;
