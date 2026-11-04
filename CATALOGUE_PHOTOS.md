# Ekoyini catalogue photos

Ekoyini uses the same SKU identity principle as iCamagu: the image belongs to the exact product and pack format, not merely the brand.

1. Exact `(name, bottleFormat)` mappings in `prisma/catalogue-photo-config.js` take priority.
2. A brand-level image is used only when that product has one catalogue format. It is not reused across cans, dumpies, quarts or bottle sizes.
3. Product images are local files under `public/images/brands/`; paths are checked on disk before assignment.
4. If a multi-format SKU has no verified exact-format image, it remains unmatched and the storefront's neutral image fallback is used instead of a misleading packshot.
5. Photo sync changes only `SkuItem.imageUrl`; it does not change SKU IDs, prices, stock, or order records.

## Adding a missing photo

- Copy the correct product-and-format asset into `public/images/brands/`.
- Add a `FORMAT_PHOTO_MAP` entry keyed by `JSON.stringify([productName, bottleFormat])`.
- Confirm the catalogue's exact spelling and format in `prisma/data/skus.csv` before adding the mapping.
- Do not map a can image to a dumpy, a dumpy to a quart, or a different flavour/variant to fill a gap.

## Safe commands

- `npm run catalogue:audit` — read-only comparison of the live SKU table, CSV and local photo coverage.
- `npm run catalogue:photos:dry-run` — preview image assignments without writing.
- `npm run catalogue:photos:sync` — update local photo paths only.
- `npm run catalogue:structure:dry-run` — preview SKU structure corrections without writing.
- `npm run catalogue:prices:dry-run` — preview retail repricing separately.

SKU structure changes and retail repricing remain separate from image corrections.
