// scripts/optimize-images.js
//
// Runs on every Render deploy (see render.yaml's buildCommand). Shrinks any
// product photo in public/images/brands that is bigger than it needs to be,
// so the shop loads fast on mobile data and nothing overflows its box.
//
// - Longest side is capped at MAX_SIDE px (shop cards show a photo at most
//   ~250px wide, so 600px stays sharp on retina phones).
// - Photos are never enlarged, and never cropped (fit: 'inside') — the shop
//   page letterboxes them in a fixed square with object-fit: contain.
// - Same file name and format are kept, so every existing image link keeps
//   working. Transparent backgrounds stay transparent.
// - Safe to re-run: files already small enough are skipped.
// - Never fails the deploy: if anything goes wrong it logs and exits 0.

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.warn('[images] sharp is not installed — skipping image optimisation.');
  process.exit(0);
}

const IMAGE_DIR = path.join(__dirname, '..', 'public', 'images', 'brands');
const MAX_SIDE = 600;
// Only re-encode a file that already fits if that saves at least 10%.
const MIN_SAVING = 0.9;

function encoderFor(ext, pipeline) {
  switch (ext) {
    case '.png':
      return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    case '.jpg':
    case '.jpeg':
      return pipeline.jpeg({ quality: 82, mozjpeg: true });
    case '.webp':
      return pipeline.webp({ quality: 82 });
    default:
      return null;
  }
}

async function optimiseFile(file) {
  const ext = path.extname(file).toLowerCase();
  const original = fs.readFileSync(file);
  const meta = await sharp(original, { failOn: 'none' }).metadata();
  const tooBig = (meta.width || 0) > MAX_SIDE || (meta.height || 0) > MAX_SIDE;

  const pipeline = sharp(original, { failOn: 'none' })
    .rotate() // respect phone-camera orientation
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
  const encoded = encoderFor(ext, pipeline);
  if (!encoded) return { status: 'skipped' };

  const output = await encoded.toBuffer();
  if (tooBig || output.length < original.length * MIN_SAVING) {
    fs.writeFileSync(file, output);
    return { status: 'optimised', before: original.length, after: output.length };
  }
  return { status: 'skipped' };
}

async function main() {
  if (!fs.existsSync(IMAGE_DIR)) {
    console.log('[images] No public/images/brands folder — nothing to do.');
    return;
  }
  sharp.cache(false); // keep memory low on Render's free plan

  const files = fs.readdirSync(IMAGE_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  let optimised = 0;
  let savedBytes = 0;
  for (const name of files) {
    try {
      const result = await optimiseFile(path.join(IMAGE_DIR, name));
      if (result.status === 'optimised') {
        optimised++;
        savedBytes += result.before - result.after;
      }
    } catch (err) {
      console.warn(`[images] Could not process ${name}: ${err.message}`);
    }
  }
  console.log(`[images] Checked ${files.length} photos, shrank ${optimised}, saved ${(savedBytes / 1024).toFixed(0)} KB.`);
}

main().catch((err) => {
  console.warn('[images] Image optimisation failed (deploy continues):', err.message);
});
