// Exact local packshot overrides. Keys are JSON.stringify([name, bottleFormat]).
// Only add a mapping after confirming the image shows that exact product/format.
const FORMAT_PHOTO_MAP = {
  '["Budweiser","Can (500ml)"]': '/images/brands/Budweiser-Beer-Can-500ml.webp',
  '["Windhoek Draught","Can (440ml)"]': '/images/brands/windhoek-draught-can.png',
  '["Bonaqua Still Water","500ml"]': '/images/brands/bonaqua-still-water.png',
};

module.exports = { FORMAT_PHOTO_MAP };
