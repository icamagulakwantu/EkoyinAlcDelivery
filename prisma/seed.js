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

// ── Strategy B: real per-product brand photos ─────────────────────────
// Founder-sourced, cleaned/cropped bottle photos, shared from the I-Camagu
// project's own catalogue (same founder, same products, just a different
// storefront). Files live in public/images/brands/. Takes priority over
// the category placeholder wherever a real photo is available; anything
// not in this map (Ekoyini-only products I-Camagu doesn't carry, or ones
// with no confirmed photo yet) keeps the Strategy A placeholder.
//
// Some entries here are a deliberate single-representative-photo choice
// for a CSV row that bundles several flavours/variants under one name
// (e.g. "4th Street Sweet Red/Rose" -> the Red bottle) — same discretion
// the founder already approved for I-Camagu's own catalogue: one clean
// photo per row beats no real photo at all.
const BRAND_PHOTO_MAP = {
  '4th Street Sweet Red/Rose': '/images/brands/4th-street-sweet-red.png',
  '4th Street Sweet Red/White': '/images/brands/4th-street-sweet-red.png',
  'Absolut (Watermelon/Lime/Citron)': '/images/brands/absolut-watermelon-lime-citron.png',
  'Absolut Original Blue': '/images/brands/absolut-original-blue.png',
  'Amarula Ethiopian Coffee': '/images/brands/amarula-ethiopian-coffee.png',
  'Amarula Original Cream': '/images/brands/amarula-original-cream.png',
  'Amstel Lager': '/images/brands/amstel-lager.png',
  'Angostura Aromatic Bitters': '/images/brands/angostura-aromatic-bitters.png',
  'Baileys Original Irish Cream': '/images/brands/baileys-original-irish-cream.png',
  'Bain\'s Cape Mountain': '/images/brands/bains-cape-mountain.png',
  'Banana Liqueur (Butlers)': '/images/brands/butlers-banana.png',
  'Belgravia G&T (Asstd)': '/images/brands/belgravia-dark-cherry.png',
  'Bells Extra Special': '/images/brands/bells-extra-special.jpg',
  'Belvedere Pure Vodka': '/images/brands/belvedere-pure-vodka.jpg',
  'Bernini Classic/Blush/Ruby': '/images/brands/bernini-classic.png',
  'Beyerskloof Pinotage': '/images/brands/beyerskloof-pinotage.png',
  'Bisquit & Dubouche VS': '/images/brands/bisquit-dubouche-vs.jpg',
  'Bisquit & Dubouche VSOP': '/images/brands/bisquit-dubouche-vsop.png',
  'Black Label': '/images/brands/carling-black-label.png',
  'Blue Curacao (Butlers)': '/images/brands/butlers-blue-curacao.png',
  'Blue Curacao (Peddler\'s)': '/images/brands/peddlers-blue-curacao.png',
  'Bombay Sapphire': '/images/brands/bombay-sapphire.png',
  'Breezer (Red/Watermelon)': '/images/brands/breezer-watermelon.png',
  'Brutal Fruit Ruby/Litchi': '/images/brands/brutal-fruit-ruby-apple.png',
  'Budweiser': '/images/brands/budweiser.png',
  'Cape Velvet Cream': '/images/brands/cape-velvet-cream.png',
  'Casamigos Blanco': '/images/brands/casamigos-blanco.png',
  'Casamigos Reposado': '/images/brands/casamigos-reposado.jpg',
  'Castillo de Liria Sweet Red': '/images/brands/castillo-de-liria-sweet-red.png',
  'Castle Lager': '/images/brands/castle-lager.png',
  'Castle Lite': '/images/brands/castle-lite.png',
  'Castle Milk Stout': '/images/brands/castle-milk-stout.png',
  'Chambord Black Raspberry': '/images/brands/chambord-black-raspberry.jpg',
  'Cherry Kirsch Liqueur (Butlers)': '/images/brands/butlers-cherry-kirsch.png',
  'Chillers Punch': '/images/brands/chillers-punch-caribbean-chaos.png',
  'Chivas Regal 12 Year Old': '/images/brands/chivas-regal-12yo.jpg',
  'Chivas Regal 15 Year Old': '/images/brands/chivas-regal-15.png',
  'Ciroc (Apple/Mango/Pineapple)': '/images/brands/ciroc-apple.png',
  'Ciroc Original Premium': '/images/brands/ciroc-original.png',
  'Clase Azul Plata': '/images/brands/clase-azul-plata.png',
  'Clase Azul Reposado': '/images/brands/clase-azul-reposado.jpg',
  'Cointreau Orange Liqueur': '/images/brands/cointreau-orange-liqueur.png',
  'Corona': '/images/brands/corona.png',
  'Count Pushkin Vodka': '/images/brands/count-pushkin-vodka.png',
  'Courvoisier VS': '/images/brands/courvoisier-vs.png',
  'Courvoisier VSOP': '/images/brands/courvoisier-vsop.png',
  'Cruxland Gin': '/images/brands/cruxland-gin.png',
  'Cruz Vintage Black Vodka': '/images/brands/cruz-vintage-black-vodka.jpg',
  'D\'USSE VSOP': '/images/brands/dusse-vsop.png',
  'Disaronno Amaretto Liqueur': '/images/brands/disaronno-amaretto.png',
  'Don Julio Blanco': '/images/brands/don-julio-blanco.jpg',
  'Don Julio Reposado': '/images/brands/don-julio-reposado.jpg',
  'Drostdy-Hof Adelpracht Sweet': '/images/brands/drostdy-hof-adelpracht.png',
  'Drostdy-Hof Claret Select': '/images/brands/drostdy-hof-claret-select.png',
  'El Jimador Blanco/Reposado': '/images/brands/el-jimador-blanco.png',
  'Espresso/Coffee Liqueur (Butlers)': '/images/brands/butlers-espresso.png',
  'Extreme Energy': '/images/brands/extreme-energy.png',
  'Firstwatch Whisky': '/images/brands/firstwatch-whisky.png',
  'Flowstone African Bush Botanical': '/images/brands/flowstone-african-bush-botanical.png',
  'Flying Fish Chill': '/images/brands/flying-fish-chill.png',
  'Flying Fish Lemon/Apple': '/images/brands/flying-fish-lemon-apple.png',
  'Frangelico Hazelnut Liqueur': '/images/brands/frangelico-hazelnut.png',
  'Ginger Liqueur (Butlers)': '/images/brands/butlers-ginger-liqueur.png',
  'Glenfiddich 12 Year': '/images/brands/glenfiddich-12.png',
  'Gordons London Dry': '/images/brands/gordons-london-dry.jpg',
  'Gordons Premium Pink': '/images/brands/gordons-pink-berry.png',
  'Grand Marnier Cordon Rouge': '/images/brands/grand-marnier-cordon-rouge.jpg',
  'Grenadine Syrup Cordial': '/images/brands/monin-grenadine.png',
  'Grey Goose Luxury': '/images/brands/grey-goose-luxury.jpg',
  'Guinness Foreign Extra': '/images/brands/guinness-foreign-extra.png',
  'Hansa Pilsener': '/images/brands/hansa-pilsener.png',
  'Heineken': '/images/brands/heineken.png',
  'Hendrick\'s Original': '/images/brands/hendricks-original.png',
  'Hennessy VS': '/images/brands/hennessy-vs.png',
  'Hennessy VSOP': '/images/brands/hennessy-vsop.png',
  'Hennessy XO': '/images/brands/hennessy-xo.png',
  'Honor VS': '/images/brands/honor-vs.png',
  'Hunter\'s Chilled': '/images/brands/hunters-chilled.png',
  'Hunter\'s Dry/Gold': '/images/brands/hunters-dry.png',
  'Inverroche Amber/Verdant': '/images/brands/inverroche-amber.png',
  'Inverroche Classic': '/images/brands/inverroche-classic.png',
  'J&B Rare': '/images/brands/jb-rare.png',
  'JC Le Roux La Fleurette': '/images/brands/jc-le-roux-la-fleurette.png',
  'JC Le Roux Le Domaine': '/images/brands/jc-le-roux-le-domaine.png',
  'Jack Daniel\'s Old No.7': '/images/brands/jack-daniels-old-no7.png',
  'Jack Daniel\'s Tennessee Honey': '/images/brands/jack-daniels-tennessee-honey.jpg',
  'Jagermeister Herbal Liqueur': '/images/brands/jagermeister-herbal-liqueur.webp',
  'Jameson Caskmates': '/images/brands/jameson-caskmates.png',
  'Jameson Original Irish': '/images/brands/jameson-original-irish.png',
  'Jameson Select Reserve': '/images/brands/jameson-select-reserve.png',
  'Johnnie Walker Black Label': '/images/brands/johnnie-walker-black-label.png',
  'Johnnie Walker Double Black': '/images/brands/johnnie-walker-double-black.png',
  'Johnnie Walker Gold Label Reserve': '/images/brands/johnnie-walker-gold-label.png',
  'Johnnie Walker Red Label': '/images/brands/johnnie-walker-red-label.png',
  'Jose Cuervo Especial Reposado': '/images/brands/jose-cuervo-especial-reposado.png',
  'Jose Cuervo Especial Silver': '/images/brands/jose-cuervo-especial-silver.png',
  'KEM Gin': '/images/brands/kem-gin.png',
  'Kahlua Coffee Liqueur': '/images/brands/kahlua-coffee-liqueur.webp',
  'Kanonkop Kadette Cabernet': '/images/brands/kanonkop-kadette-cabernet.png',
  'Klipdrift Export': '/images/brands/klipdrift-export.png',
  'Kola Tonic Cordial': '/images/brands/roses-kola-tonic.png',
  'Kopparberg Strawberry/Lime': '/images/brands/kopparberg-strawberry-lime.png',
  'Krone Borealis Brut (MCC)': '/images/brands/krone-borealis-brut.jpg',
  'Kwande Gin': '/images/brands/kwande-gin-witty.png',
  'Lime/Passion Fruit Cordial': '/images/brands/roses-lime.png',
  'Lion Lager': '/images/brands/lion-lager.png',
  'Malibu Coconut Rum Liqueur': '/images/brands/malibu-coconut-rum-liqueur.webp',
  'Martell Blue Swift VSOP': '/images/brands/martell-blue-swift.png',
  'Martell VS': '/images/brands/martell-vs.jpg',
  'Moet & Chandon Imperial Brut': '/images/brands/moet-chandon.png',
  'Musgrave Pink': '/images/brands/musgrave-pink.png',
  'Nachtmusik Chocolate Liqueur': '/images/brands/nachtmusik-chocolate.png',
  'Nederburg Baronne': '/images/brands/nederburg-baronne.png',
  'Nederburg Sauvignon Blanc': '/images/brands/nederburg-sauvignon-blanc.png',
  'Old Buck Gin': '/images/brands/old-buck-gin.png',
  'Olmeca Plata': '/images/brands/olmeca-plata.jpg',
  'Olmeca Reposado': '/images/brands/olmeca-reposado.png',
  'Paarl Perle White': '/images/brands/paarl-perle-white.png',
  'Patron Reposado': '/images/brands/patron-reposado.png',
  'Patron Silver Luxury': '/images/brands/patron-silver-luxury.jpg',
  'Peach Schnapps (Relic)': '/images/brands/relic-peach-schnapps.png',
  'Peppermint Liqueur (Butlers)': '/images/brands/butlers-peppermint.png',
  'Ponchos Blanco/Caramel Tequila': '/images/brands/ponchos-blanco-tequila.png',
  'Pongracz Brut': '/images/brands/pongracz-brut.png',
  'Redd\'s Berry/Orig/Green': '/images/brands/redds-berry.png',
  'Redd\'s MXD Pine/Guarana': '/images/brands/redds-mxd-pine.png',
  'Remy Martin 1738 Accord Royal': '/images/brands/remy-martin-1738.png',
  'Remy Martin VSOP': '/images/brands/remy-martin-vsop.png',
  'Robertson Winery Smooth Red': '/images/brands/robertson-winery-smooth-red-box.png',
  'Robertson Winery Sweet Merlot': '/images/brands/robertson-winery-merlot.png',
  'Royal Flush Premium': '/images/brands/royal-flush-premium.png',
  'Russian Bear Flavours': '/images/brands/russian-bear-flavours.png',
  'Russian Bear Standard': '/images/brands/russian-bear-standard.png',
  'Saint Raphael Sweet Red': '/images/brands/saint-raphael-smooth-red.png',
  'Sambuca Lupini Black/Gold': '/images/brands/sambuca-lupini-black-gold.png',
  'Savanna Angry Lemon': '/images/brands/savanna-angry-lemon.png',
  'Savanna Dry/Light': '/images/brands/savanna-dry.png',
  'Scottish Leader Original': '/images/brands/scottish-leader-original.png',
  'Skyy Vodka Original': '/images/brands/skyy-vodka-original.png',
  'Smirnoff Infusions': '/images/brands/smirnoff-infusions.png',
  'Smirnoff Red No. 21': '/images/brands/smirnoff-red-no-21.png',
  'Smirnoff Spin/Storm': '/images/brands/smirnoff-storm-citrus.png',
  'Sol': '/images/brands/sol.png',
  'Stella Artois': '/images/brands/stella-artois.png',
  'Strawberry Lips': '/images/brands/strawberry-lips.jpg',
  'Strawberry Liqueur (Butlers)': '/images/brands/butlers-strawberry.png',
  'Strettons London Dry': '/images/brands/strettons-london-dry.png',
  'Strettons Wild Berry': '/images/brands/strettons-wild-berry.png',
  'Strongbow Gold/Apple': '/images/brands/strongbow-gold-apple.png',
  'Tanqueray Flor de Sevilla': '/images/brands/tanqueray-flor-de-sevilla.png',
  'Tanqueray London Dry Export': '/images/brands/tanqueray-london-dry-export.webp',
  'Tanqueray No. TEN': '/images/brands/tanqueray-no-ten.png',
  'Tequila Rose Cream Liqueur': '/images/brands/tequila-rose-cream.png',
  'The Glenlivet 12 Year': '/images/brands/the-glenlivet-12.png',
  'Three Ships 5 Year Old': '/images/brands/three-ships-5-year.png',
  'Tia Maria Coffee Liqueur': '/images/brands/tia-maria-coffee-liqueur.jpg',
  'Triple Sec (Butlers)': '/images/brands/butlers-triple-sec.png',
  'Triple Sec (Peddler\'s)': '/images/brands/peddlers-triple-sec.png',
  'Triple Sec Premium (San Basile)': '/images/brands/triple-sec-san-basile.jpg',
  'Van Der Hum Tangerine (Butlers)': '/images/brands/butlers-van-der-hum.png',
  'Veuve Clicquot Yellow Label': '/images/brands/veuve-clicquot.png',
  'Viceroy 5 Year Old': '/images/brands/viceroy.png',
  'Wellington VO': '/images/brands/wellington-vo.png',
  'Wild Africa Cream Liqueur': '/images/brands/wild-africa-cream-liqueur.jpg',
  'Windhoek Draught': '/images/brands/windhoek-draught.png',
  'Windhoek Lager/Light': '/images/brands/windhoek-lager.png',
  'Wixworth Gin': '/images/brands/wixworth-gin.png',
  'Wyborowa Vodka': '/images/brands/wyborowa-vodka.png',
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

      imageUrl: BRAND_PHOTO_MAP[row.name] || CATEGORY_IMAGE_MAP[category] || CATEGORY_IMAGE_MAP.BEER,

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
