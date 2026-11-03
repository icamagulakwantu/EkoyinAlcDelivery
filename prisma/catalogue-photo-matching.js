// Exact SKU photo assignment, ported from iCamagu's (name, bottleFormat) matching.
// Brand-level fallback is allowed only when that brand has ONE SKU format.
function resolvePhotoAssignments(rows, brandPhotoMap, formatPhotoMap = {}) {
  const formatsByName = new Map();
  for (const row of rows) {
    const formats = formatsByName.get(row.name) || new Set();
    formats.add(row.bottleFormat);
    formatsByName.set(row.name, formats);
  }
  const assignments = [];
  for (const row of rows) {
    const exact = formatPhotoMap[JSON.stringify([row.name, row.bottleFormat])];
    const fallback = brandPhotoMap[row.name];
    const imageUrl = exact || (formatsByName.get(row.name)?.size === 1 ? fallback : null);
    if (imageUrl) assignments.push({ id: row.id, name: row.name, bottleFormat: row.bottleFormat, imageUrl });
  }
  return assignments;
}
module.exports = { resolvePhotoAssignments };
