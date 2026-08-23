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
- [ ] **Admin auth.** `/admin/admin.html` is gated by a client-side PIN+OTP
      UI and a shared `ADMIN_API_TOKEN` header — neither is per-admin-user
      auth. Move this to real Supabase Auth sessions with an `is_admin`
      claim/role before handing dashboard access to more than one trusted
      person.
- [ ] **Resend email.** `.env.example` has a `RESEND_API_KEY` slot but
      nothing sends order confirmation or admin-alert emails yet.
- [ ] **WhatsApp Business API.** Driver/tavern dispatch messages currently
      open `wa.me` deep links that the admin has to manually send — fine
      for a founder-run MVP, not for scale.
- [ ] **Live driver GPS.** `/track.html`'s timeline is status-based only,
      no live map location.
- [ ] **Promo codes.** The cart's promo code field is UI-only — there's no
      `Promo`/`Deal` data model behind it yet.
- [ ] **HTTPS enforcement + RLS.** Confirm Render is serving HTTPS-only and
      add Supabase Row-Level Security policies so a user can only read
      their own orders (today, `/api/my-orders` is correctly scoped in the
      API layer, but RLS is a second line of defense worth adding once you
      query Supabase directly from anywhere).

## Before flipping "live"

- [ ] Replace the PIN (`admin/admin-api.js` → `ADMIN_PIN`) and
      `FOUNDER_WHATSAPP` number from their placeholder values
- [ ] Replace `SUPABASE_URL` / `SUPABASE_ANON_KEY` in `public/auth.js` with
      your real project's values
- [ ] Set a strong, unique `ADMIN_API_TOKEN` in production — never reuse the
      local dev value
- [ ] Re-seed with real supplier pricing if `prisma/data/skus.csv` still has
      placeholder numbers for any SKU
- [ ] Smoke-test the full customer journey end to end on the deployed URL,
      not just locally
