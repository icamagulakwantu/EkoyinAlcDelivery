# Ekoyini Drinks Delivery: Claude Code handoff (8 Nov 2026)

## 0. Read first: changed since this handoff (8 Nov, PR #3, deployed and checked live)
These points replace anything older in the sections below.
- **Cart and checkout are restyled** to the shop style (shared `public/app.css`, dark `#17140e` buttons, sticky total bars). Section 8 item 1 is done.
- **The R10 tamper-proof Safety Seal is built**: spirits only, charged by the server, saved in `Order.safetySealFee`, shown on the admin order card.
- **The service fee is "Care & Handling"**: 3% of the items, minimum R10, maximum R40 (`CARE_FEE_PCT/MIN/MAX` in `public/pricing.js`, founder decision 10 Nov; was 5%/R15/R75).
- **Delivery fee (10 Nov)** = distance (R40 covers 3 km, founder 10 Nov, then R6/km to the nearest tavern/dark store with a location) + load (R1.50/kg above 20 kg, weight estimated per pack by `itemWeightKg`, server weighs from the catalogue). Load rides inside `Order.deliveryFee`; all delivery, load, surge and priority money goes to the driver. Admin Delivery tab can add taverns (`POST /admin/taverns`). The 16 founder taverns (dark stores, with pins) are created by `prisma/seed.js` when missing; the old sample taverns are removed by the seed.
- **Bottles & crates (10 Nov)**: returnable quarts (SAB + Windhoek, Flying Fish, Redd's MXD, Strongbow; NOT Amstel/Corona/Heineken/Sol/Stella/Hunter's) pay R52 per crate of 12 or R3 a loose bottle (`bottleDepositFor` in `public/pricing.js`), saved in `Order.bottleDepositFee`; customer picks crate or loose at checkout.
- **One total calculation**: cart, checkout and server all use `priceOrder()` in `public/pricing.js`. Change fees there, not in page code.
- **Card payment (Yoco) is the default** in checkout. Paid checkouts become orders via the webhook OR the confirmation-page status check (`completePaidCheckout` in `server.js`, atomic claim, never twice).
- **Prices corrected 8 Nov, fixed 9 Nov**: `lib/price-corrections-2026-11-08.js` (HIGHEST regular shelf price of the single pack + 7%/5%; never crate/12, never promo; a test enforces it) overrides the older list; review sheet `prisma/data/price-corrections-2026-11-08.csv`. Rows marked estimate are worth checking on the shelf.
- **Security (9 Nov)**: every public table has row level security and NO grants to `anon`/`authenticated` (the browser uses Supabase for login only). `ensure-schema.js` re-applies this on every deploy; never re-grant. Admin token needs 32+ chars; webhooks older than 5 min are rejected; set `TRUST_PROXY_HOPS` from the `[proxy]` log lines.
- **Marketing & reports (9 Nov)**: `MarketingConsent` table (POPIA opt-in: signup, checkout, profile switch, signed unsubscribe links via `MARKETING_LINK_SECRET`); admin **Reports** tab (`admin/reports.js`, section name `sales` because `reports` is the driver-reports tab); CSV exports are super-admin only and logged; `/analytics.js` loads Cloudflare Web Analytics only when `CF_ANALYTICS_TOKEN` is set. `TRUST_PROXY_HOPS=3` is set on Render.
- **Order alerts (9 Nov)**: `admin/order-alerts.js` (sound, notification, banner; dispatchers tap "Turn on order alerts"); "Post job to drivers group" button builds a WhatsApp job post with NO customer details; new-order emails go to `ORDER_ALERT_EMAILS` (fallback `ADMIN_EMAILS`). Step 2 (WhatsApp Business Platform + shared team inbox for one number across 8 people) is advised, not built.
- **Founder prices (9 Nov, late)**: `lib/founder-prices-2026-11-09.js` holds FINAL prices that win over everything (Heineken dumpies R145, Castle Lite/Black Label cans R130, Savanna 500ml NRB six-pack R210, Appletiser R45, Red Bull 250ml single R30, Coke 500ml can R20, strategic spirits at Siba cost + 14%). Alcoholic can six-packs are never under R130 (Corona and Savanna excepted). Stock is bought at Siba; a test keeps every receipt item at or above its Siba cost.
- **Six-packs only** for beer/cider/RTD cans, dumpies and 500ml NRBs; cold drinks, energy drinks, water and ice are loose (`packSizeFor()` in `lib/catalogue-2026-11.js`; Mofaya and Schweppes cans stay six-packs).
- **Shelf order (9 Nov)**: `public/shelf-order.js` (shared by shop, `/api/products`, admin stock list). Water & Ice is one section; Mofaya + Red Bull are Energy Drinks; Ponchos Coffee is Tequila. Monin syrups are R230.99 and must never be under R230 (founder; a test enforces it).
- **Service worker cache is `ekoyini-shell-v13`**. Bump it again when static pages change.
- **Tests**: 80 (incl. `test/founder-prices.test.js`, `test/shelf-order.test.js`), including `test/reports-marketing.test.js`, `test/order-pricing.test.js` and `test/price-corrections.test.js`.

## 1. What this is
Alcohol delivery app for Gqeberha townships (ride-along delivery). Founder: Thandu (Thanduxolo Makeleni), Ekoyini Group.
Stack: Node/Express 4, Prisma 5, Supabase Postgres, Yoco payments, vanilla HTML/JS in `/public` and `/admin`, hosted on Render, domain www.ekoyini.co.za.

## 2. Where everything lives
- Repo: `icamagulakwantu/EkoyinAlcDelivery`, branch `claude/ekoyini-alcohol-delivery-1xnmtz` (Render deploys this branch on every commit).
- Render: workspace `tea-da2vkrflk1mc73f3do20`, service `ekoyini-api` = `srv-da5g9rbm8hqs73cjm1hg`, FREE plan (cold starts). Build `npm install && npx prisma generate`, start `node server.js`. The dashboard commands override `render.yaml`.
- Supabase LIVE database: project `acmpbftpiwmdzwoxbjxp` ("ekoyini-2"). Do NOT write to `tvuyimcgspxyiuxwymjr` (old stale copy) or `czbwwofxbzukpwyvadrh`.
- Source of truth for product photos: the founder's other app, repo `icamagulakwantu/I-Camagu` (live API `https://i-camagu.co.za/api/basket/catalogue`).
- Live product list: `https://www.ekoyini.co.za/api/products`.

## 3. CRITICAL: the deploy runs the tests
`npm install` runs `postinstall`, which runs `node --test` plus the migrations and the catalogue/photo scripts. If any test fails the deploy fails and the old code stays live. This happened 6 Nov 20:38 to 7 Nov 03:10 (`roundTavern` was exported but never defined). Always run `npm test` (or `node --test`) before pushing. Tests need every image path in the photo map to exist.

## 4. Catalogue rules (decided by the founder)
- 328 rows = 322 master workbook SKUs + 5 house products (Mofaya Original R62.94 and Mofaya Orange Ting R62.94 six-packs, Grenadine Syrup Cordial R73.50, Kola Tonic Cordial R47.25, Coca-Cola Original 500ml can R20) + Ice Tropez 6 x 275ml R401.24 (10 Nov, no photo yet).
- Final customer prices live in `lib/catalogue-2026-11.js` (`FINAL_CUSTOMER_PRICES`). Markup is already inside them: 7% beer/cider/RTD/wine, 5% spirits/liqueurs/mixers/water/ice. Never stack a markup on a final price.
- NEVER show "Price coming soon". `PRICE_COMING_SOON` is empty. Every new product needs a real shelf price + the category markup.
- No 375ml spirits. No 1 litre rows (the founder never added them). Black Label is the 750ml quart. Breezer has no quarts. MXD is quart (660ml) + can only. Chillers Punch is cans only. Brutal Fruit has no 750ml. Extreme is an alcoholic RTD.
- Prices the founder kept at his list: Johnnie Walker Red R315, Klipdrift Export R252, Castle Milk Stout quart R29.96. Heineken dumpies are R145 (founder, 9 Nov).
- Photos: `public/images/brands/`, mapped in `prisma/catalogue-photo-config.js` (`FORMAT_PHOTO_MAP`, key = `JSON.stringify([name, bottleFormat])`). Exact pack photos only (can is not dumpy is not quart). Better a missing photo than a wrong one. Keep new photos small (WebP, about 300px).
- Data files: `prisma/data/skus.csv`, `prisma/seed.js`, `prisma/catalogue-update.js`, `prisma/sync-images.js`, `prisma/catalogue-photo-matching.js`.
- Prices that are estimates (shelf price unknown): Thirsti 1.5L R18, Tsitsikamma waters, Coca-Cola 2L R36, Guinness Draught 6-pack R210, Red Bull R34, Appletiser R38, Mofaya, Grenadine, Kola Tonic. Worth checking.
- Unconfirmed pack sizes: Kopparberg can 440ml / dumpy 330ml, Extreme can 440ml / dumpy 330ml.

## 5. Fees and orders (founder decisions)
- No free delivery. Minimum order R300.
- Service fee (now "Care & Handling", see section 0) is its own line, saved in `Order.serviceFee`, included in the server total and the Yoco amount. Decided 10 Nov: 3% of items, min R10, max R40.
- Cooler Box discount: 5% from R2000, 8% from R4000 (founder, 10 Nov), only until 20:00 SA time (comes back 04:00). No other discounts.
- Drivers keep 100% of delivery, surge and priority fees. Dispatch stays manual (admin finds a driver, sends details by WhatsApp). One shared stock and one platform price (no per-tavern stock). Low commission while taverns are onboarded.
- Yoco fee is 3.25% + R2.50 per transaction. The founder floated 6% / 8% markups to absorb it, then said the workbook prices already include 5% / 7%. Not applied. Ask before touching.

## 6. Payments (Yoco)
- `payments.js` reads the checkout id from `payload.metadata.checkoutId` and only `payment.succeeded` creates an order (fixed 6 Nov, tested in `test/yoco-webhook.test.js`). Webhook route `/webhooks/yoco`. Render env vars: `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET`. Founder says Yoco works.
- Yoco online checkout takes cards, Apple Pay and Google Pay. There is no scan-to-pay QR. That would need SnapScan or Zapper (not built).
- Never paste secret keys in chat or commit them.

## 7. UI done
- `public/shop.html`: borderless product tiles, multiply-blended photos (no white squares), dark round add button, floating "View cart" bar (`#cartFab`), sticky search + category bar. Styles are in the `<style id="shop-polish">` block, loaded after `premium.css`, plus `public/app.css`.
- Cart, checkout and order confirmation restyled to match (section 0).
- Home page no longer says "Kasi delivery" (a company with that name exists). Do not bring it back.
- **Home redesigned 9 Nov (night)** as an app home: address chip, search, deals carousel, live Cooler Box card from the cart, category photo tiles, product rails with one-tap add, floating cart bar. Styles in `public/home-app.css` (prefix `hx-`). Watch out: `app.css` has a global `.empty` class; don't reuse that name.
- Not yet restyled to match: track, profile, admin.

## 8. Open work (suggested order)
1. ~~Restyle cart + checkout~~ (done 8 Nov).
2. Fee decisions are done (Care & Handling 5%/R15/R75, R10 seal). Optional: make the fee editable in admin settings instead of hard-coded.
3. Case reservations: customer-facing AND stock reservations (atomic, expiring, released on cancel). Needs a Prisma migration, so do it where tests can run.
4. Driver pay: distance + load, configurable rates in settings, 100% of delivery/surge/priority fees, payout shown to admin before assigning a driver. Rand rates not decided yet.
5. Dependency vulnerabilities (npm audit: 1 critical, 2 high, 1 moderate).
6. Move Render off the free plan (cold starts can delay Yoco webhooks).
7. Clean up junk-named image files in `public/images/brands` (e.g. `images (24).jpeg`, `download (n).webp`), updating the photo map at the same time.
8. CSP header was deliberately NOT added (it could break the map and address lookup). Add only with testing.
9. Optional: scan-to-pay (SnapScan/Zapper), soft drinks/water expansion, a real photo for any new product, restyle track + profile.

## 9. Working rules
- Write every change into the README change log (`## Changelog` section, newest entry on top). The founder asked for this every time.
- Work in small, safe steps. The founder is on free usage limits and cannot afford rework or broken deploys. Test first, then push.
- Tell the founder before any Prisma migration. Never push if a test fails.
- Do not touch the other Supabase projects. Do not delete order data. `OrderItem` snapshots name + price, so catalogue changes do not break history.
- Commit trailer to use:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- Verify on the LIVE site after each deploy (products API, a photo, a price). The service worker caches the shell (`ekoyini-shell-v13`), so bump the cache name when you change static pages.
