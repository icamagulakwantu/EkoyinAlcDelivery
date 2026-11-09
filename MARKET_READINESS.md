# Ekoyini market-readiness evaluation (8 Nov 2026)

Code evaluated: branch `claude/app-ui-ux-logic-upgrade-nn7g90` (PR #4) on top of
the live branch. Method: the real server against a local Postgres seeded with the
full 326-product catalogue, with stand-ins for Yoco and Supabase login. 24 staged
API scenarios (`staging/`), 13 browser scenarios on a simulated phone, 57 unit
tests, a dependency audit, a photo-weight check and a read of the legal pages.

## Verdict: not yet. The software is ready, the business setup is not.

Ordering, pricing, payments, stock, the order lifecycle and security all pass.
**Three things must be done before launch**, and none of them is code:

| # | Blocker | Why it matters | Who |
|---|---|---|---|
| 1 | **Legal pages still have placeholders**: `[REGISTERED COMPANY NAME]`, `[REG NO]`, `[PHYSICAL ADDRESS]`, `[NAME]` (Information Officer), `[PRIVACY EMAIL]`, `[EMAIL]`, `[PHONE]`, `[DATE]` in `public/privacy.html` and `public/terms.html`. | POPIA requires a named Information Officer and contact details. Customers and Yoco can see the gaps. | Founder supplies the details; a 10-minute edit |
| 2 | **Liquor trading hours are not enforced.** The Terms promise "deliveries happen only within the legal trading hours", but the app takes orders 24 hours a day and even charges a late-night fee from 22:00 to 04:00. | Selling outside licensed hours puts the partner taverns' licences at risk. | Founder confirms the Eastern Cape off-consumption hours (and Sunday or holiday rules) with the Eastern Cape Liquor Board. Then it's a small code change: closed-hours message plus server refusal |
| 3 | **No live order has gone through end to end since 6 Nov.** Your earlier test order did not reach the live database, and a card checkout from 6 Nov 20:33 is still unresolved. | The live setup (Yoco keys, webhook, Supabase login, emails) has only been exercised locally. | After PR #4 deploys: place one real card order and one EFT order on www.ekoyini.co.za, and check the 6 Nov payment in the Yoco dashboard |

## Scorecard

| Area | Result | Evidence |
|---|---|---|
| Catalogue | ✅ Pass | 326 products, all priced, no supplier or cost data in the public API, no quart over R35, a case never dearer than singles |
| Pricing integrity | ✅ Pass | Server total = total shown to the customer, to the cent, for EFT, card, promo, Cooler Box and Safety Seal orders. Tampered requests (fake price, negative or zero quantity, unknown product, made-up fees, bad phone, control characters) are refused or ignored. R300 minimum enforced |
| Promo codes | ✅ Pass | Discount matches; single-use, minimum-spend and expired codes are refused |
| Card payments | ✅ Pass | Paid with no webhook → order created once. Wrong amount charged → flagged for refund, no order. Forged webhook → 401. Webhook delivered twice → one order. Another customer cannot read your checkout |
| Cash on delivery | ✅ Pass | New account refused with a clear reason, trusted account allowed, R1500 cap enforced |
| Stock | ✅ Pass | Two customers racing for the last bottle → exactly one gets it. Stock never goes negative, cancelling restores it, sold-out items can't be ordered |
| Order lifecycle | ✅ Pass | EFT → admin confirms → assign tavern + driver → wrong driver link refused → pickup → no customer cancel once dispatched → live location → delivered → rating (once, own order only). Public tracking hides phone numbers and the address |
| Admin security | ✅ Pass | Every admin endpoint refuses anonymous callers and customers |
| Age verification | ✅ Pass | Under-18 blocked. Deep links (e.g. a shared shop link) send unverified visitors to the gate and back afterwards. Checkout requires the 18+ and Terms boxes |
| Error handling | ✅ Pass (fixed today) | Malformed JSON and huge carts get clean errors. Unknown pages showed a bare "Cannot GET"; there is now a friendly 404 |
| Browser security headers | ✅ Pass (fixed today) | Added nosniff, frame protection, HSTS, Referrer-Policy and Permissions-Policy. Content-Security-Policy left out on purpose (see CLAUDE.md) |
| Rate limiting | ⚠️ Needs one setting | Limits work per IP, but `trust proxy: true` lets anyone fake their IP and dodge them; the rate-limit library logs this warning on every start. Fixed in code behind `TRUST_PROXY_HOPS` (see below) |
| Mobile performance | ✅ Pass (fixed today) | Product photos went from 29 MB to 11 MB with the same file names, and the shop's first load from 2.5 MB to 0.96 MB. The optimiser never ran on deploy (the dashboard build command overrides render.yaml); its comment now says to run it by hand |
| Dependencies | ⚠️ Low risk | `npm audit`: 1 high (sharp/libvips). sharp is only used by the offline image script on our own files, never at runtime. Upgrade to sharp 0.35.5 in a quiet moment and test the build |
| Photos | ⚠️ Minor | 324/326 have a product photo. Schweppes Lemonade and Tonic cans use a generic stock photo, not the product |
| Emails | ❓ Not verified | Order emails use Resend and are skipped when `RESEND_API_KEY` is not set. Check it is set on Render |
| Promo admin | ⚠️ Gap | There is no admin screen for promo codes; they can only be added in the database |

## Fixed during this evaluation (in PR #4)
- Friendly 404 page for people, JSON `{"error":"Not found"}` for anything under `/api/`.
- Browser security headers on every response.
- `TRUST_PROXY_HOPS` setting plus an admin-only `GET /admin/client-ip` endpoint that shows what Render's proxies send.
- Product photos compressed (palette PNG and JPEG q80, max 600px, same names).
- Service-worker cache bumped to `v5`.

## Set this on Render after deploying
1. Open `https://www.ekoyini.co.za/admin/client-ip` while signed in as admin. Count the IPs in `xForwardedFor`:
   - one IP: set `TRUST_PROXY_HOPS=1`;
   - two (yours plus a Cloudflare edge address): set `2`.

   Re-open the page: `reqIp` must show your own IP.
2. Confirm `RESEND_API_KEY`, `YOCO_SECRET_KEY` and `YOCO_WEBHOOK_SECRET` are set (values never go in chat or Git).

## Recommended next (after launch blockers)
1. Move Render off the free plan. Cold starts make the first customer of the morning wait, and slow Yoco webhooks (now covered by the status check, but still slow).
2. An admin page for promo codes.
3. Check the shelf prices marked "estimate" in `prisma/data/price-corrections-2026-11-08.csv`.
4. Webhook replay window: reject signed Yoco messages older than 5 minutes. Harmless today because processing runs once, but standard practice.
5. Real photos for the two Schweppes cans.

## How to re-run
`staging/README.md` covers the 24 API scenarios (23/24 pass until `TRUST_PROXY_HOPS` is set). Unit tests: `npm test` (57 pass).
