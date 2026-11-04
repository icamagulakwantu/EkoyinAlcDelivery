// SKU image matching mirrors iCamagu's product+pack identity:
// exact (name, bottleFormat) images win. A brand-level image is only safe
// when that product has a single format in the catalogue; it must never be
// stretched across cans, dumpies and quart/bottle SKUs.
function buildPhotoPlan(rows, brandPhotoMap = {}, formatPhotoMap = {}, assetExists = () => true) {
  const assignments = [];
  const missingAssets = [];
  const unmatched = [];
  const formatsByName = new Map();

  for (const row of rows) {
    if (!formatsByName.has(row.name)) formatsByName.set(row.name, new Set());
    formatsByName.get(row.name).add(row.bottleFormat);
  }

  for (const row of rows) {
    const exact = formatPhotoMap[JSON.stringify([row.name, row.bottleFormat])];
    const brand = brandPhotoMap[row.name];
    const allowBrandFallback = (formatsByName.get(row.name)?.size || 0) <= 1;

    if (exact) {
      if (assetExists(exact)) {
        assignments.push({ id: row.id, name: row.name, bottleFormat: row.bottleFormat, imageUrl: exact, matchType: 'format' });
        continue;
      }
      missingAssets.push({ name: row.name, bottleFormat: row.bottleFormat, imageUrl: exact, matchType: 'format' });
    }

    if (allowBrandFallback && brand) {
      if (assetExists(brand)) {
        assignments.push({ id: row.id, name: row.name, bottleFormat: row.bottleFormat, imageUrl: brand, matchType: 'brand' });
        continue;
      }
      missingAssets.push({ name: row.name, bottleFormat: row.bottleFormat, imageUrl: brand, matchType: 'brand' });
    } else if (!exact && brand && !allowBrandFallback) {
      missingAssets.push({ name: row.name, bottleFormat: row.bottleFormat, imageUrl: brand, matchType: 'unsafe-brand-fallback' });
    }

    unmatched.push({ id: row.id, name: row.name, bottleFormat: row.bottleFormat });
  }

  return { assignments, missingAssets, unmatched };
}

function parseBrandPhotoMap(source) {
  const start = source.indexOf('const BRAND_PHOTO_MAP = {');
  if (start === -1) return {};
  const end = source.indexOf('\n};', start);
  if (end === -1) throw new Error('Could not find the end of BRAND_PHOTO_MAP');
  const block = source.slice(start, end);
  const map = {};
  const entry = /^\s*'((?:[^'\\]|\\.)*)':\s*'([^']*)',?\s*$/gm;
  let match;
  while ((match = entry.exec(block))) map[match[1].replace(/\\'/g, "'")] = match[2];
  return map;
}

module.exports = { buildPhotoPlan, parseBrandPhotoMap };
