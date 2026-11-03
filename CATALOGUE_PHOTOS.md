# Ekoyini catalogue photos

Ekoyini follows the iCamagu photo assignment pattern:

1. A verified local brand image in `public/images/brands/` is the default for that product's SKU formats.
2. A verified exact-format image overrides the brand default using the exact `name + bottleFormat` pair in `prisma/catalogue-photo-config.js`.
3. Every image path is checked on disk before it is written to `SkuItem.imageUrl`.
4. Product photo sync changes only `imageUrl`; it does not change SKU names, prices, stock, or order records.

## Adding a missing photo

- Add the actual product image to `public/images/brands/`.
- Use the filename listed in `prisma/data/photo-gaps.csv`, or update that manifest if a different name is needed.
- For a product with one representative photo across its formats, add a brand-level entry to `BRAND_PHOTO_MAP` in `prisma/seed.js`.
- For a pack-specific image, add an entry to `FORMAT_PHOTO_MAP` in `prisma/catalogue-photo-config.js`. The key is `JSON.stringify([productName, bottleFormat])`.
- Do not reuse a different flavour, brand, bottle size, or pack image just to fill a gap.

## Safe commands

- `npm run catalogue:audit` — read-only comparison of the live SKU table, CSV and local photo coverage.
- `npm run catalogue:photos:dry-run` — preview image assignments without writing.
- `npm run catalogue:photos:sync` — update local photo paths only.
- `npm run catalogue:structure:dry-run` — preview SKU renames, pack corrections, removals and additions without writing.
- `npm run catalogue:structure` — apply SKU structure corrections only; it does not reprice products.
- `npm run catalogue:prices:dry-run` — preview retail repricing separately.

The 375ml removals and other SKU structure changes must be reviewed independently from repricing. The automatic Render postinstall performs schema setup, read-only audits, a structure-only preview, and local photo sync. It applies SKU structure changes only when the Render environment variable `APPLY_CATALOGUE_STRUCTURE_ON_DEPLOY=true` is explicitly set. Retail repricing is never part of postinstall.
