# Ekoyini — Alcohol Delivery Platform

A **mobile-first, ride-along delivery app** for alcohol, tobacco, and beverages in South African townships. Uses on-route e-hailing drivers instead of a dedicated fleet — faster, cheaper, and already trusted by riders.

## Changelog — 6 November 2026 (Receipt calibration & Care fee)

### 9 Nov 2026 (evening): tracking and profile pages restyled
- **Track:**
  - A clear status headline ("Packing your order", "On the way" with the driver's name, "Waiting for your EFT") with the expected time.
  - What was ordered and the total, with payment status (the public tracking response now includes `total`).
  - A **WhatsApp us about this order** button.
  - Signed-in customers see their active orders as one-tap shortcuts.
  - Search uses the dark pill button.
- **Profile:**
  - A compact account row.
  - Quick links: Help on WhatsApp, Track an order, Terms, Privacy.
  - Orders split into **Active** (with a Track button) and **Past orders** (Reorder button, first 5 then "Show all").
  - Each card shows what was ordered; Cancel, Remove and Report driver are quiet text buttons.
  - "Member since" is hidden when the date is missing.
- The support WhatsApp number lives in one place: `EKOYINI_SUPPORT_WHATSAPP` in `public/script.js`.
- Service-worker cache `v7`.

### 9 Nov 2026 (later): security hardening
- **Fixed on the live database (urgent, already applied):** 3 tables, `DriverReport` (driver names and phone numbers), `DeliverySettings` and `_prisma_migrations`, had no row level security. The public Supabase roles (`anon`, `authenticated`: the key in `public/auth.js`) could read AND change them, and the other 8 tables still had those grants. Row level security is now on for every table, and every grant to those roles is removed (now and for future tables). The app connects as the table owner and is unaffected. Supabase's security advisor no longer reports any errors.
- **Same lock-down re-applied on every deploy** by `scripts/ensure-schema.js`, so a new table can never be left open.
- **Admin API token:** only accepted when 32+ characters, compared in constant time, and 10 wrong guesses from one address lock it out for 15 minutes.
- **Yoco webhooks:** validly signed messages older (or newer) than 5 minutes are rejected, so a captured webhook can't be replayed.
- **Proxy count logging:** the first 20 requests after each start log how many entries are in `X-Forwarded-For` (counts only, never addresses), to set `TRUST_PROXY_HOPS` from the Render logs.
- Tests: 58 (new replay test). Staged scenarios: 25 (new: admin token lock-out; replay now a hard check).

### 9 Nov 2026: new orders now reach the dispatch team
Before this, a new order only appeared on the admin dashboard if someone was looking at it. Nothing was sent anywhere.
- **New-order alerts on the admin dashboard** (`admin/order-alerts.js`). Each dispatcher taps **"Turn on order alerts"** once per phone or computer. After that every new order gives a sound, a vibration, a phone notification, a banner (area, total, payment) and "(1) New order" in the tab title. While alerts are on the dashboard checks every 15 seconds, even in the background. If a paid order still has no driver after 3 minutes, it reminds everyone every 3 minutes. Works while the dashboard is open in a browser tab, including in the background; a closed browser gets the email instead.
- **"Post job to drivers group"** button on every paid order without a driver. It opens WhatsApp's chat picker (and copies the text) with a job post for your Bolt drivers group: drop-off area, distance, load, the driver's fee (100% theirs), and cash to collect for COD. **No customer name, phone, street or pin**, because a whole group sees it (POPIA, customer safety). The driver who replies first is assigned with **Assign**, and the full job goes to them privately with **Send WhatsApp to Tavern & Driver**.
- **New-order emails to the whole dispatch team**: set `ORDER_ALERT_EMAILS` on Render (comma-separated, no admin rights needed; falls back to `ADMIN_EMAILS`). Needs `RESEND_API_KEY`. The email shows area, payment, items and an "Open the dashboard" button.
- Service-worker cache `v6`; the service worker opens the dashboard when a notification is tapped.

**Setting up the 8 people:** each person signs up on the site with their email. A super admin adds them under **Admins → role Dispatcher**. Each person opens `/admin/admin.html` on their phone, logs in, taps **Turn on order alerts** and allows notifications.

### 8 Nov 2026 (late): market-readiness evaluation
- Full evaluation in `MARKET_READINESS.md`: 24 staged API scenarios (`staging/`, 23/24 pass), 13 browser scenarios, 57 unit tests, dependency audit, legal-page review. **Verdict: the software is ready; three launch blockers are business setup** (legal placeholders, liquor trading hours not enforced, one live end-to-end order).
- Fixed: friendly 404 page (JSON for `/api/`), browser security headers, `TRUST_PROXY_HOPS` setting plus admin `GET /admin/client-ip` (the rate limits could be bypassed with a faked IP), product photos compressed from 29 MB to 11 MB with the same file names (shop first load 2.5 MB → 0.96 MB), service-worker cache `v5`.
- `scripts/optimize-images.js` now uses palette PNG; its comment says to run it by hand (it never ran on deploy).

### 8 Nov 2026 (night): prices corrected, lower Care & Handling fee, card payments
**Prices.** The founder flagged prices like the Amstel quart at R47.08. A full SKU check found 195 rows off the shelf, almost all too high: quarts at R47, beer six-packs at R165–R210 (shelf ~R90–R120), Monin at R367.50, Glenfiddich 12 at R1081.50. One was too low: Ciroc Original at R378 (shelf R599.99). Every corrected row is now **regular shelf price of the same pack + 7% (beer, cider/RTD, wine) or 5% (spirits, liqueurs, mixers, energy drinks, water)**, the founder's existing rule.
- Data: `lib/price-corrections-2026-11-08.js` (applied before the older list). Review sheet: `prisma/data/price-corrections-2026-11-08.csv` (was / now / shelf price / source).
- 62 rows use a shelf price seen on a retailer listing or already recorded in `SHOP_PRICES`; the rest are marked **estimate** (same brand's other packs or the same price tier) and are worth checking on the shelf.
- Unchanged on purpose (founder-fixed): Johnnie Walker Red R315, Klipdrift Export R252, Castle Milk Stout quart R29.96, Heineken dumpy R117.70, Hennessy VS R682.50, Corona dumpy R135, Bernini cans R133.75, Brutal Fruit cans R144.45, Sambuca Lupini R357.
- Applied on deploy by `scripts/run-catalogue-prices.js` (Render has `APPLY_CATALOGUE_PRICES_ON_DEPLOY=true`). Order history keeps its own price snapshots.

**Care & Handling fee.** Was 5% / 7% / 15% by subtotal band (a R2001 order paid about R160 more than a R1999 one). Now **5% of the items, minimum R15, maximum R75**: industry-style (delivery apps charge roughly 10–15% with a minimum and a cap) but lower, and it never jumps.

**Card payments (Yoco).**
- Checkout now offers "Card, Apple Pay or Google Pay" first and selects it by default; it is only greyed out if the server reports Yoco is not configured.
- A paid card checkout no longer depends on Yoco's webhook arriving. While the customer waits on the confirmation page, the server asks Yoco directly and creates the order once paid. Webhook and status check share one function and claim the checkout atomically (`PENDING → PROCESSING`), so an order is never created twice. A failed Yoco lookup leaves the checkout open to retry. Tested with a stand-in Yoco: payment with no webhook, ten simultaneous status checks (one order), and an unpaid checkout that is paid later.
- `YOCO_API_BASE` can be overridden for local testing only; production uses Yoco's API.

### 8 Nov 2026 (evening): full project handoff in CLAUDE.md
- `CLAUDE.md` now holds the founder's complete handoff: catalogue rules, fee decisions, Yoco notes, open work and working rules. A "changed since this handoff" section at the top records what the UI/UX upgrade below already finished (cart/checkout restyle, R10 Safety Seal, Care & Handling bands, cache `v3`), so later sessions don't redo or undo it. No code changes.

### 8 Nov 2026 (later): UI, UX and logic upgrade
**Bugs fixed**
- **Safety Seal never showed and was never charged.** The checkout code referenced a variable that didn't exist, so the section stayed hidden; and even when ticked, the server ignored it, so the total on screen could differ from the amount charged. It is now charged by the server (R10, only if the order has a spirit), saved as `Order.safetySealFee` (migration `20261108120000_add_safety_seal_fee` + `ensure-schema.js`) and shown on the admin order card.
- **Card payment could be picked when Yoco is not set up**, and the order then failed. It now shows "Coming soon" until `/api/payment-config` says card is live, and becomes the default once it is.
- **Cart and checkout disagreed on the total.** The cart ignored the Cooler Box discount and the peak-hours fee, labelled Care & Handling as "Service fee", and checked promo codes against a different amount. Cart, checkout and server now use one function, `priceOrder()` in `public/pricing.js`; on the local test the checkout total and the charged total matched to the cent.
- Toasts were cut off on phones (no line wrap); a corrupted saved cart could break every page; malformed requests returned an HTML error page; the home greeting used the phone's clock instead of SA time; the "copy order code" button failed outside https; EFT orders were told "a driver is on the way" before payment.

**UX upgrades (modelled on Uber Eats / Instacart / Checkers Sixty60 / Gopuff)**
- Cart: product photos, Singles / Full cases switch showing the saving, progress bars for the R300 minimum and the next Cooler Box tier, Undo after removing an item, collapsible promo field, clear bill, and a sticky "Go to checkout · total" bar.
- Checkout: no bottom nav (one job), numbered steps, the address can be edited here, name and phone remembered on the device, inline field errors (it scrolls to the first one), long baskets collapse to 4 lines, a sticky "Place order · total" bar with a loading state, and a basket under R300 goes back to the cart.
- Shop: the search and category bar stay pinned while you scroll and follow the section on screen; categories have readable names ("Cider & RTDs", not "CIDER RTD"); search ignores case, accents and apostrophes and matches every word ("bains" finds Bain's); out-of-stock items go last; accessible buttons and labels.
- Order confirmation shows the total, EFT instructions for EFT orders, and copy works everywhere.
- New shared `public/app.css` (loaded last on customer pages); service-worker cache bumped to `v3` so installed apps pick up the new files.

### 8 Nov 2026: photos for the last five products
- Added the founder's photos for the five products that still had none: Guinness Foreign Extra can (440ml), Belgravia Gin & Tonic can, Smirnoff 1818 Vodka 750ml, Bug Booster 20ml shot and Robertson Chapel Dry Red 1.5L. Each is a small WebP in `public/images/brands` mapped to its exact product in `prisma/catalogue-photo-config.js`.
- Every product in the catalogue now has a photo. Bug Booster's photo shows the box of 15 next to the single bottle, because that is the picture supplied.

### 7 Nov 2026 (later): founder corrections
- **Three SKUs priced** (they were "Price coming soon"): Strettons Ruby Orange R220.50, Strettons Triple Berry R220.50 and Sambuca Lupini Blue R357.00, the same as their sibling flavours. No SKU is "Price coming soon" any more (`PRICE_COMING_SOON` is empty).
- **Back to the founder's list price:** Johnnie Walker Red Label R315.00, Klipdrift Export R252.00, Castle Milk Stout quart R29.96. Only **Heineken dumpy stays at R117.70** (list was R112.35).
- **Removed, because the founder never added 1 litre bottles:** Klipdrift Export Brandy 1 Litre, Jameson Irish Whisky 1 Litre, Gordons London Dry Gin 1 Litre, Smirnoff 1818 Vodka 1 Litre and the Carling Black Label 12-pack case row. The 750ml versions stay (Carling Black Label is the 750ml quart; Breezer has no quarts).
- **Four house products restored** (they are not in the master workbook, so they are kept in `skus.csv` and `FINAL_CUSTOMER_PRICES` on purpose so the catalogue sync does not delete them): Mofaya Original and Mofaya Orange Ting six-packs R62.94 (R9.99 a can x 6 + 5%), Grenadine Syrup Cordial R73.50 (base R70 + 5%) and Kola Tonic Cordial R47.25 (base R45 + 5%). Those four prices are estimates from the old Ekoyini bases.
- The catalogue is now 322 master workbook SKUs + 4 house products = 326 rows, every one with a final price.

### 7 Nov 2026: master prices live, build fixed
- **Why prices were not live:** every deploy from 20:38 on 6 Nov failed at `npm install` (postinstall runs `node --test`). `lib/catalogue-2026-11.js` exported `roundTavern` without defining it, so loading the module threw and the catalogue tests crashed. It is now defined (legacy rounding only; final workbook prices are never rounded with it).
- **Prices now live:** all 327 master SKUs. 324 carry a final customer price (7% markup on beer, cider/RTD and wine; 5% on spirits, liqueurs, mixers, water and ice, applied to the receipt or market base). Strettons Ruby Orange, Strettons Triple Berry and Sambuca Lupini Blue are still "Price coming soon" because the master workbook has no price for them.
- **Tests aligned with the newer price data:** Johnnie Walker Red R408.29, Klipdrift Export R251.99, Heineken dumpy R117.70, Castle Milk Stout quart R28.88 (case R318.84).
- **Photos:** the catalogue renames (Corona Extra, Carling Black Label, Bacardi Breezer, Sol NRB, quarts 750ml to 660ml, Savanna NRB) had left about 30 products without a picture. Each new name now points at the photo of the row it replaced.
- **Removed by the master-catalogue sync (not in the workbook):** Mofaya Orange Ting, Mofaya Original, Grenadine Syrup Cordial, Kola Tonic Cordial.


### Pricing
- Full SKU list recalibrated from tavern invoices / Shoprite / Boxer / Spar receipts.
- Key corrections: Savanna Dry 330ml 6-pack → R513.60, Hennessy VS → R682.50, Ponchos Tequila Coffee → R336, Skyy Vodka → R315, Bernini cans → R133.75, Brutal Fruit cans → R144.45, Corona Dumpy 355ml fixed exception at **R135**.
- Smirnoff 1818 is **750ml only** (no 1L SKU).
- Prices already include the 5% (spirits) / 7% (beer, cider, wine) app markup. No extra 1% applied for Yoco at this stage.
- Source of truth: `FINAL_CUSTOMER_PRICES` in `lib/catalogue-2026-11.js`.

### Care & Handling fee (replaces fixed “Service fee”)
Framed as a customer-protection feature, not a crude charge.
- ≤ R800 → **5%**
- R800 – R2000 → **7%**
- > R2000 → **15%**
Implemented in `public/pricing.js` (`careFeeFor` / `CARE_FEE_BANDS`). UI label: **Care & Handling**.

### Safety Seal stickers
- Optional R10 add-on at checkout, **spirits only**.
- Helps keep spirit bottles tamper-evident from tavern to door.
- Shown only when the cart contains brandy / whisky / cognac / gin / vodka / tequila / liqueur / rum.

### Card payments (Yoco)
- Checkout card option unlocked in the UI (“Secure card payment via Yoco”).
- Still gated server-side by `isYocoConfigured()` (requires `YOCO_SECRET_KEY` + webhook secret on Render).
- Once env vars are set on the live Render service, card payments go live without a further code change.

### Notes for operators
- After deploy, re-run the catalogue price sync script (or `npm run seed` on a staging DB) so `SkuItem` rows pick up the new `FINAL_CUSTOMER_PRICES`.
- Revoke the temporary GitHub PAT used for this push once confirmed.


---

## 🎯 Architecture Overview

```
Frontend (Mobile Web)              Backend (Node.js + Prisma)         Data (Supabase Postgres + Auth)
──────────────────────             ──────────────────────             ───────────────────────────────
index.html, shop.html              server.js                          SkuItem (269 SKUs)
cart.html, checkout.html           ├─ /api/products, /api/taverns     Order, OrderItem
order-confirmation.html            ├─ /api/health                     Tavern
login.html, signup.html            ├─ /order (POST, auth-gated)       Supabase Auth (auth.users)
profile.html, track.html           ├─ /api/my-orders (auth-gated)
                                    ├─ /api/order/:code/track
                                    └─ /orders, /admin/* (admin-gated)
```

**Key integrations:**
- Supabase Auth (customer login + admin stopgap)
- Supabase Postgres (via Prisma)
- Resend (order confirmations, admin alerts) — wired, inactive until `RESEND_API_KEY` is set
- Yoco (card payments) — code-complete, inactive until `YOCO_SECRET_KEY`/`YOCO_WEBHOOK_SECRET` are set and verified against a real Yoco account (see LAUNCH_CHECKLIST.md)
- WhatsApp Business API (driver dispatch) — currently manual `wa.me` deep links from the admin dashboard

---

## 🚀 Quick Start

See **`QUICKSTART.md`** for local setup and **`DEPLOYMENT.md`** for deploying to Render. Short version:

```bash
npm install                # also runs `prisma generate`
cp .env.example .env       # fill in Supabase + admin token
npx prisma db push
npm run seed                # loads 269 SKUs + 5 taverns
npm start                   # http://localhost:3000
```

---

## 📂 Project Structure

```
ekoyini-webapp/
├── public/                          (customer-facing site)
│   ├── index.html                   Landing page — hero, USP chips, promos, live Nearby Stores
│   ├── shop.html                    Catalog — Cooler Box builder, stepper cart, skeleton loading
│   ├── cart.html                    Cart — single/case pricing toggle, order summary
│   ├── checkout.html                Age gate, delivery details, payment method, auth-gated
│   ├── order-confirmation.html      Post-order thank-you, order code, link to tracking
│   ├── login.html                   Supabase Auth sign-in
│   ├── signup.html                  Supabase Auth registration
│   ├── profile.html                 Account view — order history, logout, live auth-state switching
│   ├── track.html                   Public order tracking by code (no login required); live Leaflet map once a driver is sharing location
│   ├── driver-track.html            Driver-facing, no-login page — shares live GPS via a per-order token link sent over WhatsApp
│   ├── style.css                    Full design system — all shared CSS
│   ├── script.js                    Shared utilities: cart, address, toast, cross-tab sync, dead-end auditor
│   └── auth.js                      Supabase client wrapper, session helpers, nav login-state renderer
│
├── admin/
│   ├── admin.html                   Dispatch dashboard UI — real Supabase Auth login, gated by ADMIN_EMAILS
│   ├── admin-api.js                 CURRENT version — calls the real backend API
│   └── admin.css                    Admin UI styles
│
├── prisma/
│   ├── schema.prisma                Full DB schema
│   ├── seed.js                      Parses skus.csv → computes retail pricing → seeds DB
│   └── data/
│       └── skus.csv                 269 SKU rows (260 alcohol + 9 water/ice/non-alcohol)
│
├── scripts/
│   └── enrich-images.js             Optional Phase 2: real product photos via Open Food Facts API
│
├── server.js                        Express API — all backend logic
├── payments.js                      Yoco checkout + webhook signature verification
├── emails.js                        Resend transactional email (order confirmation, admin alerts)
├── package.json                     Dependencies + npm scripts
├── render.yaml                      Render deploy config
├── .env.example                     Env var template
├── QUICKSTART.md                    Local setup walkthrough
├── DEPLOYMENT.md                    Render deployment walkthrough
├── LAUNCH_CHECKLIST.md              Track A (done) vs. Track B (before real orders)
└── .gitignore
```

---

## 💳 SKU Catalog & Pricing Strategy

**269 SKUs** across 18 categories (beer, spirits, wine, ciders, mixers, water, ice, etc.), sourced from supplier price sheets.

### Pricing Logic
- **Single-bottle price** (`retailSingleZAR`): Uses the supplier list price directly as the shelf price, no separate markup layer. 27 flagship SKUs (Absolut, Jameson, Johnnie Walker, Bells, Gordons, Klipdrift, Savanna, JC Le Roux) have been corrected against real 2026 South African retail prices researched from Shoprite LiquorShop and Preston's Liquor Stores (Eastern Cape — Ekoyini's own operating region); beer and Amarula were checked and found already accurate. The remaining SKUs are still the original supplier-sheet estimate and haven't been individually verified — see `prisma/data/skus.csv`'s per-brand pricing history in git for exactly which rows were corrected and against what source.
- **Case discount** (`retailCaseDiscountPct`): Ekoyini's own tiered carry-pack discount:
  - **8%** on beer, ciders, mixers, water, ice (high turnover, commonly bulk-bought)
  - **6%** on wine/sparkling (event buying)
  - **5%** on standard spirits (brandy, whisky, gin, vodka, tequila, liqueurs)
  - **3%** on premium/luxury (cognac, champagne, premium vodka/tequila) — margins matter more here

### 🧊 Cooler Box Package
The flagship high-margin feature. Customers build a bundle — the real
pattern being a bottle plus two or three carry packs plus ice and mixers —
and unlock tiered discounts as they add more. **Every category counts**:
beer, ciders, all spirits (including brandy/cognac/whisky/gin/vodka/
tequila/liqueurs), wine, sparkling, champagne, mixers, water, and ice all
feed the same Cooler Box subtotal — this was previously restricted to a
"high-turnover" subset that excluded wine/champagne/cognac/brandy, which
didn't match how customers actually build a cooler box, so it now covers
the full catalog:

| Cooler Box subtotal | Discount |
|---|---|
| R1000 to R2000 | 5% |
| Above R2000 | 8% |

The Cooler Box discount is only given until 20:00 South African time (it
returns at 04:00). There are no other discounts and no case discounts at
checkout.

### Fees (founder decisions, Nov 2026)
- **No free delivery.** Every order pays the distance-based delivery fee.
- **Service fee**, shown as its own line and saved in `Order.serviceFee`:
  R50 (R300-R499), R65 (R500-R799), R80 (R800-R1200), R95 (R1201-R1599),
  R110 (R1600+). The bands live in `SERVICE_FEE_BANDS` in `public/pricing.js`.
- **Minimum order** R300 (before discounts).
- Drivers receive 100% of the delivery, surge and priority fees.

Shown live in `shop.html` via a shimmer progress bar and an 8-slot grid, and
**applied server-side** on the eligible-items subtotal when the order is
placed — `server.js` recomputes it independently of anything the client
sends. Eligibility lives in one place, `public/pricing.js`'s
`COOLER_ELIGIBLE` set, shared by the server and every page that needs it.

### Images
- **Phase 1** (current): Category fallback images (Unsplash) — every SKU renders cleanly from day one.
- **Phase 2**: Real product photos via Open Food Facts API (`npm run enrich-images`), Supabase Storage, or SerpApi.

### 🏷️ Brand Story Tags
`SkuItem.brandTags` (`BLACK_OWNED` / `WOMEN_OWNED` / `CELEBRITY_BACKED`) power
filter pills and badges on `shop.html`, the same pattern apps like Minibar
Delivery use. The bar for adding a tag is deliberately strict — a specific,
checked fact about that brand (a named founder still holding real equity, a
documented current partnership), never inferred from category or portfolio
name, and never kept once the fact goes stale (see `schema.prisma`'s comment
on `brandTags` for the full rule). Currently tagged, each individually
researched or confirmed:
- **KEM Gin** — Black-owned and women-owned, founded by the Koloko Sisters
  (Matatiele, Eastern Cape).
- **Kwande Gin** — Black-owned.
- **Chillers Punch** — Black-owned and celebrity-backed; founded by South
  African podcaster MacG (Macgyver Mukwevho) in 2023.
- **Seven Sisters Pinotage/Cabernet** *(new SKU)* — Black-owned and
  women-owned; 100% Black-women-owned Stellenbosch wine farm founded by
  Vivian Kleynhans and her sisters in 2005.
- **M'hudi Pinotage** and **M'hudi Chenin Blanc** *(new SKUs)* — Black-owned;
  the first Black-owned wine farm in South Africa, run by the Rangaka family
  in Stellenbosch since 2005.
- **Mofaya Original** and **Mofaya Orange Ting** *(new SKUs)* — Black-owned
  energy drinks; MoFaya Beverage Company describes itself as the first
  100% Black-owned beverage company in South Africa, founded by DJ Sbu
  (Sibusiso Leope), who sold a 26% stake to Coca-Cola in 2017 and remains
  the majority owner. Filed under Mixer since the catalog has no dedicated
  energy-drink category yet.
- **Casamigos** (Blanco, Reposado) — celebrity-backed; co-founded by George
  Clooney, Rande Gerber, and Mike Meldman, now Diageo-owned but the
  founder-celebrity story is still an accurate current fact.
- **D'USSÉ VSOP** — celebrity-backed; Jay-Z co-founded it with Bacardi and
  retains a real ownership stake through SCLiquor LLC.

Checked and deliberately **not** tagged, so the filter stays honest: Inverroche
and Musgrave were both women-founded SA craft gins, but each has since been
fully acquired (Inverroche by Pernod Ricard, Musgrave by International
Spirits Company) with no ongoing founder equity, so "Women Owned" would no
longer be accurate today. Cîroc lost its Sean "Diddy" Combs partnership in a
2024 settlement — no longer celebrity-backed. KWV's ~25% BEE shareholding is
real but a minority stake, not the same claim as "Black-owned," so KWV-brand
SKUs (Cruxland Gin, Wild Africa Cream) aren't tagged either. Aslina Wines
(Ntsiki Biyela, South Africa's first Black woman winemaker) is genuinely
Black- and women-owned, but no reliable South African rand retail price
could be found this pass (only USD export listings, which run well above
SA domestic pricing) — flagged as a candidate to add once real ZAR pricing
is sourced. Lilula Beverages is also Black-owned per direct confirmation,
but isn't in the catalog and needs real product/pricing details before it
can be added.

---

## 🛒 Customer Journey

1. **Browse** (`/`) → Filter by category or search
2. **Shop** (`/shop.html`) → Add to cart, watch the Cooler Box discount unlock as you add eligible items
3. **Cart** (`/cart.html`) → Review items, toggle single vs. case pricing
4. **Sign up / Log in** (`/signup.html`, `/login.html`) → Required before checkout
5. **Checkout** (`/checkout.html`) → Age gate (18+), delivery details, payment method (COD, card, EFT)
6. **Confirm** (`/order-confirmation.html`) → Order code, link to live tracking
7. **Track** (`/track.html`) → Status timeline by order code, no login required
8. **Profile** (`/profile.html`) → Order history for the logged-in customer

---

## 🔐 Security Notes

### Fixed
- **Client-side price editing exploit** — the old editable price field on `shop.html` is gone, replaced with a read-only price-details sheet. `POST /order` only accepts `skuId` + `quantity` + `purchaseType` from the client; every price is recomputed server-side from the current DB values.
- **`/api/taverns` narrowed** — public response is `id`/`name`/`area` only; tavern phone numbers are only ever returned to `requireAdmin`-gated `/admin/taverns`.
- **Orders are auth-gated** — `POST /order` and `GET /api/my-orders` require a valid Supabase session (`requireUser` middleware, verified against Supabase's `/auth/v1/user`).
- **Admin auth is per-person and role-based.** `/admin/admin.html` logs admins in with real Supabase Auth accounts; `requireAdmin` checks the logged-in user's email against `ADMIN_EMAILS` (always `SUPER_ADMIN`, the root bootstrap) or the `AdminUser` table (delegated admins with an actual `SUPER_ADMIN`/`DISPATCHER` role). Sensitive routes — delete order, edit inventory, manage other admins — are additionally gated by `requireSuperAdmin`, enforced server-side, not just hidden in the UI. `ADMIN_API_TOKEN` still works as a fallback for scripts/curl and as a bootstrap path — unset it once every admin has a real account.
- **Driver location updates are token-authorized, not open.** `POST /order/:code/location` has no login (drivers have no accounts) but requires the per-order `driverShareToken` generated at assign time; it also only accepts updates while the order is `DISPATCHED`, so a leaked or guessed token on a delivered/undispatched order can't do anything. `/track.html` and the `/api/order/:code/track` response drop any location ping older than 3 minutes, so a driver who stopped sharing never leaves a stale dot on the customer's map.

### Still Track A / known limitations
- **Age verification stays self-attestation by design** — not a gap. Real ID scanning needs a paid vendor and isn't the industry norm (Uber Eats and most alcohol delivery apps do the same "take their word for it, use judgment on an obvious minor" approach). Revisit only for a specific compliance need, not by default.
- **Card payment is code-complete but unverified against a live Yoco account** — see `payments.js` and the LAUNCH_CHECKLIST entry. Stays inactive until `YOCO_SECRET_KEY`/`YOCO_WEBHOOK_SECRET` are set and tested against a real sandbox checkout.

---

## 📊 API Reference

### Public
- `GET /api/health` — DB connectivity check
- `GET /api/products?category=` — full catalog, filterable (each SKU includes `brandTags`, see the Brand Story Tags section above)
- `GET /api/taverns` — store list, `id`/`name`/`area` only
- `GET /api/order/:code/track` — public order status lookup (also returns `rating`/`ratingComment`, and `driverLat`/`driverLng`/`driverLocationAt` if the driver has shared a location in the last 3 minutes — stale pings are dropped server-side, never surfaced as if live)
- `GET /api/stats` — live counts for the homepage trust strip: product count, verified tavern count, distinct townships served
- `POST /api/promo/validate` — preview a promo code against a subtotal (`{ code, subtotal }`); no side effects, doesn't redeem it
- `GET /api/payment-config` — `{ cardEnabled }`, tells checkout.html whether to enable the card radio (true only once `YOCO_SECRET_KEY` is set)
- `POST /webhooks/yoco` — Yoco's own webhook target, not for browser use; signature-verified, see `payments.js`
- `POST /order/:code/location` — driver-track.html posts `{ token, lat, lng }` here roughly every 10s while sharing; `token` must match the order's `driverShareToken` (set at assign time) and the order must be `DISPATCHED`, or it's rejected. No login — the token in the link is the only credential, since drivers have no accounts.

### Customer (`Authorization: Bearer <supabase_access_token>`)
- `POST /order` — create order for COD/EFT; server recomputes every price and the Cooler Box discount. Rejects `paymentMethod: "card"` — that goes through the two routes below instead.
- `POST /order/checkout-session` — start a Yoco card checkout (`{ address, items, customerName, customerPhone, promoCode? }`); returns `{ redirectUrl }`. Doesn't create an Order yet — that happens via the webhook once payment's confirmed.
- `GET /api/checkout-session/:id/status` — poll while waiting on the webhook; `{ status: "PENDING"|"COMPLETED"|"FAILED_NEEDS_REFUND", orderCode? }`
- `GET /api/my-orders` — the logged-in user's order history
- `POST /order/:code/rate` — rate a delivered order (`{ rating: 1-5, comment? }`); only the order's own owner, only once DELIVERED, once per order

### Admin (`x-admin-token: <ADMIN_API_TOKEN>`, or a logged-in `SUPER_ADMIN`/`DISPATCHER` account)
- `GET /admin/me` — the logged-in admin's own role, for the dashboard to show/hide UI
- `GET /orders` — all orders, newest first
- `GET /admin/taverns` — full tavern records, including phone
- `PATCH /order/:code/assign` — assign tavern + driver, sets status `PENDING`, generates a fresh `driverShareToken` (the admin dashboard's WhatsApp dispatch message includes the resulting `driver-track.html?code=...&token=...` live-location link)
- `PATCH /order/:code/status` — update status
- `GET /admin/products` — full product list with current stock

### Admin — super-admin only (`requireSuperAdmin`, 403 for a `DISPATCHER`)
- `DELETE /order/:code` — delete an order
- `PATCH /admin/products/:id/stock` — set a product's stock count
- `GET /admin/admins` — list delegated admins (`AdminUser` rows) plus the `ADMIN_EMAILS` bootstrap list
- `POST /admin/admins` — grant an email admin access (`{ email, role: "SUPER_ADMIN" | "DISPATCHER" }`)
- `DELETE /admin/admins/:id` — revoke a delegated admin's access (doesn't touch `ADMIN_EMAILS` accounts — that's an env var change)
- `GET /admin/audit-log` — last 200 admin actions (assign/status/delete/stock/admin changes), newest first

---

## 🎨 Design System

**Color Palette:** warm cream/white surfaces (`#f7f4ec` → `#ffffff`) with deep forest green (`#1a6b3a`) and terracotta (`#c96a2e`) accents — retheme'd from an original dark palette to a high-contrast, sunlight-legible light theme for outdoor/mobile-data use. A handful of components (the age gate, onboarding carousel, ridealong banner, Cooler Box bar) intentionally keep a dark surface for emphasis, with their own hardcoded text colors rather than the shared tokens.
**Typography:** Playfair Display (display, 700/900) + DM Sans (body, 300–700).

See `public/style.css` for the full token set — nav auth chip, top toast,
Cooler Box builder, skeleton loaders, and the track-order timeline are all
defined there alongside the original component library.

---

## 📈 Roadmap

See `LAUNCH_CHECKLIST.md` for the concrete Track A → Track B punch list —
WhatsApp Business API automation is the one item left; admin auth, RLS,
promo codes, payments, Resend email, and live GPS tracking are all done
(age verification stays self-attestation by design, see above).

### Phase 3 (Scale)
- 🎯 Tavern inventory sync (real-time SKU availability)
- 🎯 Multi-region expansion (duplicate app for different metro areas)
- 🎯 Analytics dashboard (order trends, driver performance)
- 🎯 Driver ratings (driver-of-customer — the reverse direction; customers
      can already rate their delivery from `track.html` once DELIVERED)
- 🎯 Loyalty program (rewards for repeat orders)

---

**Built for South African kasis** 🇿🇦
