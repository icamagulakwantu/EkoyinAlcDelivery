// Run by hand (not on deploy): node scripts/normalize-photos.js [--dry]
//
// Founder, 10 Nov 2026: "make sure items are similar sizes ... some items
// seem tiny". Product photos came from many shops: some bottles fill the
// frame, others sit small in a big white square. This trims the white
// border of every photo in FORMAT_PHOTO_MAP and centres the product on a
// square white canvas, so the product's longest side is always the same
// share of the tile (FILL). Same file name and format, so the photo map,
// the database and the tests don't change. Originals stay in Git history.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { FORMAT_PHOTO_MAP } = require('../prisma/catalogue-photo-config');

const FILL = 0.88; // product's longest side as a share of the canvas
const SIZE = 480; // output canvas, px (tiles show at most ~180 css px)
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const dry = process.argv.includes('--dry');

async function normalize(file) {
  const input = fs.readFileSync(file);
  const trimmed = await sharp(input).flatten({ background: '#ffffff' })
    .trim({ background: '#ffffff', threshold: 18 }).toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;
  const box = Math.round(SIZE * FILL);
  const scale = box / Math.max(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const product = await sharp(trimmed.data).resize(w, h, { fit: 'fill' }).toBuffer();
  let out = sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: WHITE } })
    .composite([{ input: product, left: Math.round((SIZE - w) / 2), top: Math.round((SIZE - h) / 2) }])
    .flatten({ background: '#ffffff' });
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') out = out.png({ palette: true, quality: 90, compressionLevel: 9 });
  else if (ext === '.webp') out = out.webp({ quality: 82 });
  else out = out.jpeg({ quality: 82, mozjpeg: true });
  const buf = await out.toBuffer();
  if (!dry) fs.writeFileSync(file, buf);
  return { before: input.length, after: buf.length, fill: Math.max(width, height) };
}

(async () => {
  const files = [...new Set(Object.values(FORMAT_PHOTO_MAP))].filter(Boolean)
    .map((u) => path.join(__dirname, '..', 'public', decodeURI(u)))
    .filter((f) => fs.existsSync(f));
  let before = 0, after = 0, failed = 0;
  for (const f of files) {
    try {
      const r = await normalize(f);
      before += r.before; after += r.after;
    } catch (err) {
      failed++;
      console.warn(`skip ${path.basename(f)}: ${err.message}`);
    }
  }
  console.log(`${dry ? '[dry] ' : ''}${files.length - failed} photos normalised, ${failed} skipped; ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
})();
