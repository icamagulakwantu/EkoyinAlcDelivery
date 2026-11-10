# Ekoyini launch readiness (full diagnosis, 10 Nov 2026)

Checked on the live code (merge `40ad6d6`), the live database (read-only),
live server logs, and a full local rehearsal. Unit tests: **80/80**.
Staged end-to-end scenarios (`staging/`): **24/25**. The one failure (6.3, faked
IP vs rate limits) only fails on a local machine; live has `TRUST_PROXY_HOPS=3`,
checked against Render's real proxy headers on 9 Nov.

## Verdict: the app is about 95% ready; the business is about 70% ready to launch

| Area | Score | Why |
|---|---|---|
| Software (shop, cart, checkout, pricing, payments code, admin, security) | **95%** | 24/25 scenarios, 80 tests, prices match server to the cent, stock races safe, card recovery, RLS lock-down |
| Live operations (emails, real orders, dispatch team, stock) | **45%** | Emails are not sending, no order has ever been delivered, no dispatcher accounts, stock not real |
| Legal & compliance | **40%** | Legal pages have placeholders, trading hours not enforced, licence position to confirm |
| **Overall launch readiness** | **≈ 70%** | 6 must-fix items below; 2 are small code changes, 4 are setup by the founder |

## Must fix before launch (blockers)

| # | Blocker | What we found | Who / effort |
|---|---|---|---|
| 1 | **Order emails are not being sent** | Live log 10 Nov 06:27: `RESEND_API_KEY not set — skipping` for order EKO-FKA9SAV9 (customer confirmation and the team alert). The key is not on Render. | Founder: add `RESEND_API_KEY` on Render → ekoyini-api → Environment, choose **Save, rebuild and deploy**. 2 min |
| 2 | **Customers who won't share their location can't order** | Since the 16 taverns have pins, checkout *requires* a GPS pin. A customer on a desktop, or who taps "Block", is stuck. | Code (small): allow the order without a pin, charge the base R40, and flag it "no pin: confirm distance" for the dispatcher. Needs founder OK |
| 3 | **Liquor trading hours not enforced** | The Terms promise legal hours; the app takes orders 24 hours a day. | Founder: confirm Eastern Cape off-consumption hours (and Sunday/holiday rules). Then code (small): closed-hours message + server refusal |
| 4 | **Legal pages have placeholders** | `privacy.html` and `terms.html` still say `[REGISTERED COMPANY NAME]`, `[REG NO]`, `[PHYSICAL ADDRESS]`, `[NAME]` (Information Officer), `[PRIVACY EMAIL]`, `[EMAIL]`, `[PHONE]`, `[DATE]`, `[X]`, `[EMAIL / WHATSAPP]`. POPIA needs a named Information Officer. | Founder sends details; 10-minute edit |
| 5 | **No order has gone all the way through** | Live: 9 orders ever, **0 delivered**; 2 EFT orders waiting for payment (tests); 3 card checkouts started but never paid, so **no live card payment has ever completed**. | Founder: one real card order and one EFT order, through to "Delivered" with a real driver |
| 6 | **Licence position** | The app sells at one platform price from shared stock bought at Siba. In South Africa liquor must be sold from licensed premises by the licence holder. | Founder: confirm with the Eastern Cape Liquor Board (or a liquor attorney) that each sale goes through a licensed partner tavern / Siba's licence, or that Ekoyini holds its own. Not legal advice |

## Should fix in the first weeks

| # | Item | Found |
|---|---|---|
| 7 | **No admin or dispatcher accounts** | `AdminUser` table is empty. Add your dispatchers in Admin → Admins (Dispatcher role) |
| 8 | **Stock is not real** | 325 of 328 products show stock 999 (the default), so the app can sell what Siba doesn't have. Either set real stock in Admin → Stock, or decide on "always available, we confirm by phone" |
| 9 | **Render free plan** | Cold starts: the first customer after a quiet spell waits ~30 s, and Yoco's payment notice can arrive late (covered by the status check, but slow). Starter plan ≈ R130 a month |
| 10 | **Leaked-password check is off** | Supabase → Authentication → Passwords → turn on "Leaked password protection" ([guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)) |
| 11 | **133 prices are estimates** | Marked "estimate" in `prisma/data/price-corrections-2026-11-08.csv`. Siba receipts cover the fast movers; the rest are worth a shelf check |
| 12 | **4 products without a real photo** | Ice Tropez, Coca-Cola 500ml can, Schweppes Lemonade and Tonic cans |
| 13 | **Clean up test orders** | Cancel EKO-D6VQV4BL and EKO-FKA9SAV9 if they were tests |
| 14 | **Support WhatsApp number** | The app shows 064 004 5465. Confirm it is the business line |

## What passed (evidence)

| Area | Result |
|---|---|
| Catalogue | 328 products, all priced, photos all load, no supplier/cost data in the public API, every photo the same size |
| Pricing | Server total = what the customer saw, to the cent (EFT, card, promo, Cooler Box, Safety Seal, bottles & crates, load fee). Tampered prices/quantities/fees refused. R300 minimum enforced. Never below Siba cost (30 receipt items tested) |
| Payments | Card: paid with no webhook → order created once; wrong amount → flagged, no order; forged webhook refused; webhook twice → one order. EFT waits for confirmation. Cash: new account refused, trusted allowed, R1500 cap |
| Stock | Two customers racing for the last item → exactly one gets it; never negative; sold-out can't be ordered |
| Order lifecycle | EFT → confirm → assign tavern + driver → pickup → live location → delivered → rating; customers see only their own orders |
| Delivery | 16 partner taverns with pins; distance to the nearest (R40 for 3 km, then R6/km); heavy-load fee; surge windows |
| Security | Every table locked (RLS, no public grants); admin endpoints refuse customers; admin token lock-out; security headers; no secrets in the repo; script in a name stored as text |
| Resilience | Bad input → clean errors; unknown page → friendly 404 |
| Analytics | Cloudflare Web Analytics live (founder confirmed) |

## How to re-run
- Unit tests: `node --test` (80).
- Scenarios: see `staging/README.md` (25 scenarios; they now send a delivery pin, like real customers).
