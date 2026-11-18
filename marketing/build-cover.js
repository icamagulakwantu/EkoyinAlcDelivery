// Google Business Profile cover image (founder, 18 Nov 2026).
// Run: node marketing/build-cover.js  ->  marketing/ekoyini-google-cover.png (2048 x 1152, 16:9)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const img = (p) => {
  const f = path.join(ROOT, 'public', p);
  const ext = path.extname(f).slice(1).replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${fs.readFileSync(f).toString('base64')}`;
};
const logo = img('images/brand/ekoyini-logo.png');
const bottles = [
  'images/brands/carling-black-label.png',
  'images/brands/hennessy-vs-750ml-bottle.jpg',
  'images/brands/castle-lager.png',
  'images/brands/kwande-gin-witty.png',
  'images/brands/savanna-dry.png',
  'images/brands/castle-lite-can.png',
].map(img);
const ice = img('images/brands/ice-bag-2kg-white.jpg');
const pin = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
const shield = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`;
const store = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2 2 0 0 1-2-2z"/></svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; }
body { width: 1024px; height: 576px; overflow: hidden; font-family: Inter, 'DejaVu Sans', sans-serif; }
.c { position: relative; width: 1024px; height: 576px; background: radial-gradient(circle at 78% 42%, #3f8a5f 0%, #2e6e4b 42%, #1f4f35 100%); color: #fff; display: grid; grid-template-columns: 1.05fr 1fr; align-items: center; padding: 0 0 0 64px; }
.c::after { content: ''; position: absolute; right: -120px; bottom: -160px; width: 520px; height: 520px; border-radius: 50%; background: rgba(247,104,44,.18); }
.logo { background: #fff; border-radius: 18px; padding: 12px 18px; display: inline-flex; box-shadow: 0 12px 30px rgba(0,0,0,.18); }
.logo img { height: 46px; display: block; }
h1 { font-family: 'Inter Display', Inter, sans-serif; font-size: 50px; line-height: 1.04; letter-spacing: -.02em; margin: 26px 0 12px; }
h1 span { color: #fbb48f; }
.sub { font-size: 18px; color: #dcefe3; margin-bottom: 26px; }
.chips { display: grid; gap: 10px; }
.chip { display: flex; align-items: center; gap: 12px; font-size: 17px; font-weight: 600; }
.chip i { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,.14); display: grid; place-items: center; color: #fbb48f; }
.chip i svg { width: 24px; height: 24px; }
.age { position: absolute; left: 64px; bottom: 26px; font-size: 13px; color: #b9d9c5; letter-spacing: .02em; }
.age b { background: #f7682c; color: #fff; border-radius: 6px; padding: 3px 7px; margin-right: 8px; }
.cooler { position: relative; z-index: 1; justify-self: center; width: 440px; height: 440px; border-radius: 36px; background: #fff; box-shadow: 0 30px 60px rgba(0,0,0,.28); display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr 1fr; padding: 6px 4px; gap: 0; transform: rotate(-3deg); overflow: hidden; }
.cooler img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; transform: scale(1.22); }
.tag { position: absolute; z-index: 2; right: 70px; top: 52px; background: #f7682c; color: #fff; border-radius: 999px; padding: 10px 18px; font-weight: 800; font-size: 16px; box-shadow: 0 10px 24px rgba(0,0,0,.25); transform: rotate(4deg); }
.icebag { position: absolute; z-index: 2; right: 14px; bottom: 16px; width: 112px; height: 112px; border-radius: 26px; background: #fff; padding: 8px; box-shadow: 0 14px 30px rgba(0,0,0,.25); transform: rotate(6deg); }
.icebag img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; }
</style></head><body><div class="c">
  <div>
    <div class="logo"><img src="${logo}" alt="Ekoyini"></div>
    <h1>Cold drinks,<br><span>to your gate.</span></h1>
    <p class="sub">Drinks delivery across Nelson Mandela Bay</p>
    <div class="chips">
      <div class="chip"><i>${store}</i>Packed by licensed local taverns</div>
      <div class="chip"><i>${pin}</i>Follow your driver live</div>
      <div class="chip"><i>${shield}</i>Sealed, and ID checked at the door</div>
    </div>
  </div>
  <div class="cooler">${bottles.map((b) => `<img src="${b}" alt="">`).join('')}</div>
  <div class="tag">www.ekoyini.co.za</div>
  <div class="icebag"><img src="${ice}" alt=""></div>
  <div class="age"><b>18+</b>Not for sale to persons under 18. Drink responsibly.</div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(__dirname, 'ekoyini-google-cover.png') });
  await browser.close();
  console.log('built marketing/ekoyini-google-cover.png (2048 x 1152)');
})();
