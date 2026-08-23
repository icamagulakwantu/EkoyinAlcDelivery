# Ekoyini — Alcohol Delivery Platform

A **mobile-first, ride-along delivery app** for alcohol, tobacco, and beverages in South African townships. Uses on-route e-hailing drivers instead of a dedicated fleet — faster, cheaper, and already trusted by riders.

---

## 🎯 Architecture Overview

```
Frontend (Mobile Web)          Backend (Node.js + Prisma)      Data (Supabase Postgres)
──────────────────────        ──────────────────────           ────────────────────
index.html                     server.js                        SkuItem (257 SKUs)
shop.html                      ├─ /api/products                 Order
cart.html                      ├─ /order (POST)                 OrderItem
checkout.html                  ├─ /orders (admin)               Tavern
order-confirmation.html        └─ /order/:code/*
                               (Prisma client)
                               ```

                               **Key integrations (Phase 2+):**
                               - Supabase Auth (admin login)
                               - Resend (order confirmations, admin alerts)
                               - Yoco / PayFast (payment gateway)
                               - WhatsApp Business API (driver dispatch)

                               ---

                               ## 🚀 Quick Start — Local Development

                               ### 1. Clone the repo
                               ```bash
                               git clone https://gitlab.com/ekoyini/webapp.git
                               cd ekoyini-webapp
                               ```

                               ### 2. Install dependencies
                               ```bash
                               npm install
                               ```

                               ### 3. Set up environment variables
                               ```bash
                               cp .env.example .env
                               ```
                               Then edit `.env`:
                               ```
                               DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
                               ADMIN_API_TOKEN="your-secure-random-token-here"
                               PORT=3000
                               ```

                               ### 4. Push the schema and seed the database
                               ```bash
                               # Create tables in Supabase
                               npx prisma db push

                               # Load all 257 SKUs + 5 taverns
                               npm run seed
                               ```

                               ### 5. Start the server
                               ```bash
                               npm start
                               ```

                               The app will be available at `http://localhost:3000`.

                               ---

                               ## 📦 Deployment to Render

                               ### 1. Push to GitLab
                               ```bash
                               git add .
                               git commit -m "Initial commit"
                               git push origin main
                               ```

                               ### 2. Create a Render Web Service
                               - Go to [render.com](https://render.com)
                               - **New → Web Service**
                               - Select your GitLab repo
                               - **Build Command:** `npm install`
                               - **Start Command:** `node server.js`
                               - **Environment Variables:**
                                 ```
                                   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
                                     ADMIN_API_TOKEN=your-secure-token
                                       ```
                                       - Deploy

                                       ### 3. Seed the production database
                                       Once deployed, run the seed script in Render's shell:
                                       ```bash
                                       npm run seed
                                       ```

                                       ---

                                       ## 📂 Project Structure

                                       ```
                                       ekoyini-webapp/
                                       ├── public/
                                       │   ├── index.html              (landing page)
                                       │   ├── shop.html               (product catalog — fetches from /api/products)
                                       │   ├── cart.html               (shopping cart with case/single pricing toggle)
                                       │   ├── checkout.html           (age gate, delivery details, payment method)
                                       │   ├── order-confirmation.html (post-order thank you + next steps)
                                       │   ├── style.css               (global design system — dark green/black theme)
                                       │   └── script.js               (shared utilities: cart, address, toast)
                                       │
                                       ├── admin/
                                       │   ├── admin.html              (dispatch dashboard — PIN-gated)
                                       │   ├── admin.js                (order management, tavern assignment)
                                       │   └── admin.css               (admin UI styles)
                                       │
                                       ├── prisma/
                                       │   ├── schema.prisma           (Postgres schema: SkuItem, Order, OrderItem, Tavern)
                                       │   ├── seed.js                 (parses skus.csv, computes retail pricing, upserts DB)
                                       │   └── data/
                                       │       └── skus.csv            (257-SKU supplier price sheet)
                                       │
                                       ├── scripts/
                                       │   └── enrich-images.js        (optional: fetch real product photos via Open Food Facts)
                                       │
                                       ├── server.js                   (Express backend: /api/products, /order, /orders, assign/status/delete)
                                       ├── package.json                (dependencies: Express, Prisma, @prisma/client)
                                       ├── .env.example                (template for environment variables)
                                       ├── .gitignore                  (excludes node_modules, .env, OS files)
                                       └── README.md                   (this file)
                                       ```

                                       ---

                                       ## 💳 SKU Catalog & Pricing Strategy

                                       **257 SKUs** across 16 categories (beer, spirits, wine, ciders, mixers, etc.), sourced from supplier price sheets.

                                       ### Pricing Logic
                                       - **Single-bottle price** (`retailSingleZAR`): Uses supplier's list price directly — already realistic SA shelf prices.
                                       - **Case discount** (`retailCaseDiscountPct`): Ekoyini's own tiered carry-pack discount:
                                         - **8%** on beer, ciders, mixers (high turnover, commonly bulk-bought)
                                           - **6%** on wine/sparkling (event buying)
                                             - **5%** on standard spirits (brandy, whisky, gin, vodka, tequila, liqueurs)
                                               - **3%** on premium/luxury (cognac, champagne, premium vodka/tequila) — margins matter more here

                                               ### Images
                                               - **Phase 1**: Category fallback images (Unsplash) — every SKU renders cleanly from day one.
                                               - **Phase 2**: Real product photos via:
                                                 - Open Food Facts API (free, no key) — `npm run enrich-images`
                                                   - Supabase Storage (upload branded bottle photos per SKU)
                                                     - SerpApi / Google Images (automated search for transparent PNG bottles)

                                                     ---

                                                     ## 🛒 Customer Journey

                                                     1. **Browse** (`/`) → Filter by category or search
                                                     2. **Shop** (`/shop.html`) → Add to cart (toggle single vs. case pricing)
                                                     3. **Cart** (`/cart.html`) → Review items, enter delivery address
                                                     4. **Checkout** (`/checkout.html`) → Age gate (18+), delivery details, payment method (COD, card, EFT)
                                                     5. **Confirm** (`/order-confirmation.html`) → Order code, next steps (driver match in 5–10 min)
                                                     6. **Track** (planned) → Live driver location, WhatsApp updates

                                                     ---

                                                     ## 🔐 Security Notes

                                                     ### Current State (Track A — MVP)
                                                     - Frontend stores cart in `localStorage` (not encrypted — for demo only)
                                                     - Admin routes require `x-admin-token` header (shared static token, not user-specific)
                                                     - **No real age verification** — UI checkbox only; needs ID capture at delivery (Track B)
                                                     - **No real payment** — COD, manual EFT; Yoco/PayFast integration in Phase 2

                                                     ### Next (Track B — Production)
                                                     - **Supabase Auth**: Replace PIN + static token with email/password or magic-link admin login
                                                     - **Row-Level Security (RLS)**: Supabase policies so only authenticated users can read their own orders
                                                     - **Age gate + ID capture**: On-delivery verification via driver photo
                                                     - **Payment gateway**: Yoco / PayFast for card processing
                                                     - **HTTPS enforcement**: All sensitive data over TLS

                                                     ---

                                                     ## 📊 API Endpoints

                                                     ### Public
                                                     - `GET /api/products` — all SKUs with images, retail pricing, supplier info
                                                     - `POST /order` — create order (cart items, address, customer details)

                                                     ### Admin (requires `x-admin-token` header)
                                                     - `GET /orders` — list all orders (paginated, sortable)
                                                     - `PATCH /order/:code/assign` — assign tavern + driver details
                                                     - `PATCH /order/:code/status` — update status (dispatch, deliver)
                                                     - `DELETE /order/:code` — delete order

                                                     ---

                                                     ## 🌱 Seeding & Updates

                                                     ### Initial Seed
                                                     ```bash
                                                     npm run seed
                                                     ```
                                                     Parses `prisma/data/skus.csv`, computes retail pricing, assigns category images, upserts into DB. Idempotent — safe to re-run.

                                                     ### Update SKU Data
                                                     1. Edit `prisma/data/skus.csv` (add/remove/update rows)
                                                     2. Run `npm run seed` again
                                                     3. Commit and push

                                                     ### Enrich Images (Optional Phase 2)
                                                     ```bash
                                                     npm run enrich-images
                                                     ```
                                                     Queries Open Food Facts for each product, updates `imageUrl` where a match is found. Takes ~5 min (polite API delays). Keeps category fallback if no match.

                                                     ---

                                                     ## 📞 WhatsApp Dispatch (Roadmap)

                                                     **Phase 2 integration:**
                                                     - When an order is assigned to a tavern, send a WhatsApp message to the tavern owner (template: `"New order EKO-XXXXX for [address]. Driver [name] [vehicle] arriving soon."`)
                                                     - Driver gets a WhatsApp with order details + customer address + tracking link
                                                     - Customer gets real-time updates: "Driver assigned", "Picking up", "On the way", "Arrived"

                                                     ---

                                                     ## 🎨 Design System

                                                     **Color Palette:**
                                                     - Primary green: `#1a6b3a` (deep forest) → `#2eab5e` (light)
                                                     - Dark: `#080c0a` (black) → `#162019` (card)
                                                     - Accent: `#c96a2e` (terra/bronze)

                                                     **Typography:**
                                                     - Display: Playfair Display (serif, 700/900)
                                                     - Body: DM Sans (sans-serif, 300–700)

                                                     **Component Library:**
                                                     - Product cards (image, name, size, single + case pricing, add button)
                                                     - Cart items (qty controls, remove)
                                                     - Delivery cards (select payment/method)
                                                     - CTA buttons (full-width, rounded, shadows)
                                                     - Toast notifications (auto-dismiss)

                                                     See `public/style.css` for the full design system with CSS variables.

                                                     ---

                                                     ## 🧪 Testing Checklist

                                                     - [ ] Load `/api/products` → 257 SKUs returned with images
                                                     - [ ] Add items to cart → localStorage persists across page reloads
                                                     - [ ] Toggle single vs. case pricing → prices recalculate correctly
                                                     - [ ] Complete checkout → POST `/order` succeeds, generates order code
                                                     - [ ] Age gate + terms → checkboxes prevent submission if unchecked
                                                     - [ ] Admin `/orders` → requires `x-admin-token` header, returns all orders
                                                     - [ ] Assign driver → PATCH `/order/:code/assign` updates tavern + driver fields
                                                     - [ ] Delete order → DELETE `/order/:code` removes from DB

                                                     ---

                                                     ## 📈 Roadmap

                                                     ### Phase 1 (MVP — Current)
                                                     - ✅ 257-SKU catalog with retail pricing
                                                     - ✅ Single + case pricing toggle
                                                     - ✅ Shopping cart (localStorage)
                                                     - ✅ Checkout with age gate (UI only)
                                                     - ✅ Admin dispatch dashboard (PIN-gated, demo only)

                                                     ### Phase 2 (Production Ready)
                                                     - 🚀 Supabase Auth (real admin login)
                                                     - 🚀 Resend email (order confirmations, admin alerts)
                                                     - 🚀 Yoco/PayFast payment gateway
                                                     - 🚀 Real age verification (ID capture at delivery)
                                                     - 🚀 WhatsApp Business API (driver dispatch)
                                                     - 🚀 Live driver tracking (Google Maps API)

                                                     ### Phase 3 (Scale)
                                                     - 🎯 Tavern inventory sync (real-time SKU availability)
                                                     - 🎯 Multi-region expansion (duplicate app for different metro areas)
                                                     - 🎯 Analytics dashboard (order trends, driver performance)
                                                     - 🎯 Driver & customer ratings
                                                     - 🎯 Loyalty program (rewards for repeat orders)

                                                     ---

                                                     ## 💬 Support

                                                     For questions or bugs, open an issue on GitLab or reach out to the team.

                                                     ---

                                                     **Built with ❤️ for South African kasis** 🇿🇦
                                                     