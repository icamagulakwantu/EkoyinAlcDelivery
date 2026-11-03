// Exact local packshot overrides. Keys are JSON.stringify([name, bottleFormat]).
// Only add a mapping after confirming the image shows that exact product/format.
const FORMAT_PHOTO_MAP = {
  '["Budweiser","Can (500ml)"]': '/images/brands/Budweiser-Beer-Can-500ml.webp',
  '["Windhoek Draught","Can (440ml)"]': '/images/brands/windhoek-draught-can.png',
  '["Bonaqua Still Water","500ml"]': '/images/brands/bonaqua-still-water.png',
};

const UNPRICED_PRODUCTS = [
  {
    name: 'Budweiser',
    bottleFormat: 'Can (500ml)',
    category: 'BEER',
    productType: 'ALCOHOL',
    supplierPortfolio: 'SAB',
    unitsPerCase: 24,
    retailCaseDiscountPct: 8,
    imageUrl: '/images/brands/Budweiser-Beer-Can-500ml.webp',
  },
];

module.exports = { FORMAT_PHOTO_MAP, UNPRICED_PRODUCTS };
