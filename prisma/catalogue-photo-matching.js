// iCamagu-style SKU photo assignment.
// The normal brand photo is the default across that product's pack sizes.
// A verified exact (name, bottleFormat) image overrides that default.
function resolvePhotoAssignments(rows, brandPhotoMap, formatPhotoMap = {}) {
  const assignments = [];
  for (const row of rows) {
    const exact = formatPhotoMap[JSON.stringify([row.name, row.bottleFormat])];
    const fallback = brandPhotoMap[row.name];
    const imageUrl = exact || fallback || null;
    if (imageUrl) assignments.push({
      id: row.id,
      name: row.name,
      bottleFormat: row.bottleFormat,
      imageUrl,
      matchType: exact ? 'format' : 'brand',
    });
  }
  return assignments;
}
module.exports = { resolvePhotoAssignments };
