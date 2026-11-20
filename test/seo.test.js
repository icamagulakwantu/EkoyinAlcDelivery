const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const read = (f) => fs.readFileSync(`public/${f}`, "utf8");

test("robots.txt points at the sitemap and blocks private paths", () => {
  const r = read("robots.txt");
  assert.match(r, /Sitemap: https:\/\/www\.ekoyini\.co\.za\/sitemap\.xml/);
  for (const p of ["/admin/", "/api/", "/order/", "/webhooks/"]) assert.ok(r.includes(`Disallow: ${p}`), p);
});

test("sitemap lists only public pages", () => {
  const s = read("sitemap.xml");
  assert.match(s, /<loc>https:\/\/www\.ekoyini\.co\.za\/<\/loc>/);
  assert.match(s, /shop\.html/);
  for (const f of ["cart", "checkout", "track", "profile", "login", "admin"]) assert.ok(!s.includes(f), f);
});

test("private pages are noindex", () => {
  for (const f of ["cart", "checkout", "track", "driver-track", "driver", "tavern", "profile", "login", "signup", "forgot-password", "update-password", "order-confirmation", "unsubscribe", "404"]) {
    assert.match(read(`${f}.html`), /name="robots" content="noindex/, f);
  }
});

test("home and shop have title, description, canonical; home has one h1 and JSON-LD", () => {
  for (const f of ["index", "shop"]) {
    const h = read(`${f}.html`);
    assert.match(h, /<title>[^<]{20,}<\/title>/);
    assert.match(h, /name="description" content="[^"]{60,}"/);
    assert.match(h, /rel="canonical" href="https:\/\/www\.ekoyini\.co\.za\//);
  }
  const home = read("index.html");
  assert.equal((home.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(home, /Gqeberha/);
  const m = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m);
  const data = JSON.parse(m[1]);
  assert.ok(data["@graph"].some((n) => n["@type"] === "LiquorStore"));
});
