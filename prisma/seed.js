// prisma/seed.js
//
// Run with: npm run seed  (or `npx prisma db seed`)
//
// Reads prisma/data/skus.csv (the supplier price sheet), computes Ekoyini's
// retail pricing, assigns a Phase-1 category placeholder image, and upserts
// every SKU into the database. Re-running this script is safe — it updates
// existing rows by (name, bottleFormat) instead of duplicating them.

const fs = require('fs');
const path = require('path');
const { PrismaClient, Category } = require('@prisma/client');

const prisma = new PrismaClient();

// ── Strategy A: category fallback images (Unsplash) ──────────────────
// Placeholder images so every product renders cleanly from day one.
// Phase 2: replace per-SKU with real bottle/can photography hosted in
// Supabase Storage (see scripts/enrich-images.js for an automated pass).
const CATEGORY_IMAGE_MAP = {
  BEER: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80',
  CIDER_RTD: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=600&q=80',
  BRANDY: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=600&q=80',
  WHISKY: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=600&q=80',
  COGNAC: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=600&q=80',
  GIN: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
  VODKA: 'https://images.unsplash.com/photo-1550985616-10810253b84d?auto=format&fit=crop&w=600&q=80',
  VODKA_PREMIUM: 'https://images.unsplash.com/photo-1550985616-10810253b84d?auto=format&fit=crop&w=600&q=80',
  TEQUILA: 'https://images.unsplash.com/photo-1516535794938-6063878f08cc?auto=format&fit=crop&w=600&q=80',
  TEQUILA_PREMIUM: 'https://images.unsplash.com/photo-1516535794938-6063878f08cc?auto=format&fit=crop&w=600&q=80',
  LIQUEUR: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
  MIXER: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=600&q=80',
  WINE: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
  WINE_BOX: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
  SPARKLING: 'https://images.unsplash.com/photo-1585553616435-2dc0a54e271d?auto=format&fit=crop&w=600&q=80',
  CHAMPAGNE: 'https://images.unsplash.com/photo-1585553616435-2dc0a54e271d?auto=format&fit=crop&w=600&q=80',
  WATER: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=600&q=80',
  ICE: 'https://images.unsplash.com/photo-1478719059408-592965723cbc?auto=format&fit=crop&w=600&q=80',
};

// ── Retail case / carry-pack discount, by category ────────────────────
// This is Ekoyini's own customer-facing discount — separate from the
// supplier's caseDiscountPct in the CSV, which reflects what the supplier
// gives Ekoyini, not what Ekoyini should automatically pass on.
//
// Rationale:
//  - Beer / cider-RTD / mixers / water / ice (8%): high-turnover, commonly
//    bought by the case or in bulk for a cooler box — a real discount
//    encourages bigger orders.
//  - Wine / wine-box / sparkling (6%): often bought a few at a time for
//    events; a modest discount nudges toward buying more.
//  - Standard spirits (5%): brandy, whisky, gin, vodka, tequila, liqueurs —
//    cases are bought but less routinely.
//  - Premium/luxury (3%): cognac, premium vodka/tequila, champagne — rarely
//    bought by the case, and margin protection matters more here.
const RETAIL_CASE_DISCOUNT_PCT = {
  BEER: 8, CIDER_RTD: 8, MIXER: 8, WATER: 8, ICE: 8,
  WINE: 6, WINE_BOX: 6, SPARKLING: 6,
  BRANDY: 5, WHISKY: 5, GIN: 5, VODKA: 5, TEQUILA: 5, LIQUEUR: 5,
  COGNAC: 3, VODKA_PREMIUM: 3, TEQUILA_PREMIUM: 3, CHAMPAGNE: 3,
};

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

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const csvPath = path.join(__dirname, 'data', 'skus.csv');
  const rows = parseCsv(csvPath);
  console.log(`Parsed ${rows.length} SKU rows from skus.csv`);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const category = row.category;
    if (!(category in Category)) {
      console.warn(`⚠ Skipping unknown category "${category}" for "${row.name}"`);
      continue;
    }

    const listPriceZAR = parseFloat(row.singlePriceZAR);
    const unitsPerCase = parseInt(row.unitsPerCase, 10);
    const retailCaseDiscountPct = RETAIL_CASE_DISCOUNT_PCT[category] ?? 5;
    const retailCaseZAR = round2(listPriceZAR * unitsPerCase * (1 - retailCaseDiscountPct / 100));

    const data = {
      category,
      productType: row.productType,
      supplierPortfolio: row.supplierPortfolio,

      listPriceZAR,
      unitsPerCase,
      supplierCaseDiscountPct: parseFloat(row.caseDiscountPct),
      supplierCasePriceZAR: parseFloat(row.casePriceZAR),
      palletPackQty: parseInt(row.palletPackQty, 10),
      supplierPalletDiscountPct: parseFloat(row.palletDiscountPct),
      supplierPalletPriceZAR: parseFloat(row.palletPriceZAR),

      retailSingleZAR: listPriceZAR,
      retailCaseDiscountPct,
      retailCaseZAR,

      imageUrl: CATEGORY_IMAGE_MAP[category] || CATEGORY_IMAGE_MAP.BEER,

      // Brand story tags — see the comment on SkuItem.brandTags in
      // schema.prisma for what these mean and how strict the bar is.
      // Pipe-separated in the CSV since a cell can't hold a real array;
      // empty for the overwhelming majority of SKUs, on purpose.
      brandTags: row.brandTags ? row.brandTags.split('|').filter(Boolean) : [],
    };

    const result = await prisma.skuItem.upsert({
      where: { name_bottleFormat: { name: row.name, bottleFormat: row.bottleFormat } },
      update: data,
      create: { name: row.name, bottleFormat: row.bottleFormat, ...data },
    });

    result.createdAt.getTime() === result.updatedAt.getTime() ? created++ : updated++;
  }

  console.log(`Catalog seeded: ${created} created, ${updated} updated.`);

  // Seed the taverns admin-api.js's assign-order dropdown expects to find.
  const taverns = [
    { name: 'Extreme Liquor Store', area: 'Zwide', phone: '27841234567' },
    { name: "Mama's Corner Tavern", area: 'KwaZakhele', phone: '27721234567' },
    { name: 'New Brighton Liquor', area: 'New Brighton', phone: '27839876543' },
    { name: 'Central Bottle Store', area: 'Central', phone: '27739876543' },
    { name: 'Motherwell Drinks Hub', area: 'Motherwell', phone: '27851239876' },
  ];
  for (const t of taverns) {
    const existing = await prisma.tavern.findFirst({ where: { name: t.name } });
    if (!existing) await prisma.tavern.create({ data: t });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
