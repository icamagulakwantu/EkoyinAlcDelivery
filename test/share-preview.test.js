// Link previews (founder, 24 Nov 2026): sharing www.ekoyini.co.za on WhatsApp,
// Facebook or X shows a large picture card, not a plain link.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("home and shop show a large 1200 x 630 share image", () => {
  const img = path.join(__dirname, "..", "public/images/brand/ekoyini-share.jpg");
  assert.ok(fs.existsSync(img), "share image exists");
  assert.ok(fs.statSync(img).size < 300 * 1024, "small enough for WhatsApp previews");
  for (const page of ["public/index.html", "public/shop.html"]) {
    const s = read(page);
    assert.match(s, /property="og:image" content="https:\/\/www\.ekoyini\.co\.za\/images\/brand\/ekoyini-share\.jpg"/, page);
    assert.match(s, /property="og:image:width" content="1200"/, page);
    assert.match(s, /property="og:image:height" content="630"/, page);
    assert.match(s, /name="twitter:card" content="summary_large_image"/, page);
    assert.match(s, /property="og:title"/, page);
    assert.match(s, /property="og:description"/, page);
    assert.match(s, /18\+/, page);
  }
});
