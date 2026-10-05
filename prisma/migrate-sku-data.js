// prisma/migrate-sku-data.js
//
// Run with: npm run migrate-sku-data
//
// This script imports updated SKU prices from skus-updated.csv and image URLs
// from image-urls.json, then updates the database with these values.
// It also applies fallback handling for any SKUs with missing imageUrl.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  const [headerLine, ...lines] = raw.split('\n');
  const headers = headerLine.split(',').map((h) => h.trim());
  return lines.map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
}

function parseImageUrls(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  // Extract only the images object, skip description/format/instructions
  return data.images || {};
}

async function main() {
  const csvPath = path.join(__dirname, 'data', 'skus-updated.csv');
  const imagesPath = path.join(__dirname, 'data', 'image-urls.json');

  // Parse updated SKU data
  const updatedSkus = parseCsv(csvPath).filter((row) => row.name && row.category);
  console.log(`Parsed ${updatedSkus.length} updated SKUs from skus-updated.csv`);

  // Parse image URLs
  const imageUrls = parseImageUrls(imagesPath);
  console.log(`Parsed ${Object.keys(imageUrls).length} image URLs from image-urls.json`);

  let updated = 0;
  let notFound = 0;
  let missingImages = [];

  for (const row of updatedSkus) {
    const { name, bottleFormat, category, singlePriceZAR, brandTags } = row;

    // Skip header/instruction rows
    if (!name || name.includes('TEMPLATE') || name.includes('INSTRUCTIONS')) continue;

    // Parse price
    const price = parseFloat(singlePriceZAR);
    if (!Number.isFinite(price)) continue;

    // Get image URL (only if provided in image-urls.json)
    const imageUrl = imageUrls[name] || null;
    if (!imageUrl) {
      missingImages.push(`${name} (${bottleFormat})`);
    }

    // Parse brand tags (pipe-separated in CSV)
    const tags = brandTags ? brandTags.split('|').filter(Boolean) : [];

    try {
      const result = await prisma.skuItem.updateMany({
        where: { name_bottleFormat: { name, bottleFormat } },
        data: {
          retailSingleZAR: price,
          ...(imageUrl && { imageUrl }),
          brandTags: tags,
        },
      });
      if (result.count > 0) {
        updated += result.count;
        const imageStatus = imageUrl ? 'with image' : 'NO IMAGE';
        console.log(`✓ ${name} (${bottleFormat}) — R${price.toFixed(2)} ${imageStatus}`);
      } else {
        notFound++;
        console.log(`⚠ ${name} (${bottleFormat}) — not found in database`);
      }
    } catch (err) {
      console.error(`✗ Error updating ${name} (${bottleFormat}):`, err.message);
    }
  }

  console.log(`\nMigration complete: ${updated} SKUs updated, ${notFound} not found.`);
  if (missingImages.length > 0) {
    console.log(`\n⚠️  ${missingImages.length} SKUs missing images in image-urls.json:`);
    missingImages.forEach(sku => console.log(`  - ${sku}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
