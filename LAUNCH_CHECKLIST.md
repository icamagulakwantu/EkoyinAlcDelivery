# Ekoyini — Launch Checklist

Track A (this MVP) vs. Track B (production-ready) — don't take real payments
or real orders until the Track B items are checked off.

## ✅ Done (Track A — MVP)

- [x] 264-SKU catalog (257 alcohol + water/ice) with retail pricing
- [x] Single + case pricing toggle
- [x] Cooler Box builder with tiered discount (5% / 10% / 15%), applied
      server-side on order total — not just a display-only progress bar
- [x] Supabase Auth (signup/login/profile), checkout is auth-gated
- [x] Server-side price recomputation on every order — a client can't set
      its own price or total
- [x] Public order tracking by code (`/track.html`, no login required)
- [x] Admin dispatch dashboard backed by the real API (not localStorage)
- [x] Cross-tab live sync for cart + auth state

## 🚧 Before taking real orders (Track B)

- [ ] **Real payment gateway.** Checkout only offers COD / EFT / a disabled
      "card" option. Wire up Yoco or PayFast before advertising card
      payments.
- [ ] **Real age verification.** The age gate is a self-attestation
      checkbox. Add ID capture at delivery before relying on it for
      compliance.
- [x] **Admin auth.** `/admin/admin.html` now logs admins in with real
      Supabase Auth accounts; the server checks the logged-in user's email
      against the `ADMIN_EMAILS` allowlist on every admin route. Sign each
      admin up as a customer account, then add their email to
      `ADMIN_EMAILS`. `ADMIN_API_TOKEN` still works as a scripts/curl
      fallback — unset it once every admin has a real account.
- [ ] **Resend email.** `.env.example` has a `RESEND_API_KEY` slot but
      nothing sends order confirmation or admin-alert emails yet.
- [ ] **WhatsApp Business API.** Driver/tavern dispatch messages currently
      open `wa.me` deep links that the admin has to manually send — fine
      for a founder-run MVP, not for scale.
- [ ] **Live driver GPS.** `/track.html`'s timeline is status-based only,
      no live map location.
- [x] **Promo codes.** Real `PromoCode` model, `POST /api/promo/validate`
      (preview, no side effects) and server-side redemption inside the
      same transaction as order creation (atomic usage-count increment,
      so a `maxUses` cap can't be raced). Wired into both cart.html and
      checkout.html, with checkout as the authoritative recompute — same
      pattern as the Cooler Box discount. Seeded with one live code,
      `FESTIVE10` (10% off, no minimum, no cap, expires end of Jan 2027).
      No admin UI to create new codes yet — do that via SQL/Supabase
      directly until one exists.
- [x] **RLS enabled.** `Order`, `OrderItem`, `SkuItem`, and `Tavern` all
      have Row-Level Security turned on in the `ekoyini-2` project, with
      no policies for `anon`/`authenticated` — so the Supabase REST API
      now default-denies direct access to all of them (including
      `Order`'s customer PII) unless a policy is explicitly added later.
      The Express app is unaffected: `server.js` connects as its own
      `ekoyini_app` role, which has `BYPASSRLS` set, so `/api/my-orders`
      keeps working exactly as before — the API layer's own scoping was
      already correct, this just closes the second line of defense.
- [ ] **HTTPS enforcement.** Confirm Render is serving HTTPS-only.
- [x] **Inventory/stock model.** `SkuItem.stock` is real now, defaulted
      to 999 for every existing SKU since no actual per-SKU count exists
      yet from any supplier feed (honest placeholder, not "unlimited" —
      the enforcement is real even though the starting numbers are a
      guess). `POST /order` decrements stock atomically in the same
      transaction as the order write (race-safe against two customers
      buying the last few units at once, same pattern as the promo
      `maxUses` guard), rejects the order with a clear "just sold out"
      error if there isn't enough, and a case purchase correctly
      decrements by `quantity × unitsPerCase`, not just `quantity`.
      shop.html shows an "Out of Stock" badge and disables the add
      button once a product hits zero. Manage real counts from the
      admin dashboard's new Inventory tab — search, edit, save, per
      product. Re-seeding (`npm run seed`) never touches `stock`, so it
      survives a catalog refresh.
- [x] **Admin roles.** `ADMIN_EMAILS` accounts are still the root
      bootstrap and are always `SUPER_ADMIN` — that's unavoidable, you
      need at least one admin able to grant others access. Beyond that,
      a real `AdminUser` table backs a new Admins tab (super-admin only)
      to add/remove delegated admins with an actual role: `DISPATCHER`
      (view/assign/dispatch/deliver orders — day-to-day ops) or
      `SUPER_ADMIN` (also delete orders and edit inventory). Enforced
      server-side via `requireSuperAdmin` on every sensitive route, not
      just hidden in the UI — a dispatcher hitting `DELETE /order/:code`
      or `PATCH /admin/products/:id/stock` directly gets a 403.
- [x] **Admin audit log.** Every consequential admin action — assign,
      status change, delete order, stock edit, add/remove admin — writes
      a row to `AdminAuditLog` (who, what, on what, when). Visible in a
      new super-admin-only Activity tab. Doesn't block or fail the
      underlying action if logging itself errors — an audit trail is a
      record, not a gate.
- [x] **Order input validation hardened.** `POST /order` now rejects a
      missing/too-short address, a phone number that isn't 9-12 digits
      once non-digit characters are stripped, and any `paymentMethod`
      outside `cod`/`eft` (card gets rejected server-side too, not
      just disabled in the UI) — closes a gap where a client could
      previously submit an order with no real phone number or an
      arbitrary payment method string.

## Before flipping "live"

- [ ] Sign up real admin accounts (`public/signup.html`) and set
      `ADMIN_EMAILS` in production to their emails
- [ ] Replace `SUPABASE_URL` / `SUPABASE_ANON_KEY` in `public/auth.js` with
      your real project's values
- [ ] Set a strong, unique `ADMIN_API_TOKEN` in production — never reuse the
      local dev value
- [ ] Re-seed with real supplier pricing if `prisma/data/skus.csv` still has
      placeholder numbers for any SKU
- [ ] Smoke-test the full customer journey end to end on the deployed URL,
      not just locally
