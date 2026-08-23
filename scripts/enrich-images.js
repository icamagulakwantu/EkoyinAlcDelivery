// scripts/enrich-images.js
//
// Optional Phase-2 pass: looks up a real product photo per SKU via
// Open Food Facts (free, no API key) and overwrites the category
// placeholder image where a confident match is found.
//
// Run manually, not automatically: node scripts/enrich-images.js
// Requires Node 18+ (built-in fetch).

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fetchProductImage(query) {
      try {
              const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
                        query
              )}&search_simple=1&action=process&json=1&page_size=1`;
                  const res = await fetch(url);
                      const data = await res.json();
                          const product = data.products?.[0];
                              return product?.image_front_url || product?.image_url || null;
      } catch (err) {
              console.error(`Image lookup failed for "${query}":`, err.message);
                  return null;
      }
}

async function main() {
      const skus = await prisma.skuItem.findMany();
        let updated = 0;

          for (const sku of skus) {
                  const image = await fetchProductImage(`${sku.name} ${sku.bottleFormat}`);
                      if (image) {
                                await prisma.skuItem.update({ where: { id: sku.id }, data: { imageUrl: image } });
                                      updated++;
                                            console.log(`✓ ${sku.name} (${sku.bottleFormat})`);
                      } else {
                                console.log(`— no match for ${sku.name} (${sku.bottleFormat}), keeping placeholder`);
                      }
                          // Be polite to the free public API.
                              await new Promise((r) => setTimeout(r, 300));
          }

            console.log(`Done — updated ${updated}/${skus.length} SKUs with real product images.`);
}

main()
  .catch((e) => {
          console.error(e);
              process.exit(1);
  })
    .finally(async () => {
            await prisma.$disconnect();
    });