// Builds the partner pitch PDFs (founder request, 16 Nov 2026):
//   partner-pack/Ekoyini-Partner-Tavern-Proposal.pdf
//   partner-pack/Ekoyini-Driver-Partner-Proposal.pdf
// Run: node partner-pack/build.js   (uses the preinstalled Playwright Chromium)
//
// Contact: Thanduxolo Makeleni, Township Onboarding Liaison Officer (founder's
// choice, 17 Nov 2026). Never call him the founder or owner in these documents.
// Every earnings figure is an illustration from the app's real fee rules,
// clearly labelled as "not a promise".
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public/images/brand/ekoyini-logo.png')).toString('base64');
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public/images/brand/ekoyini-icon.png')).toString('base64');

const C = { green: '#2e6e4b', green2: '#4f9a6f', green3: '#a9d3b8', orange: '#f7682c', orange2: '#fbb48f', ink: '#17140e', muted: '#5c5a55', line: '#e7e2d6', paper: '#fbf8f2' };
const R = (n) => 'R' + Math.round(n).toLocaleString('en-ZA').replace(/,/g, ' ');

// ── tiny SVG chart helpers ────────────────────────────────────────────
function bars(data, { w = 640, h = 250, unit = R, colors = [C.green3, C.green2, C.green] } = {}) {
  const max = Math.max(...data.map((d) => d.v)) * 1.18;
  const pad = 46, bw = (w - pad * 2) / data.length;
  const out = data.map((d, i) => {
    const bh = (d.v / max) * (h - 70);
    const x = pad + i * bw + bw * 0.18, y = h - 40 - bh;
    return `<rect x="${x}" y="${y}" width="${bw * 0.64}" height="${bh}" rx="8" fill="${colors[i % colors.length]}"/>
      <text x="${x + bw * 0.32}" y="${y - 10}" text-anchor="middle" font-size="17" font-weight="800" fill="${C.ink}">${unit(d.v)}</text>
      <text x="${x + bw * 0.32}" y="${h - 16}" text-anchor="middle" font-size="13" fill="${C.muted}">${d.label}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img"><line x1="${pad}" x2="${w - pad}" y1="${h - 40}" y2="${h - 40}" stroke="${C.line}" stroke-width="2"/>${out}</svg>`;
}

function donut(parts, { size = 230, center = '' } = {}) {
  const total = parts.reduce((s, p) => s + p.v, 0);
  const r = 80, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let off = 0;
  const arcs = parts.map((p) => {
    const len = (p.v / total) * circ;
    const s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.c}" stroke-width="34" stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"/>`;
    off += len;
    return s;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${arcs}<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" font-weight="800" fill="${C.ink}">${center}</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="12" fill="${C.muted}">customer pays</text></svg>`;
}

// Stacked weekly bars: walk-in sales plus Ekoyini orders on top.
function weekStack(days, { w = 640, h = 270 } = {}) {
  const max = Math.max(...days.map((d) => d.walk + d.app)) * 1.12;
  const pad = 40, bw = (w - pad * 2) / days.length, base = h - 52;
  const sc = (v) => (v / max) * (base - 20);
  const out = days.map((d, i) => {
    const x = pad + i * bw + bw * 0.16, bwid = bw * 0.68;
    const hw = sc(d.walk), ha = sc(d.app);
    return `<rect x="${x}" y="${base - hw}" width="${bwid}" height="${hw}" rx="5" fill="${C.green3}"/>
      <rect x="${x}" y="${base - hw - ha}" width="${bwid}" height="${ha}" rx="5" fill="${C.orange}"/>
      <text x="${x + bwid / 2}" y="${base - hw - ha - 7}" text-anchor="middle" font-size="12" font-weight="800" fill="${C.ink}">+${Math.round((d.app / d.walk) * 100)}%</text>
      <text x="${x + bwid / 2}" y="${base + 18}" text-anchor="middle" font-size="13" fill="${C.muted}">${d.label}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img"><line x1="${pad}" x2="${w - pad}" y1="${base}" y2="${base}" stroke="${C.line}" stroke-width="2"/>${out}
    <rect x="${pad}" y="${h - 22}" width="14" height="14" rx="3" fill="${C.green3}"/><text x="${pad + 20}" y="${h - 10}" font-size="12" fill="${C.ink}">Walk-in sales today</text>
    <rect x="${pad + 190}" y="${h - 22}" width="14" height="14" rx="3" fill="${C.orange}"/><text x="${pad + 210}" y="${h - 10}" font-size="12" fill="${C.ink}">Extra Ekoyini orders</text></svg>`;
}

function hbars(rows, { w = 640 } = {}) {
  const max = Math.max(...rows.map((r) => r.v));
  const rowH = 44, h = rows.length * rowH + 10;
  const body = rows.map((r, i) => {
    const bw = (r.v / max) * (w - 250);
    const y = 10 + i * rowH;
    return `<text x="0" y="${y + 22}" font-size="14" fill="${C.ink}">${r.label}</text>
      <rect x="170" y="${y + 6}" width="${bw}" height="24" rx="6" fill="${r.c || C.green2}"/>
      <text x="${178 + bw}" y="${y + 24}" font-size="15" font-weight="800" fill="${C.ink}">${r.text || R(r.v)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%">${body}</svg>`;
}

// ── shared page shell ──────────────────────────────────────────────────
const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, 'DejaVu Sans', sans-serif; color: ${C.ink}; font-size: 13.5px; line-height: 1.5; }
.page { width: 210mm; height: 297mm; padding: 18mm 17mm 16mm; position: relative; page-break-after: always; overflow: hidden; background: #fff; }
.page:last-child { page-break-after: auto; }
.top { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${C.line}; padding-bottom: 8px; margin-bottom: 18px; }
.top img { height: 30px; }
.top span { font-size: 11px; color: ${C.muted}; letter-spacing: .08em; text-transform: uppercase; }
.foot { position: absolute; left: 17mm; right: 17mm; bottom: 9mm; display: flex; justify-content: space-between; font-size: 10px; color: ${C.muted}; border-top: 1px solid ${C.line}; padding-top: 6px; }
h1 { font-family: 'Inter Display', Inter, sans-serif; font-size: 34px; line-height: 1.1; margin: 0 0 10px; letter-spacing: -.02em; }
h2 { font-family: 'Inter Display', Inter, sans-serif; font-size: 23px; margin: 0 0 8px; letter-spacing: -.01em; color: ${C.green}; }
h3 { font-size: 15px; margin: 14px 0 6px; }
p { margin: 0 0 9px; }
.kicker { color: ${C.orange}; font-weight: 800; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 6px; }
.lead { font-size: 15.5px; color: #333; }
.cover { background: linear-gradient(160deg, ${C.paper} 0%, #fff 55%); padding: 0; }
.cover-band { background: ${C.green}; color: #fff; padding: 30mm 18mm 16mm; }
.cover-band h1 { color: #fff; font-size: 40px; }
.cover-band p { color: #e6f2ea; font-size: 16px; max-width: 150mm; }
.cover-logo { background: #fff; padding: 14mm 18mm 8mm; }
.cover-logo img { height: 64px; }
.cover-body { padding: 12mm 18mm; }
.pill { display: inline-block; background: ${C.orange}; color: #fff; font-weight: 800; border-radius: 999px; padding: 6px 14px; font-size: 12px; letter-spacing: .06em; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.card { border: 1px solid ${C.line}; border-radius: 14px; padding: 12px 14px; background: #fff; }
.card b.big { display: block; font-size: 26px; color: ${C.green}; letter-spacing: -.02em; }
.card.hl { background: ${C.paper}; border-color: #eadfc8; }
.steps { counter-reset: s; display: grid; gap: 8px; margin: 8px 0; }
.step { display: grid; grid-template-columns: 36px 1fr; gap: 10px; align-items: start; }
.step i { counter-increment: s; width: 32px; height: 32px; border-radius: 50%; background: ${C.green}; color: #fff; font-style: normal; font-weight: 800; display: grid; place-items: center; }
.step i::before { content: counter(s); }
.step b { display: block; }
ul.tick { list-style: none; padding: 0; margin: 6px 0; }
ul.tick li { padding: 5px 0 5px 26px; position: relative; border-bottom: 1px dashed ${C.line}; }
ul.tick li::before { content: '✓'; position: absolute; left: 2px; top: 4px; color: #fff; background: ${C.green2}; width: 17px; height: 17px; border-radius: 50%; font-size: 11px; display: grid; place-items: center; font-weight: 800; }
ul.must li::before { content: '!'; background: ${C.orange}; }
.legend { display: grid; gap: 8px; }
.legend div { display: flex; align-items: center; gap: 10px; }
.legend i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
.note { font-size: 10.5px; color: ${C.muted}; }
.phase { border-left: 4px solid ${C.green2}; padding: 6px 0 6px 12px; margin: 8px 0; }
.phase.now { border-color: ${C.orange}; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
td, th { padding: 7px 8px; border-bottom: 1px solid ${C.line}; text-align: left; }
th { font-size: 11px; color: ${C.muted}; text-transform: uppercase; letter-spacing: .06em; }
td.n { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.contact { background: ${C.ink}; color: #fff; border-radius: 16px; padding: 16px 18px; display: flex; gap: 16px; align-items: center; }
.contact img { width: 52px; height: 52px; border-radius: 12px; background: #fff; padding: 4px; }
.contact b { font-size: 16px; }
.contact span { color: #cfcac0; font-size: 13px; }
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 22px; margin-top: 10px; }
.sign div { border-bottom: 1px solid #999; height: 30px; font-size: 11px; color: ${C.muted}; display: flex; align-items: flex-end; }
`;

const LIAISON = `<div class="contact"><img src="${icon}" alt=""><div><b>Thanduxolo Makeleni</b><br><span>Township Onboarding Liaison Officer · Ekoyini</span><br><span>WhatsApp 064 004 5465 · support@ekoyini.co.za · www.ekoyini.co.za</span></div></div>`;
const top = (label) => `<div class="top"><img src="${logo}" alt="Ekoyini"><span>${label}</span></div>`;
const foot = (n, label) => `<div class="foot"><span>Ekoyini Holdings · Gqeberha · ${label}</span><span>Page ${n}</span></div>`;
const shell = (title, pages) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${pages.join('')}</body></html>`;

// ── example order split (app rules: 7% beer markup, 3% Care & Handling,
//    R40 for 3 km + R6/km, R20 peak surge) ───────────────────────────────
const items = 600; // what the customer pays for the drinks
const tavernShare = items / 1.07; // the tavern's own shelf price
const care = Math.min(40, Math.max(10, items * 0.03));
const driverShare = 40 + 2 * 6 + 20; // 5 km in the evening peak
const ekoyiniShare = items - tavernShare + care;
const customerTotal = items + care + driverShare;

// ═════════════════════════ TAVERN PROPOSAL ═════════════════════════════
const T = 'Partner Tavern Proposal';
const tavernPages = [
  `<section class="page cover">
    <div class="cover-logo"><img src="${logo}" alt="Ekoyini"></div>
    <div class="cover-band">
      <div class="kicker" style="color:${C.orange2}">Partner Tavern Proposal · Nelson Mandela Bay</div>
      <h1>Your tavern, on every phone in the kasi.</h1>
      <p>Ekoyini brings your shelf to customers who can't come to you: at home, at the braai, late at night or in the rain. You keep selling at your price. We bring the orders, the payment and the driver.</p>
    </div>
    <div class="cover-body">
      <div class="grid3">
        <div class="card hl"><b class="big">R0</b>to join. No setup or monthly fee.</div>
        <div class="card hl"><b class="big">100%</b>of your shelf price, paid to you daily at 12:00.</div>
        <div class="card hl"><b class="big">0</b>stock risk. You sell from your own shelf.</div>
      </div>
      <h3 style="margin-top:22px">Inside</h3>
      <ul class="tick">
        <li>The opportunity: the customers you are missing today</li>
        <li>How an Ekoyini order works, step by step</li>
        <li>What you can earn: real numbers, with charts</li>
        <li>Fill the quiet days: what Ekoyini does for Monday to Thursday</li>
        <li>What we ask of every partner tavern</li>
        <li>From partner listing to your own Ekoyini store</li>
      </ul>
      <p style="margin-top:20px"><span class="pill">FOUNDING PARTNERS WANTED</span></p>
      <p class="note" style="margin-top:8px">The first taverns in each area are featured on the Ekoyini app as founding partners.</p>
    </div>
    ${foot(1, T)}
  </section>`,

  `<section class="page">${top(T)}
    <div class="kicker">The opportunity</div>
    <h2>The customer who never reaches your counter</h2>
    <p class="lead">Every weekend, people want a drink but stay home: no transport, no one to send, it's late, it's raining, it isn't safe to walk, or the braai is already going. Today that sale is lost. With Ekoyini, it comes to you as an order.</p>
    <div class="grid2" style="margin:14px 0">
      <div class="card"><h3 style="margin-top:0">What changes for your tavern</h3>
        <ul class="tick">
          <li>Extra sales on top of your walk-in customers</li>
          <li>Orders when you are quiet: weekdays, early evening, rainy days</li>
          <li>Bigger baskets: cases, quarts in crates, spirits and mixers together</li>
          <li>Card payments handled for you; no cash risk at your counter</li>
          <li>Your name and photos on the app: free advertising in your area</li>
        </ul></div>
      <div class="card"><h3 style="margin-top:0">Why customers choose Ekoyini</h3>
        <ul class="tick">
          <li>Order on the phone in a minute: card, EFT or cash</li>
          <li>Live tracking of the driver to the gate</li>
          <li>Tamper-proof Safety Seal on spirits</li>
          <li>Bottles &amp; crates handled properly</li>
          <li>Local taverns they already know and trust</li>
        </ul></div>
    </div>
    <h3>Where a R${customerTotal.toFixed(0)} order goes (example: R600 of beer, 5 km, evening)</h3>
    <div style="display:flex;gap:26px;align-items:center">
      ${donut([{ v: tavernShare, c: C.green }, { v: driverShare, c: C.orange }, { v: ekoyiniShare, c: C.green3 }], { center: R(customerTotal) })}
      <div class="legend">
        <div><i style="background:${C.green}"></i><span><b>${R(tavernShare)}</b> to the tavern: your full shelf price</span></div>
        <div><i style="background:${C.orange}"></i><span><b>${R(driverShare)}</b> to the driver: delivery and evening fee</span></div>
        <div><i style="background:${C.green3}"></i><span><b>${R(ekoyiniShare)}</b> to Ekoyini: our 7% on top and Care &amp; Handling, which pay for the app, card fees and marketing</span></div>
      </div>
    </div>
    <p class="note" style="margin-top:10px">Ekoyini's markup is added <b>on top of</b> your shelf price, so the customer pays it, not you. You never discount to be on Ekoyini.</p>
    ${foot(2, T)}
  </section>`,

  `<section class="page">${top(T)}
    <div class="kicker">Fill the quiet days</div>
    <h2>Monday to Thursday don't have to be dead days</h2>
    <p class="lead">Your fridges run, your lights are on and your staff are paid every day of the week, but most of your money comes in on Friday and Saturday. Ekoyini brings orders into the quiet hours, so the week pays for itself.</p>
    ${weekStack([
      { label: 'Mon', walk: 30, app: 9 },
      { label: 'Tue', walk: 28, app: 9 },
      { label: 'Wed', walk: 32, app: 10 },
      { label: 'Thu', walk: 40, app: 11 },
      { label: 'Fri', walk: 85, app: 16 },
      { label: 'Sat', walk: 100, app: 18 },
      { label: 'Sun', walk: 55, app: 13 },
    ])}
    <p class="note">Illustration only. A handful of app orders lifts a quiet Tuesday by about a third, while on a Saturday the same orders are a smaller share. That's why weekday orders matter most to your bottom line.</p>
    <div class="grid2" style="margin-top:10px">
      <div class="card"><h3 style="margin-top:0">Why weekday orders are worth more to you</h3>
        <ul class="tick">
          <li><b>No extra fixed costs</b>: rent, fridges, lights and staff are already paid for. Most of every extra rand is profit.</li>
          <li><b>Your staff stay busy</b> packing orders instead of waiting for walk-ins.</li>
          <li><b>Stock keeps moving</b>: less money stuck on the shelf between weekends, fresher stock in the fridge.</li>
          <li><b>Steadier cash flow</b>: you are paid every day at 12:00, not only after a big weekend.</li>
        </ul></div>
      <div class="card"><h3 style="margin-top:0">The customers who buy when you're quiet</h3>
        <ul class="tick">
          <li><b>After work</b>: people who get home tired and won't walk to the tavern.</li>
          <li><b>Mid-month</b>: card customers who still buy between paydays.</li>
          <li><b>Bad weather</b>: rain and wind keep walk-ins away, but phones still order.</li>
          <li><b>At home</b>: soccer on TV, visitors, a quiet braai, a birthday at home.</li>
          <li><b>Safety</b>: customers who don't want to walk with money after dark.</li>
        </ul></div>
    </div>
    <div class="card hl" style="margin-top:12px"><b>Example:</b> a tavern doing 3 Ekoyini orders on each quiet weekday (Monday to Thursday) adds about <b>${R(3 * 4 * 550)} a week</b>, or <b>${R(3 * 4 * 550 * 4.3)} a month</b>, in sales at its own shelf prices, on days that usually just cover costs.</div>
    ${foot(3, T)}
  </section>`,

  `<section class="page">${top(T)}
    <div class="kicker">How it works</div>
    <h2>Five steps from order to gate</h2>
    <div class="steps">
      <div class="step"><i></i><div><b>The customer orders on Ekoyini</b>Picks drinks, pays by card, EFT or cash, and drops a pin or landmark.</div></div>
      <div class="step"><i></i><div><b>Your WhatsApp gets the order</b>Our dispatcher sends you exactly what to pack and the name of the driver who will collect. No customer address or phone is shared with you.</div></div>
      <div class="step"><i></i><div><b>You pack it: cold, complete, ready</b>Your dedicated packer has it ready at the counter within 10 minutes.</div></div>
      <div class="step"><i></i><div><b>The driver collects with the order code</b>No queue. The driver quotes the code, takes the order and goes.</div></div>
      <div class="step"><i></i><div><b>Delivered, and you are paid</b>The customer gets it at the gate. You are paid your shelf price for every delivered order, daily at 12:00, for the day before.</div></div>
    </div>
    <div class="kicker" style="margin-top:16px">What you can earn</div>
    <h2>Extra sales a month, from Ekoyini orders alone</h2>
    ${bars([
      { label: '3 orders a day', v: 3 * 550 * 30 },
      { label: '8 orders a day', v: 8 * 550 * 30 },
      { label: '15 orders a day', v: 15 * 550 * 30 },
    ])}
    <p class="note">Extra turnover through your till at your own shelf prices, at about R550 per order (your share of a typical order). Your normal profit margin applies to every one of these sales. These are illustrations, not a promise: real numbers depend on your area, stock, speed and how much you promote Ekoyini to your customers.</p>
    ${foot(4, T)}
  </section>`,

  `<section class="page">${top(T)}
    <div class="kicker">Partner standards</div>
    <h2>What we ask of every partner tavern</h2>
    <p>Customers judge Ekoyini by the slowest tavern. These standards protect your name and ours.</p>
    <ul class="tick must">
      <li><b>A valid liquor licence</b> for your premises, and a copy for our file. Every sale on Ekoyini is your licensed sale.</li>
      <li><b>A dedicated WhatsApp number</b> for Ekoyini orders only, answered during trading hours.</li>
      <li><b>A dedicated packer on busy nights and weekends</b>: one person whose job is Ekoyini orders.</li>
      <li><b>Drivers never wait in the queue.</b> Orders are packed and waiting at the counter within 10 minutes.</li>
      <li><b>Cold and complete</b>: every item as ordered, beers and ciders cold, spirits with seals intact.</li>
      <li><b>Your shelf price, honestly</b>: tell us when your prices change so the app stays correct.</li>
      <li><b>Legal trading hours</b>, and <b>no sales to anyone under 18</b>. Drivers check ID at the gate.</li>
      <li><b>Bottles &amp; crates</b> handled as agreed for returnable quarts.</li>
      <li><b>3 to 5 photos</b> of your tavern (outside sign, counter, fridges) for your partner listing.</li>
    </ul>
    <h3>What Ekoyini does for you</h3>
    <div class="grid2">
      <div class="card"><ul class="tick"><li>The app, website and customer support</li><li>Card payments (Yoco) and payment checks</li><li>Drivers, dispatch and live tracking</li></ul></div>
      <div class="card"><ul class="tick"><li>Marketing in your area: TikTok, WhatsApp, posters</li><li>Daily payout at 12:00, with a clear statement</li><li>Your tavern featured on the app</li></ul></div>
    </div>
    ${foot(5, T)}
  </section>`,

  `<section class="page">${top(T)}
    <div class="kicker">Growing together</div>
    <h2>From partner listing to your own Ekoyini store</h2>
    <div class="phase now"><b>Phase 1 · Now: Partner Tavern</b><br>Your name, area and photos in the app's Partner Taverns section. Orders are sent to you by WhatsApp.</div>
    <div class="phase"><b>Phase 2 · Featured Store</b><br>Your own page on Ekoyini: your specials, your opening hours, your best sellers.</div>
    <div class="phase"><b>Phase 3 · Full Ekoyini Store</b><br>Your own catalogue and stock on the app, orders straight to your tablet, and your own sales reports.</div>
    <h3>Your daily statement</h3>
    <table>
      <tr><th>Example day</th><th>Orders</th><th style="text-align:right">You are paid</th></tr>
      <tr><td>Weekday</td><td>4</td><td class="n">${R(4 * 550)}</td></tr>
      <tr><td>Friday</td><td>10</td><td class="n">${R(10 * 550)}</td></tr>
      <tr><td>Saturday</td><td>14</td><td class="n">${R(14 * 550)}</td></tr>
      <tr><td>Month-end Saturday</td><td>20</td><td class="n">${R(20 * 550)}</td></tr>
    </table>
    <p class="note">Illustration at about R550 per order. Paid the next day at 12:00, plus bottles &amp; crates.</p>
    <h3>Ready to join?</h3>
    <ul class="tick"><li>Reply on WhatsApp with your tavern name and area</li><li>Send your licence copy, Ekoyini WhatsApp number and photos</li><li>We visit, set you up and do a test order together</li></ul>
    ${LIAISON}
    <div class="sign"><div>Tavern name</div><div>Owner / manager</div><div>Ekoyini WhatsApp number</div><div>Signature &amp; date</div></div>
    ${foot(6, T)}
  </section>`,
];

// ═════════════════════════ DRIVER PROPOSAL ═════════════════════════════
const D = 'Driver Partner Proposal';
const perDelivery = 60; // a typical delivery: base, a few km, some peak and load fees
const driverPages = [
  `<section class="page cover">
    <div class="cover-logo"><img src="${logo}" alt="Ekoyini"></div>
    <div class="cover-band" style="background:${C.ink}">
      <div class="kicker" style="color:${C.orange2}">Driver Partner Proposal · Nelson Mandela Bay</div>
      <h1>Drive your own hours. Keep every delivery rand.</h1>
      <p>Ekoyini delivers drinks from trusted local taverns to customers in the kasi. You choose the jobs, you drive, and you keep 100% of the delivery, evening and priority fees.</p>
    </div>
    <div class="cover-body">
      <div class="grid3">
        <div class="card hl"><b class="big">100%</b>of delivery, surge and priority fees are yours.</div>
        <div class="card hl"><b class="big">Daily</b>pay at 12:00 for yesterday's trips.</div>
        <div class="card hl"><b class="big">Short</b>trips: local taverns to nearby homes.</div>
      </div>
      <h3 style="margin-top:22px">Works with what you already do</h3>
      <p>Drive for Uber, Bolt or a taxi? Add Ekoyini jobs between trips and on busy weekend nights. No fees to join and no shifts.</p>
      <p style="margin-top:20px"><span class="pill">DRIVERS WANTED · ZWIDE · MOTHERWELL · NEW BRIGHTON · KWAZAKHELE · WELLS ESTATE</span></p>
    </div>
    ${foot(1, D)}
  </section>`,

  `<section class="page">${top(D)}
    <div class="kicker">How you earn</div>
    <h2>Every delivery fee goes straight to you</h2>
    <table>
      <tr><th>Fee</th><th>How it works</th><th style="text-align:right">You get</th></tr>
      <tr><td>Delivery</td><td>First 3 km, then R6 for every extra km</td><td class="n">R40 + R6/km</td></tr>
      <tr><td>Heavy load</td><td>Big orders over 20 kg (crates of quarts)</td><td class="n">R1.50/kg</td></tr>
      <tr><td>Evening</td><td>16:00 to 22:00</td><td class="n">+R20</td></tr>
      <tr><td>Late night</td><td>22:00 to 04:00</td><td class="n">+R30</td></tr>
      <tr><td>Super Priority</td><td>Customer pays extra to be first</td><td class="n">+R10 to R50</td></tr>
    </table>
    <h3 style="margin-top:16px">What one trip can pay</h3>
    ${hbars([
      { label: '2 km, afternoon', v: 40, c: C.green3 },
      { label: '5 km, evening', v: 40 + 12 + 20, c: C.green2 },
      { label: '6 km, crate, late', v: 40 + 18 + 30 + 9, c: C.green },
      { label: '+ Super Priority', v: 40 + 18 + 30 + 9 + 30, c: C.orange },
    ])}
    <div class="kicker" style="margin-top:12px">Your week</div>
    <h2>What a week of Ekoyini trips can look like</h2>
    ${bars([
      { label: '4 trips a day', v: 4 * perDelivery * 6 },
      { label: '8 trips a day', v: 8 * perDelivery * 6 },
      { label: '14 trips a day', v: 14 * perDelivery * 6 },
    ], { colors: [C.orange2, C.orange, C.green] })}
    <p class="note">Six days a week, at about R${perDelivery} a trip. These are illustrations, not a promise: your real earnings depend on how many jobs you take, distance, time of day and customer demand. Fuel and vehicle costs are your own.</p>
    ${foot(2, D)}
  </section>`,

  `<section class="page">${top(D)}
    <div class="kicker">How a job works</div>
    <h2>From job post to paid</h2>
    <div class="steps">
      <div class="step"><i></i><div><b>A job is posted in the drivers' WhatsApp group</b>Area, tavern and fee. No customer details in the group.</div></div>
      <div class="step"><i></i><div><b>You accept and get the full job privately</b>Pickup tavern, customer address, landmark and map pin, plus your own tracking link.</div></div>
      <div class="step"><i></i><div><b>Collect with the order code</b>The tavern has it packed and waiting. No queue. Tap "Confirm pickup" on your link.</div></div>
      <div class="step"><i></i><div><b>Deliver and check ID</b>Share your live location while you drive. Check the customer is 18 or older, then hand over.</div></div>
      <div class="step"><i></i><div><b>Paid daily at 12:00</b>All of yesterday's fees in one payment. On cash orders you keep your fees from the cash and pay the rest in.</div></div>
    </div>
    <h3>Cash orders, made simple</h3>
    <div class="grid2">
      <div class="card"><b>You collect R900 cash</b><br>Your fees on that trip: R72<br>You pay in: <b>R828</b></div>
      <div class="card"><b>The Payouts statement</b><br>Shows every trip, your fees, cash held and what you are paid, or what to pay in, every day.</div>
    </div>
    <h3>What we ask of every driver</h3>
    <ul class="tick must">
      <li>A valid driver's licence and a roadworthy car or motorbike</li>
      <li>A smartphone with data and WhatsApp</li>
      <li>Check ID: <b>no deliveries to anyone under 18</b>, and never to schools or places of worship</li>
      <li>Zero alcohol while on duty, and respect for every customer and tavern</li>
      <li>Seals and packaging untouched; cash orders accounted for the same day</li>
    </ul>
    ${foot(3, D)}
  </section>`,

  `<section class="page">${top(D)}
    <div class="kicker">Why Ekoyini</div>
    <h2>Built for drivers in the kasi</h2>
    <div class="grid2">
      <div class="card"><h3 style="margin-top:0">Fair pay</h3><ul class="tick"><li>100% of delivery, surge and priority fees</li><li>Extra pay for heavy crates and late nights</li><li>Daily payouts with a clear statement</li></ul></div>
      <div class="card"><h3 style="margin-top:0">Your freedom</h3><ul class="tick"><li>No shifts, no fees to join</li><li>Take jobs near you, when it suits you</li><li>Works alongside Uber, Bolt or taxi trips</li></ul></div>
      <div class="card"><h3 style="margin-top:0">Safer jobs</h3><ul class="tick"><li>Paid orders, or cash only from trusted customers</li><li>Exact pin and landmark for every drop</li><li>Customers rate the service, and so can you</li></ul></div>
      <div class="card"><h3 style="margin-top:0">Growing fast</h3><ul class="tick"><li>Partner taverns across Nelson Mandela Bay</li><li>Weekend, month-end and match-day demand</li><li>Top drivers get first pick of jobs</li></ul></div>
    </div>
    <h3>Join in three steps</h3>
    <ul class="tick"><li>WhatsApp us your name, area and vehicle</li><li>Send a photo of your licence and ID for our records</li><li>Join the drivers' group and take your first job</li></ul>
    ${LIAISON}
    <div class="sign"><div>Driver name</div><div>WhatsApp number</div><div>Vehicle &amp; registration</div><div>Signature &amp; date</div></div>
    ${foot(4, D)}
  </section>`,
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, title, pages] of [
    ['Ekoyini-Partner-Tavern-Proposal', 'Ekoyini Partner Tavern Proposal', tavernPages],
    ['Ekoyini-Driver-Partner-Proposal', 'Ekoyini Driver Partner Proposal', driverPages],
  ]) {
    const html = shell(title, pages);
    fs.writeFileSync(path.join(__dirname, `${file}.html`), html);
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({ path: path.join(__dirname, `${file}.pdf`), format: 'A4', printBackground: true });
    console.log('built', file);
  }
  await browser.close();
})();
