// The Terms and Privacy Policy quote real fees. If a fee in public/pricing.js
// changes and the Terms are not updated, a customer could be shown one number
// and agree to another. These tests fail the deploy instead.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const P = require("../public/pricing.js");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");
const terms = read("terms.html");
const privacy = read("privacy.html");
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&middot;/g, "·").replace(/\s+/g, " ");
const t = text(terms);

test("terms quote the live fee constants", () => {
  assert.ok(t.includes(`R${P.BASE_DELIVERY_FEE}, which covers the first ${P.BASE_DELIVERY_KM} km`), "base delivery");
  assert.ok(t.includes(`R${P.PER_KM_FEE} for every kilometre`), "per km");
  assert.ok(t.includes(`more than ${P.LOAD_FREE_KG} kg pay R${P.LOAD_FEE_PER_KG.toFixed(2)}`), "load fee");
  // The surge constants are not exported, so read them from the source.
  const src = read("pricing.js");
  const num = (name) => Number(src.match(new RegExp(`const ${name} = (\\d+)`))[1]);
  assert.ok(t.includes(`peak-hours fee of R${num("PEAK_SURGE_FEE")} applies from ${num("PEAK_START_HOUR")}:00 to ${num("LATE_NIGHT_START_HOUR")}:00`), "peak fee");
  assert.ok(t.includes(`late-night fee of R${num("LATE_NIGHT_SURGE_FEE")} applies from ${num("LATE_NIGHT_START_HOUR")}:00 to 0${num("LATE_NIGHT_END_HOUR")}:00`), "late-night fee");
  assert.ok(t.includes(`${P.CARE_FEE_PCT * 100}% of the price of the items, with a minimum of R${P.CARE_FEE_MIN} and a maximum of R${P.CARE_FEE_MAX}`), "care fee");
  assert.ok(t.includes(`optional R${P.SAFETY_SEAL_FEE} fee`), "safety seal");
  const crate = P.CRATE_SIZE * P.BOTTLE_DEPOSIT_IN_CRATE + 28;
  assert.ok(t.includes(`R${crate} for each full crate of ${P.CRATE_SIZE}`), "crate charge");
  assert.ok(t.includes(`R${P.BOTTLE_DEPOSIT_LOOSE} for each loose bottle`), "loose bottle");
  const prio = P.PRIORITY_OPTIONS.filter((n) => n > 0);
  assert.ok(t.includes(`(R${prio[0]} to R${prio[prio.length - 1]})`), "priority range");
});

test("terms quote the cooler box rule", () => {
  const src = read("pricing.js");
  assert.match(src, /COOLER_MIN_SUBTOTAL = 2000/);
  assert.match(src, /COOLER_DISCOUNT_PCT = 0\.025/);
  assert.match(src, /COOLER_MAX_DISCOUNT = 50/);
  assert.match(src, /COOLER_FIRST_ORDERS = 5/);
  assert.match(src, /COOLER_CUTOFF_HOUR = 20/);
  assert.ok(t.includes("2.5% off eligible items when they total R2,000 or more, up to a maximum of R50"));
  assert.ok(t.includes("only on your first 5 orders"));
  assert.ok(t.includes("until 20:00"));
});

test("terms quote the cash-on-delivery limits from server.js", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(src, /COD_MIN_ORDER_TOTAL = 300/);
  assert.match(src, /COD_MAX_ORDER_TOTAL = 1500/);
  assert.match(src, /"COD_MIN_DELIVERED_ORDERS", 10/);
  assert.ok(t.includes("between R300 and R1,500"));
  assert.ok(t.includes("at least 10 delivered orders"));
});

test("terms list every returnable quart brand", () => {
  const src = read("pricing.js");
  const m = src.match(/RETURNABLE_QUART_BRANDS = \/\^\(([^)]+)\)\//);
  assert.ok(m, "brand list found");
  for (const brand of m[1].split("|")) assert.ok(t.includes(brand.replace("\\'", "'")), `terms name ${brand}`);
});

test("legal pages are finished: no draft banner, no placeholders", () => {
  for (const [name, html] of [["terms", terms], ["privacy", privacy]]) {
    const body = text(html);
    assert.ok(!/draft for legal review/i.test(body), `${name}: draft banner`);
    assert.ok(!/\[[A-Za-z0-9 /]{1,40}\]/.test(body), `${name}: square-bracket placeholder`);
    assert.ok(!/TODO|TBD|lorem/i.test(body), `${name}: unfinished marker`);
  }
});

test("terms keep the CPA section 49 flags and the limits the law sets", () => {
  assert.equal((terms.match(/class="flag"/g) || []).length, 3, "three flagged boxes (liability, indemnity, acknowledgements)");
  assert.match(terms, /gross negligence/);
  assert.match(terms, /section 61 of the CPA/);
  assert.match(terms, /sections 55 and 56 of the CPA/);
  assert.match(terms, /<h2 id="s21">/);
  assert.match(terms, /<h2 id="s22">/);
  assert.match(terms, /<h2 id="s23">/);
});

test("privacy policy covers what POPIA asks a notice to say", () => {
  const p = text(privacy);
  for (const need of ["responsible party", "Information Officer", "We do not sell", "opt in", "Information Regulator", "section 72", "How long we keep it", "Automated decisions", "Frankfurt", "POPIAComplaints@inforegulator.org.za"]) {
    assert.ok(p.toLowerCase().includes(need.toLowerCase()), `privacy mentions: ${need}`);
  }
});

test("every anchor in the contents lists exists", () => {
  for (const html of [terms, privacy]) {
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(m[1]), `anchor #${m[1]} exists`);
  }
});

test("checkout and signup point to the legal pages", () => {
  assert.match(read("checkout.html"), /terms\.html#s21/);
  assert.match(read("signup.html"), /terms\.html/);
  assert.match(read("signup.html"), /privacy\.html/);
});
