-- Preserve the source catalogue's two additional alcohol categories.
-- ADD VALUE is safe to re-run and does not rewrite existing SKU rows.
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'RUM';
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'ENERGY_DRINK';
