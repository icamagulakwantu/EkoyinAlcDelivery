# Ekoyini — Alcohol Delivery Platform

A **mobile-first, ride-along delivery app** for alcohol, tobacco, and beverages in South African townships. Uses on-route e-hailing drivers instead of a dedicated fleet — faster, cheaper, and already trusted by riders.

---

## 🎯 Architecture Overview

```
Frontend (Mobile Web)              Backend (Node.js + Prisma)         Data (Supabase Postgres + Auth)
──────────────────────             ──────────────────────             ───────────────────────────────
index.html, shop.html              server.js                          SkuItem (264 SKUs)
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
npm run seed                # loads 264 SKUs + 5 taverns
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
│       └── skus.csv                 264 SKU rows (257 alcohol + 7 water/ice)
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

**264 SKUs** across 18 categories (beer, spirits, wine, ciders, mixers, water, ice, etc.), sourced from supplier price sheets.

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
| R300+ | 5% |
| R600+ | 10% |
| R1000+ | 15% |

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
SKUs (Cruxland Gin, Wild Africa Cream) aren't tagged either.

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
