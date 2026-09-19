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
