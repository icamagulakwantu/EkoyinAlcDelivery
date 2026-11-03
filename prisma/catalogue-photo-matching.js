// iCamagu-style SKU photo assignment.
// A normal brand photo is the default across that product's pack sizes.
// A verified exact (name, bottleFormat) image overrides that default.
// The planner checks local assets before assigning them and falls back to
// the brand photo if an exact-format file is missing.
function buildPhotoPlan(rows, brandPhotoMap = {}, formatPhotoMap = {}, assetExists = () => true) {
  const assignments = [];
  const missingAssets = [];
  const unmatched = [];

  for (const row of rows) {
    const exact = formatPhotoMap[JSON.stringify([row.name, row.bottleFormat])];
    const fallback = brandPhotoMap[row.name];

    if (exact) {
      if (assetExists(exact)) {
        assignments.push({ id: row.id, name: row.name, bottleFormat: row.bottleFormat, imageUrl: exact, matchType: 'format' });
        continue;
      }
      missingAssets.push({ name: row.name, bottleFormat: row.bottleFormat, imageUrl: exact, matchType: 'format' });
    }

    if (fallback) {
      if (assetExists(fallback)) {
        assignments.push({ id: row.id, name: row.name, bottleFormat: row.bottleFormat, imageUrl: fallback, matchType: 'brand' });
        continue;
      }
      missingAssets.push({ name: row.name, bottleFormat: row.bottleFormat, imageUrl: fallback, matchType: 'brand' });
    }

    unmatched.push({ id: row.id, name: row.name, bottleFormat: row.bottleFormat });
  }

  return { assignments, missingAssets, unmatched };
}

module.exports = { buildPhotoPlan };
