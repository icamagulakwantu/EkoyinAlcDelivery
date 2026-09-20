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
- Resend (order confirmations, admin alerts) — Phase 2, not yet wired
- Yoco / PayFast (payment gateway) — Phase 2, not yet wired
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
│   ├── track.html                   Public order tracking by code (no login required)
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
- **Single-bottle price** (`retailSingleZAR`): Uses supplier's list price directly — already realistic SA shelf prices.
- **Case discount** (`retailCaseDiscountPct`): Ekoyini's own tiered carry-pack discount:
  - **8%** on beer, ciders, mixers, water, ice (high turnover, commonly bulk-bought)
  - **6%** on wine/sparkling (event buying)
  - **5%** on standard spirits (brandy, whisky, gin, vodka, tequila, liqueurs)
  - **3%** on premium/luxury (cognac, champagne, premium vodka/tequila) — margins matter more here

### 🧊 Cooler Box Package
The flagship high-margin feature. Customers build a bundle from
**dumpies, spirits, mixers, ice, and water** — the target market's actual
buying pattern — and unlock tiered discounts as they add more:

| Cooler Box subtotal | Discount |
|---|---|
| R300+ | 5% |
| R600+ | 10% |
| R1000+ | 15% |

Shown live in `shop.html` via a shimmer progress bar and an 8-slot grid, and
**applied server-side** on the eligible-items subtotal when the order is
placed — `server.js` recomputes it independently of anything the client
sends. Wine, sparkling, champagne, cognac, and brandy stay purchasable in
the regular grid but don't feed the Cooler Box (slow-turnover, not what
this feature is built for).

### Images
- **Phase 1** (current): Category fallback images (Unsplash) — every SKU renders cleanly from day one.
- **Phase 2**: Real product photos via Open Food Facts API (`npm run enrich-images`), Supabase Storage, or SerpApi.

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

### Still Track A / known limitations
- **No real age verification** — UI checkbox only; needs ID capture at delivery.
- **No real payment** — COD, manual EFT; Yoco/PayFast integration is Phase 2.

---

## 📊 API Reference

### Public
- `GET /api/health` — DB connectivity check
- `GET /api/products?category=` — full catalog, filterable
- `GET /api/taverns` — store list, `id`/`name`/`area` only
- `GET /api/order/:code/track` — public order status lookup (also returns `rating`/`ratingComment` if set)
- `GET /api/stats` — live counts for the homepage trust strip: product count, verified tavern count, distinct townships served
- `POST /api/promo/validate` — preview a promo code against a subtotal (`{ code, subtotal }`); no side effects, doesn't redeem it

### Customer (`Authorization: Bearer <supabase_access_token>`)
- `POST /order` — create order; server recomputes every price and the Cooler Box discount
- `GET /api/my-orders` — the logged-in user's order history
- `POST /order/:code/rate` — rate a delivered order (`{ rating: 1-5, comment? }`); only the order's own owner, only once DELIVERED, once per order

### Admin (`x-admin-token: <ADMIN_API_TOKEN>`, or a logged-in `SUPER_ADMIN`/`DISPATCHER` account)
- `GET /admin/me` — the logged-in admin's own role, for the dashboard to show/hide UI
- `GET /orders` — all orders, newest first
- `GET /admin/taverns` — full tavern records, including phone
- `PATCH /order/:code/assign` — assign tavern + driver, sets status `PENDING`
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

See `LAUNCH_CHECKLIST.md` for the concrete Track A → Track B punch list
(payments, real age verification, Resend email, WhatsApp Business API,
live GPS tracking) — admin auth, RLS, and promo codes are done.

### Phase 3 (Scale)
- 🎯 Tavern inventory sync (real-time SKU availability)
- 🎯 Multi-region expansion (duplicate app for different metro areas)
- 🎯 Analytics dashboard (order trends, driver performance)
- 🎯 Driver ratings (driver-of-customer — the reverse direction; customers
      can already rate their delivery from `track.html` once DELIVERED)
- 🎯 Loyalty program (rewards for repeat orders)

---

**Built for South African kasis** 🇿🇦
