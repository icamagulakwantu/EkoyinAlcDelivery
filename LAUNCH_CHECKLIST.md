# Ekoyini — Launch Checklist

Track A (this MVP) vs. Track B (production-ready) — don't take real payments
or real orders until the Track B items are checked off.

## ✅ Done (Track A — MVP)

- [x] 269-SKU catalog (260 alcohol + water/ice/non-alcohol) with retail pricing
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

- [x] **Real payment gateway (Yoco), code-complete but unverified.** Full
      Checkout API integration: `POST /order/checkout-session` starts a
      Yoco hosted checkout without creating an Order yet; `POST
      /webhooks/yoco` verifies the webhook signature (HMAC-SHA256,
      Standard Webhooks/Svix-style), independently re-fetches the checkout
      from Yoco's own API (never trusts the webhook payload or the
      success-redirect alone, per Yoco's own guidance), and only then runs
      the same order-creation transaction COD/EFT already uses — so stock
      and promo codes are enforced identically regardless of payment
      method. Stays fully inactive (card option disabled in the UI, `POST
      /order` still rejects `paymentMethod: "card"` outright) until
      `YOCO_SECRET_KEY` and `YOCO_WEBHOOK_SECRET` are set.
      **⚠ Built against Yoco's public docs, not yet tested against a real
      Yoco account** — the webhook payload field names are best-effort;
      see the warning at the top of `payments.js`. Test with a Yoco
      sandbox checkout and watch the server logs on the first few real
      webhook deliveries before trusting this for actual money.
- [x] **Age verification — deliberately staying self-attestation.** Not a
      gap: this was a considered decision, not an oversight. Real ID
      scanning needs a paid vendor (BlinkID, Smile ID, Onfido, etc.) and
      isn't how the rest of the industry handles it either — Uber Eats and
      most alcohol delivery apps take the same "confirm you're 18+, use
      judgment on an obvious minor" approach this app already has. Revisit
      only if there's a specific compliance requirement forcing the issue,
      not by default.
- [x] **Admin auth.** `/admin/admin.html` now logs admins in with real
      Supabase Auth accounts; the server checks the logged-in user's email
      against the `ADMIN_EMAILS` allowlist on every admin route. Sign each
      admin up as a customer account, then add their email to
      `ADMIN_EMAILS`. `ADMIN_API_TOKEN` still works as a scripts/curl
      fallback — unset it once every admin has a real account.
- [x] **Resend email.** `POST /order` (COD/EFT) and the Yoco webhook
      (card, once payment's confirmed) both send an order-confirmation
      email to the customer and an alert to every `ADMIN_EMAILS` address,
      via `emails.js`. Fully inactive — logs and returns, never throws —
      until `RESEND_API_KEY` is set; defaults to Resend's zero-setup
      `onboarding@resend.dev` sender until you verify your own domain.
- [ ] **WhatsApp Business API.** Driver/tavern dispatch messages currently
      open `wa.me` deep links that the admin has to manually send — fine
      for a founder-run MVP, not for scale.
- [x] **Live driver GPS.** No paid mapping account needed — the driver's own
      phone browser is the GPS source, and the map is Leaflet.js + OpenStreetMap
      tiles (free, no API key). At assign time (`PATCH /order/:code/assign`) the
      server generates a random `driverShareToken` and stores it on the order;
      the WhatsApp dispatch message to the driver now includes a
      `driver-track.html?code=...&token=...` link built from it. That page needs
      no login — the driver taps "Start Sharing," which calls the browser
      Geolocation API (`watchPosition`) and posts `{ token, lat, lng }` to
      `POST /order/:code/location` roughly every 10s (throttled client-side).
      The endpoint checks the token against the order and only accepts updates
      while the order is `DISPATCHED` — a stale or wrong token, or an
      undispatched/delivered order, gets rejected. `/track.html` polls
      `GET /api/order/:code/track` every 30s and renders a live Leaflet map
      once a location is present; the server itself drops any ping older than
      3 minutes (`LOCATION_STALE_AFTER_MS`) so a driver who closed the tab
      never leaves a stale dot showing. No env vars or credentials required —
      this is on by default for every dispatched order.
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
- [ ] Verify pricing for the remaining SKUs against real SA retail prices.
      27 flagship SKUs (Absolut, Jameson, Johnnie Walker, Bells, Gordons,
      Klipdrift, Savanna, JC Le Roux) were corrected against researched
      Shoprite LiquorShop / Preston's Liquor Stores prices; beer and Amarula
      were checked and already accurate. The other ~230 rows in
      `prisma/data/skus.csv` are still the original supplier-sheet estimate,
      never individually verified against a real retailer.
- [ ] Smoke-test the full customer journey end to end on the deployed URL,
      not just locally
