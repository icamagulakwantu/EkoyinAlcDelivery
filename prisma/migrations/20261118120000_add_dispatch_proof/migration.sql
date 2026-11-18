-- Proven pickup and delivery, plus delay alerts (founder approved, 18 Nov 2026).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "collectionPin" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryPin" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "alertsSent" TEXT;

-- Orders already paid: best guess for when (their creation time).
UPDATE "Order" SET "paidAt" = "createdAt"
 WHERE "paidAt" IS NULL AND "status" IN ('PENDING', 'DISPATCHED', 'DELIVERED');
-- Orders already on the way: count the trip from now so old ones don't all alert at once.
UPDATE "Order" SET "pickedUpAt" = CURRENT_TIMESTAMP WHERE "pickedUpAt" IS NULL AND "status" = 'DISPATCHED';
-- Open orders get a delivery PIN now; new orders get one when they are placed.
UPDATE "Order" SET "deliveryPin" = lpad((floor(random() * 10000))::int::text, 4, '0')
 WHERE "deliveryPin" IS NULL AND "status" IN ('PAYMENT_PENDING', 'PENDING', 'DISPATCHED');
-- Orders already open for over 2 hours (old test orders) still show in the
-- Admin alerts bar but don't send alert emails when this goes live.
UPDATE "Order" SET "alertsSent" = '["NOT_ASSIGNED:amber","NOT_ASSIGNED:red","NOT_PICKED_UP:amber","NOT_PICKED_UP:red","LOCATION_SILENT:amber","LOCATION_SILENT:red","DELIVERY_SLOW:amber","DELIVERY_SLOW:red"]'
 WHERE "alertsSent" IS NULL AND "status" IN ('PENDING', 'DISPATCHED') AND "createdAt" < CURRENT_TIMESTAMP - INTERVAL '2 hours';
