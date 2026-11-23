// One Taverns tab in admin (founder, 23 Nov 2026): add a tavern, its WhatsApp
// number, location, portal and receipt details in one place.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("admin has a Taverns tab with its own section and script", () => {
  const html = read("admin/admin.html");
  assert.match(html, /id="sectionTabTaverns"[^>]*showSection\('taverns'/);
  assert.match(html, /id="tavernsSection"[\s\S]*id="tavernsBody"/);
  assert.match(html, /<script src="taverns\.js\?v=\w+"><\/script>/);
  assert.ok(!html.includes("tavernAccessBody"), "the tavern portal no longer sits under Drivers");
});

test("tavern code lives only in taverns.js, so nothing is defined twice", () => {
  for (const f of ["admin/drivers.js", "admin/delivery-settings.js"]) {
    const src = read(f);
    for (const fn of ["addTavern", "saveTavernLocation", "saveTavernDetails", "tavernAccessAction", "loadTavernAccess"]) {
      assert.ok(!new RegExp(`function ${fn}\\b`).test(src), `${fn} is still in ${f}`);
    }
  }
  const taverns = read("admin/taverns.js");
  for (const fn of ["addTavern", "saveTavernPhone", "saveTavernLocation", "clearTavernLocation", "saveTavernDetails", "tavernPortal"]) {
    assert.match(taverns, new RegExp(`function ${fn}\\b`), fn);
  }
});

test("a tavern's WhatsApp number can be changed, saved as 27..., super admins only", () => {
  const src = read("routes/delivery.js");
  const route = src.slice(src.indexOf('app.patch("/admin/taverns/:id/phone"'));
  assert.ok(route.length > 0, "phone route exists");
  assert.match(route.slice(0, 200), /requireAdmin, requireSuperAdmin/);
  assert.match(route.slice(0, 900), /toSaWhatsApp\(typed\)/);
  assert.match(route.slice(0, 1500), /logAdminAction\(req, "UPDATE_TAVERN_PHONE"/);
});
