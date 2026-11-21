# Ekoyini — Alcohol Delivery Platform

A **mobile-first, ride-along delivery app** for alcohol, tobacco, and beverages in South African townships. Uses on-route e-hailing drivers instead of a dedicated fleet — faster, cheaper, and already trusted by riders.

## Changelog — 6 November 2026 (Receipt calibration & Care fee)

### 21 Nov 2026 (night): company details from the CIPC certificate go into Terms and Privacy, no database change
- Terms 1.1, 1.2, 30.1 and Privacy 1.1 now name **K2020465422 (South Africa) (Pty) Ltd, registration number 2020/465422/07, trading as Ekoyini** (registered 11 Jun 2020; registered office 11 Main Avenue, 303 Riviera Mansions, Killarney, Johannesburg 2193; trading address stays 7 Torquay Street, Summerstrand). Replaces "Ekoyini Holdings" (not on the certificate). The Information Officer is described as the director. The director's ID number is deliberately NOT in the repo. Still missing: VAT number (not on the certificate), liquor licence structure, Information Officer registration. Service worker cache `ekoyini-shell-v40`.

### 21 Nov 2026 (late afternoon): shelf check of estimated prices, lockfile and dependency fix, one new photo, no database change
- **Shelf check (live SA retailer listings, 21 Nov):** the highest regular price of the exact pack, then the usual markup. Now marked verified in `lib/price-corrections-2026-11-08.js`: Breezer Watermelon 6 x 275ml R124.99 (Checkers/Shoprite/PnP), Wild Africa Cream R169.99, Strongbow Gold Apple 6 x 330ml R114.99, Hunter's Gold cans 6 x 440ml R119.99. Changed: Jose Cuervo Silver R355 to R339 (Takealot), Ponchos Caramel R349.99 to R339.99, Tequila Rose R299.99 to R209.99 (PnP, listed but out of stock there), Nachtmusik R199.99 to R184.99 (PnP, Mozart Eine Kleine Nachtmusik), Kanonkop Kadette Cabernet R159.99 to R179.99 (Checkers; PnP R154.99), Hunter's Iced Apple quart R24.61 to R25.99 (Shoprite). The nine Kopparberg rows moved from R180 to R194.99: SA shelves sell 4 x 330ml at R129.99 (R32.50 each), so the 6-pack price is derived, not a real shelf price.
- **Not confirmed (no listing found, or only trade prices, so left as estimates):** Budweiser, Guinness (only 4-packs), Sol quart, Windhoek dumpy, Flying Fish Chill, Redd's cans and dumpies (a PnP 6 x 330ml listing at R69.99 looked old and out of stock, so the higher estimate stays), Hunter's Dry can and Iced Watermelon, Tia Maria (Makro trade R389 only), Ciroc Apple, Ponchos Blanco, Flowstone, Nederburg Sauvignon Blanc, the other Butlers liqueurs (Triple Sec and Blue Curacao R229.99 at Checkers confirm the base price), Monin, waters.
- **Makro included (founder, 21 Nov):** Makro listings now count as shelf evidence. Tia Maria R299.99 to R389 (Makro 750ml); Hunter's Dry can marked verified (Makro 6 x 440ml R119). Makro pages for Budweiser, Redd's, Windhoek, Sol, Flying Fish Chill and Ciroc Apple showed no readable price, so those stay estimates.
- **Second sweep (Takealot, PnP, Woolworths, Liquor City, Makro, PriceCheck, 21 Nov):** Budweiser 6 x 330ml R99.99 to R74.99 (PnP and Liquor City both R74.99); Windhoek Lager 6 x 330ml R104.99 confirmed (PnP); Hunter's Iced Apple and Iced Watermelon cans R119.99 to R114.99 (Shoprite, PnP, Checkers); Chillers Tequila Sunrise 6 x 440ml R154.99 confirmed. No usable listing found: Budweiser cans, Guinness 6-packs (retailers sell 4-packs), Sol quart, Redd's, Flying Fish Chill, Ciroc Apple, Ponchos Blanco, Flowstone, Nederburg Sauvignon Blanc (Classic R85 to R90, Winemasters R109 to R114.99, which one we sell is unclear), the 500ml waters. Monin 700ml syrups sit at R207 to R222 at Takealot and Makro, below the founder's R230 floor, so the floor still decides them.
- **Founder prices (21 Nov):** Budweiser 6 x 330ml R120 and Windhoek Lager 6 x 330ml R110 are fixed in `lib/founder-prices-2026-11-09.js` (they win over the shelf price; "we never go for lesser prices"). Hunter's cans stay at the R130 can floor; the Iced Apple/Watermelon shelf rows are back at R119.99. Budweiser cans are already at the R130 floor.
- **Dependencies:** added `package-lock.json` (deploys now install the same versions) and moved `sharp` to ^0.35.5 (Render runs Node 24; sharp is used only by the image scripts). `npm audit`: 0 vulnerabilities (was 1 high in sharp).
- **Photos:** added `thirsti-sparkling-1-5l.webp` for Thirsti Sparkling 1.5L (from the I-Camagu photo set, a 1.5L bottle labelled sparkling). The other 21 products still have no photo because no exact-pack picture exists in our sources (the Valpre 500ml file is still water, the Kopparberg and Flying Fish bottle photos are 330ml, not cans or quarts).

### 20 Nov 2026 (afternoon): full Terms & Conditions and Privacy Policy rewrite, no database change
- **Why:** the old pages were short, out of date (they still said the service fee was R50 to R110) and had a "Draft for legal review" banner. No lawyer yet, so the new text was drafted from the law and from what comparable South African services publish (Checkers Sixty60, Mr D, an SA online wine seller, Pick n Pay liquor limits) and then matched to what the app really does.
- **Terms (version 2.0, 30 sections):** Ekoyini is the platform and acts for the licensed partner outlet that sells the alcohol; 18+ and ID at the door; PIN rules; fees quoted from `public/pricing.js` (delivery R40 for 3 km + R6/km, load R1.50/kg over 20 kg, peak R20 / late R30, Care & Handling 5% min R10 max R75 for every payment method, R10 seal, bottle and crate charge, one discount only, Cooler Box 2.5% from R2000 max R50 first 5 orders until 20:00); cash on delivery R300 to R1500 after 10 delivered orders; cancel free until the driver collects; failed-delivery rules; 24-hour problem reports with the CPA 6-month defect right kept; ECTA cooling-off exclusion for drinks delivered to a home; force majeure; limitation of liability, indemnity and acknowledgements in three boxed clauses (CPA s49) that never claim to cover gross negligence (CPA s51) or product harm (CPA s61); complaints route (NCC, Eastern Cape Liquor Board, Information Regulator); Gqeberha courts.
- **Privacy Policy (version 2.0, 18 sections):** POPIA responsible party and Information Officer (by role), what is collected and where from, lawful basis table, who sees what (the outlet never gets name, phone or exact address), Frankfurt hosting and cross-border rule (s72), opt-in-only marketing (s69), location, on-device storage, retention table, rights and how to use them, automated cash-on-delivery rule, security, drivers and outlet staff, children.
- Sign-up now says "By signing up you agree to our Terms and Privacy Policy". The checkout tick box now says it covers the boxed clauses in sections 21 to 23 and links straight to them.
- New `test/legal-pages.test.js` (9 tests) fails the deploy if a fee in the Terms stops matching `pricing.js` / `server.js`, a placeholder or draft banner comes back, a boxed clause goes missing or a contents link breaks. **When you change a fee, change `terms.html` in the same commit.**
- Not done on purpose: nothing here is lawyer-reviewed. Open items for an attorney are listed in the chat reply of this date (liquor licence structure, ECTA s43 company details, Information Officer registration).
- Service worker cache is now `ekoyini-shell-v39`.

### 21 Nov 2026 (later): admin header fix and driver ratings, no database change
- **Admin dashboard on a phone:** the dark header (stats, alerts switch, log out) was sticky and filled about half a phone screen, sliding under the section tabs while scrolling. It now scrolls away on its own and is more compact; only the section tabs and filter tabs stay pinned. Section tabs no longer squash (they scroll sideways). The "Turn on order alerts" switch is centred. CSS only (`admin/admin.css`).
- **Driver ratings:** the driver's Earnings tab shows the average of customers' 1 to 5 ratings on their delivered orders (existing `Order.rating`, no new table). The average only shows from 3 ratings so one unhappy customer does not define a new driver (`summariseRatings` in `lib/driver-app.js`). Service worker cache is now `ekoyini-shell-v37`. 160 tests.

### 21 Nov 2026 (later): face-lift audit of the customer app, no database change
- Rendered home, shop, cart, checkout, sign-in, sign-up, profile, tracking, confirmation and 404 at phone size against the real catalogue (read-only copy of the live products) and fixed what was off. Driver and tavern apps were built to the same style and checked earlier; admin already had the "Golden Hour" restyle.
- **Fixed:** the cart icon showed a "0" badge (now hidden until something is in the cart); a stray sliver of the hidden notification peeked at the top of the shop (`.toast-top` now fully off-screen); the shop address bar and the checkout "Your order" strip ran edge to edge (now inset like the banners); the first shelf had a ~65px blank gap above it; cart "R128.34 each" wrapped onto an orphan "each" line (now its own tidy line); checkout photo thumbnails hid their quantity badges; profile "Your Orders" heading sat jammed under the Specials card, and the email cut off with "…"; the Log In / Sign Up button was narrower than the fields; the tracking driver text had an odd indent.
- Service worker cache is now `ekoyini-shell-v38`.

### 21 Nov 2026: tavern portal (founder approved, new migration)
- **Tavern portal at `/tavern.html`:** a partner tavern signs in with its saved cell number + a 6-digit PIN (made by admin) and gets three screens. **Orders:** "Pack these now" (items, driver name, the 4-digit collection PIN to read out, "Ready for collection" button), "Coming your way" (paid orders heading to this tavern before a driver takes them: area and items only, no code, no customer) and "Collected in the last 24 hours". **Items:** search the catalogue and tap "Sold out" / "Back in stock". **Money:** yesterday, today so far and the last 7 days of what Ekoyini owes the tavern (same sums as admin Payouts, `payoutsFor`), with "Paid" once admin marks it paid.
- **Sold out steers orders, nothing else:** stock and prices stay shared. A tavern marked sold out of an item is skipped when an order picks its tavern (job board, taking a job, tavern alerts), so the order goes to the next nearest tavern that has everything. If no tavern can supply it, the job shows "Dispatch will assign". Orders already assigned never move.
- **Ready tag for drivers:** when the tavern taps Ready, the driver's job card shows "Ready to collect". Admin re-assigning an order clears it.
- **Closed-app tavern alerts (web push):** "New order coming to you" and "Pack order <code>" (driver on the way). Tavern phones live in `PushSubscription` as `adminEmail = "tavern:<tavern id>"`; admin alerts skip them (`isTavernKey`). No customer details or PIN in any lock-screen text.
- **Admin → Drivers tab → "Tavern portal":** Switch on / Reset PIN / Pause / Resume per tavern; the PIN is shown once with a WhatsApp button. Needs a valid cell number saved for the tavern. The admin WhatsApp message to the tavern still works for taverns without the portal.
- **Migration `20261121090000_add_tavern_portal`:** new tables `TavernAccess` (PIN hash + session, one row per tavern, kept apart from `Tavern` so hashes can never ride along in an order response) and `TavernSoldOut`, plus nullable `Order.readyAt`. Nothing existing is changed or removed. RLS re-applied by `ensure-schema`.
- Service worker cache is now `ekoyini-shell-v36`. 159 tests (13 new in `test/tavern-portal.test.js`).

### 20 Nov 2026 (later): driver app gaps closed, no database change
- **Closed-app job alerts for drivers:** the driver app has a "Turn on job alerts" switch (web push, same mechanism as admin alerts). When a paid order has a tavern and no driver, every active driver who turned alerts on and has fewer than 3 jobs gets "New job in <area>" with earnings, distance and items only (no address, no customer). Fired from card checkout, cash/EFT order creation and EFT payment confirmation (`lib/driver-push.js`, `driverPush.notifyNewJob` in `server.js`). Alerts stop when a driver signs out, is paused or has the PIN reset.
- **No new table:** driver phones are stored in `PushSubscription` with `adminEmail = "driver:<driver id>"`. Admin alerts skip and never delete those rows (`isDriverKey` in `lib/push.js`). A phone that already gets admin alerts cannot also be a driver phone (it says so); use another phone or browser to test.
- **iPhone:** needs the driver page added to the Home Screen first (the app tells the driver). Notification taps now focus the page the alert is for (service worker `ekoyini-shell-v35`).
- **Admin assign form:** a "Pick a driver from the app" dropdown fills name, phone and vehicle from Admin → Drivers (active drivers only). Typing a driver by hand still works.
- 146 tests (`test/driver-push.test.js`).

### 20 Nov 2026: driver app (new `Driver` table, founder approved)
- **Driver app at `/driver.html`** (installable, works on weak data): sign in with cell number + 6-digit PIN. Tabs: **My jobs** (collect from tavern, then deliver; opens the existing PIN-proven page `driver-track.html`, so the collection PIN, delivery PIN, live location and delivered checks are unchanged), **Job board** (paid orders with no driver: area, distance, what the driver earns, items; NO street address or customer until the job is taken; "Take this job", first driver wins atomically, max 3 active jobs), **Earnings** (today and last 7 days, cash collected taken off, payouts daily at 12:00). New jobs on the board buzz and beep while the app is open.
- **Taking a job** does what admin Assign does: tavern (the order's, else the nearest one with a pin), driver name, phone, vehicle, link token and a fresh collection PIN. Admin gets a push alert "Driver took EKO-..." and still sends the tavern its collection PIN. Admin can still assign or reassign any order as before.
- **Admin → Drivers tab** (`admin/drivers.js`): add a driver (PIN made by the server and shown once, with a WhatsApp send button), Reset PIN, Pause/Resume (pausing signs the driver out at once). Logged in the activity log.
- **Security:** PIN stored as a salted scrypt hash, session token stored as a SHA-256 hash (one device at a time, 14 days), 5 wrong PINs lock the account for 15 minutes, login rate limit per IP, the driver endpoints never return the collection or delivery PIN.
- **Database:** migration `20261120120000_add_drivers` adds the table only. `lib/driver-app.js` (logic), `routes/drivers.js`, `test/driver-app.test.js` (10 tests). Service worker cache `ekoyini-shell-v34` (driver page cached for flaky data).
- Not built yet: closed-app driver push alerts (drivers must have the app open to hear a new job) and a driver picker on the admin assign form.

### 20 Nov 2026: customer round 1 (habit features, no database change)
- **Your usuals (home):** a rail above "Popular right now" showing the drinks a customer hearted plus what they order most (from `/api/my-orders`), with an "Order your last again" link. Hidden until there is something to show.
- **Order again, one shared helper:** `EkoyiniReorder` in `public/script.js`, used by Profile, Track and Home. It checks today's catalogue, skips retired or out-of-stock items and says so, uses today's prices, and never doubles the cart (a second tap changes nothing).
- **Track page:** "Share live tracking on WhatsApp" while an order is active (free wa.me link, no WhatsApp Business Platform), "Order the same again" on delivered orders for signed-in customers, and the rating button now matches the dark shop style.
- **Bug caught:** the home "Popular right now" rail looked for `Bacardi Breezer Watermelon|Can (500ml)`, which is now the 440ml can, so it would have vanished from the rail. Fixed, and `test/home-rails.test.js` now fails if any home-page pick is not in the catalogue.
- Audit note: Reorder, favourites (hearts + filter in the shop) and star ratings already existed; Track was already in the new style. Cache is now `ekoyini-shell-v33`. 129 tests.

### 20 Nov 2026 (early): the last three size mistakes ("fix all of them")
- **Bacardi Breezer cans (Blackberry, Blueberry, Watermelon)** are **440ml**, not 500ml (shops sell Blackberry 6 x 440ml at R164.99). Renamed to `Can (440ml)`, customer price **R176.54** (R164.99 + 7%, was R160.50 for Watermelon and R224.70 for Blackberry/Blueberry). Note: the founder's Siba receipt of 9 Nov said 500ml R150; a test still keeps the price above that Siba cost. The Blueberry can has no shop listing (only the 275ml bottle), so it follows Blackberry and Watermelon; its old wrong photo stays cleared.
- **Hunter's Iced Apple and Watermelon**: no 330ml dumpy exists in shops (only the 500ml can), and the photos show a tall bottle, so the rows are now **Quart (660ml)**, priced like the other Hunter's quarts (supplier cost + 7% = **R37.36**, was R192.60 for the dumpy). The 500ml cans are unchanged.
- **Redd's 330ml dumpies are real** (Pick n Pay sells Original and Dry 6 x 330ml), so they stay as they are.
- Done with `FORMAT_FIXES` (renames live rows in place, ids and past orders untouched), `skus.csv`, price corrections, `WAS_BELOW_COST` and the photo map. 127 tests.

### 19 Nov 2026 (midnight, later): size corrections from the founder
- Founder confirmed the photos for Brutal Fruit (can and dumpy) are right and only the sizes were wrong; Brutal Fruit already has Can (500ml) and Dumpy (275ml) and no 330ml row any more, so nothing to change there.
- **Smirnoff Storm Citrus and Pine Twist:** dumpy is **300ml** (was labelled 250ml), 6 x 300ml shelf R119.99, customer price **R128.39** (was R106.99). Citrus now shows the founder's Storm bottle photo (`smirnoff-storm-dumpy-300ml.webp`); Pine Twist keeps its current photo.
- **Stella Artois can** is **410ml** (was labelled 500ml): shops sell 6 x 410ml at R109.99, so the price stays at the R130 alcoholic-can floor.
- Done with `FORMAT_FIXES` in `lib/catalogue-2026-11.js` (renames the live rows in place, so ids and past orders are untouched), `skus.csv`, the price-corrections rows and the photo map (old keys kept). Test added in `test/founder-prices.test.js`. Tests: 126.
- Not changed (no instruction yet): Breezer Blueberry 500ml can (no 500ml can found in shops), Hunter's Iced 330ml, Redd's 330ml.

### 19 Nov 2026 (midnight): real shelf prices from TinyFish research (highest regular price, promos ignored)
- Two TinyFish deep-research runs (spirits/wine and beer/cider/RTD) looked up the products that still had estimate prices. Rule used: the HIGHEST regular shelf price of the exact pack, crossed-out price when a promo is running, no card or "any 2 for" deals, no Makro Business trade prices. Source for each row is in `lib/price-corrections-2026-11-08.js`.
- **Applied (customer price = shelf + 7% wine/beer/cider, 5% spirits/mixers):** Beyerskloof Pinotage R144.44, Cape Velvet R188.99, Count Pushkin R204.74, Firstwatch R220.49, Grand Marnier R723.45, Grey Goose R629.99, Malibu R209.99, Moet Imperial Brut R802.49, Nederburg Baronne R106.99, Strawberry Lips R183.74, Wellington VO R220.49, 4th Street Sweet Red 750ml R58.84, Liqui Fruit Cranberry 1L R41.99, Amstel quart R26.74, Breezer Blackberry 6 x 275ml R138.03, Flying Fish Lemon and Dry Apple 6 x 330ml R106.99.
- **Below Siba cost, so cost + 5% instead (`WAS_BELOW_COST`):** Casamigos Reposado R856.80 (shelf R749.99, Siba R816) and Ciroc Pineapple R443.52 (shelf R369, Siba R422.40). The old Casamigos estimate was R1,259.99 and Ciroc Pineapple R629.99.
- **Not found or unclear, left unchanged:** Ciroc Apple, Jose Cuervo Silver, Kanonkop Kadette, Nachtmusik, Nederburg Sauvignon Blanc, Pongracz (bundle price only), Tequila Rose, Tia Maria, Ponchos Blanco/Caramel, Robertson Chapel 1.5L, Appletiser 1L, Flowstone, all Kopparberg, Guinness, Redd's cans/dumpies, Budweiser, Bernini Classic and Ruby Berry.
- **Suspected size mistakes in the catalogue (research found no such pack in SA shops), NOT changed yet:** Bacardi Breezer Blueberry 6 x 500ml can (shops sell 6 x 275ml at R124.99), Smirnoff Storm 6 x 250ml (shops sell 6 x 300ml R119.99), Stella Artois 6 x 500ml can (shops sell 6 x 410ml R109.99), Brutal Fruit 330ml (shops sell 275ml and 500ml cans), Hunter's Iced Apple/Watermelon 330ml, Redd's 330ml.
- Tests: 125 passing.

### 19 Nov 2026 (11 pm): founder's corrected size/price sheet checked
- Checked all 59 rows of the founder's corrected sheet against the catalogue. Sizes already match for Belgravia, Chillers, Hunter's, Redd's MXD and Strongbow cans (440ml), Corona can (410ml) and the 275ml/330ml dumpies. Prices already match (shelf + 7%/5%) for 34 rows.
- **Applied:** Hunter's Gold 6 x 330ml NRB shelf R131.94 (Shoprite, R21.99 each) so the customer price is **R141.18** (was R112.34 from an older Checkers R104.99; the highest shelf price wins).
- **Follow-up (founder, 11:30 pm):** Hunter's Dry 6 x 330ml moved to the same R141.18 as Gold. New product **Red Bull 355ml single can at R35** (founder: hard to find in the taverns; Shoprite shelf R27.99); the 250ml can stays at R30. The 355ml can photo moved to the 355ml row (the 250ml row had been borrowing it, now listed in `WRONG_PACK_PHOTOS`, so it shows no photo until we have a real 250ml one). Catalogue 356 rows; supplier cost for the 355ml is an estimate (R28). Schweppes Lemonade 6 x 200ml: skipped for now.
- **Left as they are (reason):** 4th Street Sweet Red 5L (founder's own shelf check R189.99 beats the sheet's "prior rerun" R248); Butlers liqueurs (Shoprite R229.99 is higher than the sheet's R209); Monin (flat R230.99 founder rule); Valpre 1.5L and Bonaqua 1.5L (R25 water rule); Bonaqua 500ml (deal price); Ponchos Coffee (ours is already higher). Not in the catalogue: Red Bull 355ml single (we sell 250ml at R30) and Schweppes Lemonade 6 x 200ml.

### 19 Nov 2026 (late night): Care & Handling is 5%, cap R75, for everyone
- **Care & Handling:** now **5% of the items, minimum R10, maximum R75**, the same for card, EFT and cash (was 3% / R10 / R40, with a card-only R75 cap). Founder decision, to cover card costs, running costs and cash flow. The markup was left alone so item prices stay close to the tavern shelf price.
- **Why not card-only:** a fee that only card payers pay is a card surcharge, which South African card rules (PASA, Visa, Mastercard, enforced by Yoco) and the Consumer Protection Act (section 23) do not allow. The card-only R75 cap from earlier today is gone: `careFeeFor(subtotal)` ignores the payment method.
- The R10 Safety Seal on spirits is still its own line, not part of Care & Handling.
- Examples: R300 order R15, R500 R25, R1000 R50, R1500 and above R75.
- Partner-pack example (`partner-pack/build.js`) now uses 5% / R75. The PDFs in `partner-pack/` were rebuilt with `node partner-pack/build.js` (rebuilt 19 Nov).
- Service worker cache `ekoyini-shell-v32` (pricing.js is a cached static file). Tests: 125 passing.

### 19 Nov 2026 (night): real shelf prices from the founder's check
- Founder checked 38 estimate prices on real shelves. 35 were applied as shelf price + the usual markup (7% beer/cider/RTD/wine, 5% spirits/liqueurs/mixers): e.g. Amstel 500ml cans R141.18, Sol cans R147.60, Savanna Dry cans R218.28, Chivas 12 R439.95, Jack Daniel's R387.45, Monin Agave R313.95, Drostdy-Hof Adelpracht R65.26, 4th Street 5L R203.29, Smirnoff Red R208.95. They are marked `verified` in `lib/price-corrections-2026-11-08.js`.
- Not applied: Valpre 1.5L (shelf R24.99, stays at the R25 water rule) and Monin Almond Orgeat and White Chocolate (shelf R225 would be R236.25, they stay at the flat R230.99 Monin price). Founder to confirm either way.
- Tests: 126.

### 19 Nov 2026 (late night): diagnosis fixes
- **Sign-up email link**: `signUp()` now sends `emailRedirectTo` = this site's `/login.html`. Supabase only honours it when the address is allowed, so the founder must set Authentication > URL Configuration: Site URL `https://www.ekoyini.co.za` and Redirect URLs `https://www.ekoyini.co.za/**` (the old default pointed at localhost).
- **One discount only**: a promo code and the Cooler Box discount no longer stack. The customer gets whichever is bigger (tie = Cooler Box); a promo that loses is not redeemed. Same rule in `priceOrder` (cart, checkout) and the server (`resolveOneDiscount`).
- **Prices**: every 1.5L water is R25 (founder: taverns sell it at R20, so R25 with our margin). Ten items that sold below supplier cost now sell at supplier price + markup: Hansa quart R23.87, Hunter's Dry and Gold quarts R37.36, Redd's Original and Berry quarts R32.99, Strongbow Gold Apple and Red Berries quarts R35.29, Coca-Cola Less Sugar 2L R30.45, Liqui Fruit Cranberry 1L R37.54, Valpre Sparkling 1L R19.69. A test now fails if anything sells below its supplier case price per unit.
- **Photos**: 7 packs that were showing another pack's photo now show the placeholder (Flying Fish Dry Apple quart, Bernini Ruby Berry can, Breezer Blueberry can, Kopparberg Mixed Fruit dumpy, Kopparberg Raspberry can, Grenadine Syrup Cordial jug). Hunter's Dry and the two Strongbow quarts/dumpies still share one photo each: founder to say which pack the photo shows.
- **Removed stale code**: `GET /api/stats`, `POST /admin/enrich-images` (+ status), `GET /admin/client-ip`, `sendDispatchWhatsApp()`. `GET /api/taverns` stays (the staging script uses it).
- Grenadine Syrup Cordial's borrowed Monin photo is also removed from the brand photo list in `prisma/seed.js`.
- Cache `ekoyini-shell-v32`. Tests: 126.

### 19 Nov 2026 (night): home category links keep the whole shop; full water range
- **Home category tiles and "See all" links no longer hide the rest of the shop.** `shop.html?cats=...` now opens the full shop and jumps to that shelf (the category bar shows every section). Curated collections (Braai, Festive, Stokvel, Chill) and brand-story filters still filter on purpose.
- **Water: every brand now has still and sparkling in 500ml and 1.5L** (Aquelle, Bonaqua, Thirsti, Tsitsikamma, Valpre). Added 6: Aquelle Still 500ml R15.75, Bonaqua Sparkling 500ml R15.75 and 1.5L R18.89, Thirsti Still and Sparkling 500ml R15.75, Valpre Sparkling 1.5L R19.94. All are ESTIMATES (5% markup, priced like the brand's nearest bottle; no shelf listing found for some, e.g. plain Bonaqua Sparkling), so check them on the shelf. No photos yet (the shop shows a letter tile). The older Valpre and Tsitsikamma Sparkling 1L rows stay (their photos are correct 1L bottles).
- Catalogue 355 products. Cache `ekoyini-shell-v30`. Tests: 122.

### 19 Nov 2026 (evening, later): spot pins and cash at all three spots
- Founder sent map pins: Lifa and Mafa (-33.8642829, 25.5595724), KwaMagxaki Butchery (-33.841218, 25.533170), Patzar Butchery (-33.817659, 25.585839). All three are public and safe, so **cash on delivery is allowed at all three** (Patzar now included). Delivery fee is now worked out from the pins. R300 to R1,500 cash limits still apply. A test requires every spot to have a pin.

### 19 Nov 2026 (evening): first-5-orders discount, cash rules, hangout spots
- **Cooler Box discount is for a customer's first 5 orders** (cancelled orders do not count). The server decides (`COOLER_FIRST_ORDERS`, `countOrdersForOffers` in `server.js`, `coolerAllowed` in `priceOrder`); `GET /api/my-offers` + `public/offers.js` keep home, shop, cart and checkout honest (the Cooler Box cards and nudges disappear after order 5). Home says "for your first 5 orders".
- **Cash on delivery now needs 10 delivered orders** (was 2). Default of `COD_MIN_DELIVERED_ORDERS` is 10; if that variable is set on Render it overrides the default. The R300 to R1,500 cash limits are unchanged.
- **Hangout spots** (`public/venues.json`, `lib/venues.js`): Lifa and Mafa and KwaMagxaki Butchery take **cash from anyone**; Patzar Butchery (Motherwell) is listed without cash. Checkout shows them as tap chips. A chosen spot overrides the address and pin on the server, so cash at a spot cannot be sent anywhere else. Their map pins (`lat`/`lng`) are empty until the founder supplies them: until then the base delivery fee applies and the admin card says "no pin". These are not taverns and not partners: no payouts.
- Cache `ekoyini-shell-v30`. Tests: 122.

### 19 Nov 2026 (afternoon): big-order profit protection, delivery promise, Triple Sec cost
- **Care & Handling** is 5% of the items, minimum R10, maximum R75, the same for card, EFT and cash (`CARE_FEE_PCT/MIN/MAX` in `public/pricing.js`; founder, 19 Nov late). The R10 Safety Seal on spirits is charged separately.
- **Cooler Box** stays 2.5% from R2,000 until 20:00 but is **capped at R50** (`COOLER_MAX_DISCOUNT`, `coolerDiscountFor()`), so a big order cannot wipe out our margin. Home, cart and checkout say "up to R50". Result: a R2,000 spirits card order now keeps about R35 (was R16) and a R5,860 one about R107 (was R32).
- **Delivery promise** is now "20–45 min after the driver confirms pickup" on the home page, checkout, confirmation and track page (was a flat 30–45 min).
- **Triple Sec Premium (San Basile)**: the workbook cost of R460.80 was wrong; the founder says the cost is about R240. Case cost in `prisma/data/skus.csv` corrected to R2,880 and R240 added to the Siba cost test. The R336 price stays.
- Cache `ekoyini-shell-v30`. Tests: 118.

### 19 Nov 2026: SEO and pay-one-order card QR
- **SEO:** `public/robots.txt` and `public/sitemap.xml` (home, shop, terms, privacy); canonical + Open Graph/Twitter tags on home and shop; JSON-LD (WebSite + LiquorStore, Gqeberha) on the home page; one real `<h1>` on the home page (the age gate heading is now a styled `div`); a short "we deliver in Gqeberha" line on the home page; `noindex` on every private page (cart, checkout, track, profile, login, signup, password pages, order confirmation, unsubscribe, 404). Tests in `test/seo.test.js`. After deploy: add the site in Google Search Console, submit `/sitemap.xml`, and claim the Google Business Profile.
- **Pay one order by card QR:** `lib/order-payment.js` + `routes/pay-qr.js`. `GET /pay/:code` starts a Yoco checkout for that order's exact total and redirects; `GET /pay/:code/qr.png` is the QR; `POST /api/order/:code/pay-check` settles right after the customer returns. Works for unpaid EFT and cash-on-delivery orders (not paid, cancelled or delivered). `completePaidCheckout` recognises these payments (marker `kind: "order-payment"` in `PendingCheckout.payload`) and marks the existing order paid by card (EFT orders move to PENDING); it never creates a second order, and a duplicate or wrong-amount payment is flagged for refund. Admin order card has a **Card payment QR** button; the track page shows **Pay R… by card**. No schema change. Not yet tested against live Yoco: do one real payment. `sendPaymentConfirmedEmail` takes `{ method: "card" }`. `/pay` is never cached by the service worker (cache `ekoyini-shell-v30`).

### 19 Nov 2026: order alerts that ring when the app is closed (web push)
- Problem: new-order emails arrived but nothing buzzed, and the dashboard only rang while its tab was open.
- New `lib/push.js` + `routes/push.js` + table `PushSubscription` (migration `20261119120000_add_push_subscriptions`, new table only). Each device that taps **Turn on order alerts** in the dashboard saves a push subscription; the server sends a notification to every device of every current admin for each new order (card, COD and EFT) and for the delay alerts (amber/red). Works with the dashboard closed or the phone in another app. Notifications show the area only, never customer name, phone or street.
- Needs Render env `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (optional `VAPID_SUBJECT`); without them it quietly does nothing and email still works. Devices of removed admins are dropped on the next send; dead devices (HTTP 404/410) are dropped too.
- `public/sw.js` handles `push` (cache `ekoyini-shell-v30`). The dashboard has its own manifest (`admin/manifest.json`) so an iPhone user can Add to Home Screen and open Ekoyini Admin, which iPhone requires for push.
- New-order email recipients are now `ORDER_ALERT_EMAILS` = orders@ekoyini.co.za + the Gmail (set on Render 19 Nov).
- Tests: `test/push.test.js`.

### 18 Nov 2026 (later): Google Business Profile cover image
- `marketing/ekoyini-google-cover.png` (2048 x 1152, 16:9): logo, "Cold drinks, to your gate.", the three promises (licensed local taverns, live driver tracking, sealed and ID checked), real product photos and the 18+ line. Rebuild with `node marketing/build-cover.js`. Not part of the website.

### 18 Nov 2026 (later): address suggestions while typing (Google Places, Nelson Mandela Bay)
- New `public/address-suggest.js`: as customers type an address (home, shop, cart and checkout address boxes), up to 5 Google suggestions appear, limited to Nelson Mandela Bay and South Africa. Tapping one fills in the clean address. Uses Places API (New) with session tokens (one billed session per address).
- Switched off until `GOOGLE_MAPS_API_KEY` is set on Render (served by `GET /api/maps-config`); without it the plain address box works as before. The key must be restricted to ekoyini.co.za and to the Maps JavaScript API and Places API (New).
- Address examples changed from "Orlando West" (Soweto) to "Zwide". Cache `ekoyini-shell-v25`.

### 18 Nov 2026 (later): proven pickup and delivery, live location required, delay alerts
- **Collection PIN:** assigning a tavern and driver creates a 4-digit PIN that goes only in the tavern's WhatsApp (and on the Admin order card). At the counter the driver types it in and must allow location to confirm pickup. Pickup is refused without the right PIN or without location.
- **Live tracking starts by itself** at pickup. The driver page warns if location stops reaching the server for a minute.
- **Delivery PIN:** every order gets a 4-digit PIN that only the customer sees (Track page when signed in, and the order confirmation email). The driver must enter it at the gate to mark the order delivered. Public tracking, the driver link and other customers never see it; the customer's order list no longer includes the driver link or the collection PIN.
- **Delay alerts** (`lib/dispatch.js`, `routes/dispatch-alerts.js`, `admin/dispatch-alerts.js`): paid with no driver after 10 min, assigned but not collected after 20 min, location silent for 3 min, out for delivery over 45 min. Amber at the limit, red at twice the limit. Shown in a bar on Admin → Orders (red plays a sound) and emailed once per level to the order-alert emails, checked every minute. Old open orders (over 2 hours) show in the bar but don't email.
- **Database (founder approved):** migration `20261118120000_add_dispatch_proof` adds `collectionPin`, `deliveryPin`, `paidAt`, `assignedAt`, `pickedUpAt`, `alertsSent` to `Order`.
- WhatsApp messages updated: tavern message carries the collection PIN; driver message explains both PINs. Cache `ekoyini-shell-v24`. Tests: 94 (new `test/dispatch.test.js`). Scenarios 25/26 (5.1 now checks both PINs, location and who can see them).

### 18 Nov 2026 (later): more still and sparkling waters
- Founder: every water brand in still and sparkling, 500ml and 1.5L. Added the 4 that are really sold in SA shops: **Aquelle Sparkling 1.5L** (R21), **Thirsti Sparkling 1.5L** (R18.90), **Tsitsikamma Sparkling 1.5L** (R20.99) and **Valpre Sparkling 500ml** (R16.80), each priced like the same brand's still bottle (founder rule: the higher price). No photos yet.
- Not added because no SA shop listing was found: Aquelle Still 500ml, Thirsti Still 500ml, plain Bonaqua Sparkling (only flavoured), plain Thirsti Sparkling 500ml (only flavoured) and Valpre Sparkling 1.5L. Founder to confirm on the shelf.
- Catalogue: 349 products. Rehearsed. Tests: 89.

### 18 Nov 2026 (later): Schweppes Tonic Water 1L; no more stock photos
- New: **Schweppes Tonic Water 1L**, R19.94 (Checkers R18.99 + 5%), sold one bottle at a time. No photo yet. Catalogue: 345 products.
- `prisma/seed.js` no longer gives soft drinks without a photo a generic stock picture (founder rule: better no photo than a wrong one). Products without their own photo show the shop's neutral placeholder. Rehearsed: 0 stock photos.

### 18 Nov 2026 (later): every brand sits together on the shelf
- Founder: products of the same brand must be together. `public/shelf-order.js` now sorts each section by brand first (the brand in brackets, e.g. "(Butlers)", or the first word of the name), then name with numbers in order, pack, and size small to big.
- Fixed: Aquelle, Tsitsikamma and Valpre were split (all still water listed before all sparkling); the 9 Butlers liqueurs were scattered by flavour; KWV ran 10, 12, 15, 3, 5 (now 3, 5, 10, 12, 15); water sizes now go 500ml, 1L, 1.5L. A sold-out item now drops to the end of its own brand instead of the end of the section.
- New test: no brand may ever be split within a section. Used by the shop, `/api/products` and the admin stock list. Cache `ekoyini-shell-v23`. Tests: 89.

### 18 Nov 2026 (later): Schweppes 1L bottles instead of cans; Coke can photo
- Founder: the two Schweppes 200ml cans are replaced by **Schweppes Soda Water 1L** and **Schweppes Dry Lemon 1L**, each R19.94 (Checkers R18.99 + 5%), sold one bottle at a time. Renamed in place in `scripts/ensure-schema.js` before the seed (same product ids, order history kept, still 344 products; rehearsed on a copy).
- Photos added from the founder: Coca-Cola Original 500ml can, Schweppes Soda Water 1L and Schweppes Dry Lemon 1L (black background made white), normalised like the rest.
- Cache `ekoyini-shell-v22`. Tests: 88.

### 18 Nov 2026 (later): phone numbers saved as +27 automatically
- Founder: the app should add +27 itself so a busy dispatcher never has to. Driver numbers (Assign form) and tavern numbers (Delivery tab) are now saved as `27XXXXXXXXX`, however they are typed (071..., +27 71..., with spaces or dashes), via `lib/phone.js` (`toSaWhatsApp`, tested in `test/phone.test.js`). A number that isn't a South African number is refused with a clear message.
- The 4 driver numbers already saved on live orders were converted to the same format (no data removed).
- Tests: 88.

### 18 Nov 2026: WhatsApp buttons accept local numbers; KwaSiba's number saved
- The tavern and driver WhatsApp buttons failed when a number was typed the local way (0719736683): WhatsApp links need 27719736683. Admin now converts any 0..., +27 or spaced number automatically (`waNumber()` in `admin/admin-api.js`), and the assign form's hint shows a normal cell number.
- KwaSiba's Ekoyini WhatsApp number (076 519 4607) saved on the live tavern and in `prisma/seed.js`; the seed no longer blanks a tavern's phone when it creates it.

### 17 Nov 2026: partner documents show the liaison officer by name
- Contact block on both proposals now reads "Thanduxolo Makeleni, Township Onboarding Liaison Officer", with the business WhatsApp 064 004 5465 and support@ekoyini.co.za (founder's choice). He is not described as founder or owner anywhere.

### 16 Nov 2026 (later): tavern proposal gets a "Fill the quiet days" page
- New page 3 in `partner-pack/Ekoyini-Partner-Tavern-Proposal.pdf` (now 6 pages): a week chart of walk-in sales plus extra Ekoyini orders (biggest lift Monday to Thursday), why weekday orders are worth more (no extra fixed costs, staff busy, stock moving, daily cash flow), who orders when it's quiet (after work, mid-month, rain, at home, safety), and an example of 3 weekday orders adding about R28 380 a month. Illustrations, not promises.

### 16 Nov 2026: partner pitch documents; Partner Taverns section
- **Pitch PDFs** in `partner-pack/`: `Ekoyini-Partner-Tavern-Proposal.pdf` (5 pages) and `Ekoyini-Driver-Partner-Proposal.pdf` (4 pages), with the Ekoyini logo, charts and earnings examples built from the app's real fee rules (labelled as illustrations, not promises). The contact is the "Township Onboarding Liaison" with the business WhatsApp and support@ekoyini.co.za; the founder's details are not used. Tavern standards: valid licence, a dedicated Ekoyini WhatsApp number, a dedicated packer on busy nights, drivers never queue, 3-5 photos. Growth path: Partner Tavern, then Featured Store, then Full Ekoyini Store. Rebuild with `node partner-pack/build.js`.
- **Home page: "Our partner taverns"** section, fed by `public/partner-taverns.json` (all 16 taverns, `listed: false`). Only taverns that have signed are switched to `listed: true`; the section stays hidden until then. Each card shows the tavern's photo (from `public/images/taverns/`, photos the tavern sends us) or a green card with its initials. No photos are taken from Google or elsewhere without permission.
- Cache `ekoyini-shell-v21`. Tests: 87.

### 16 Nov 2026: Render on a paid instance
- The founder moved `ekoyini-api` from the free instance to the $7/month Starter instance (0.5 CPU, 512 MB); the workspace stays on the free Hobby plan. The app no longer sleeps, so there is no 30-second first load, Yoco payment notices arrive on time and the 12:00 payout email goes out at 12:00.

### 11 Nov 2026 (later): taverns are paid daily too
- Founder: taverns and drivers are both paid daily at 12:00 for the previous day's deliveries. The Payouts tab and the 12:00 email now say so (the screen already opens on Yesterday).

### 11 Nov 2026 (later): Admin → Payouts; Cooler Box a flat 2.5%
- **Payouts tab** on the admin dashboard (next to Reports). Pick Yesterday, Today so far, Last 7 days or any date to see who is owed what for delivered orders:
  - **Drivers (paid daily at 12:00):** 100% of delivery, surge and priority fees, less any cash they collected on cash orders. A red amount means the driver owes Ekoyini.
  - **Taverns:** the partner taverns sell the alcohol, so each tavern gets the item price less Ekoyini's markup (7% beer, cider, RTD and wine; 5% spirits, liqueurs and mixers) plus the bottles & crates charge.
  - **Ekoyini** keeps the rest and carries the Cooler Box, promo and Yoco card costs. Tiles show sales, driver pay, tavern pay, estimated Yoco fees, Ekoyini's share and cash held by drivers.
  - **Copy list** gives a ready-to-paste list for the banking app. **Mark as paid** (super admins) records each payment once, logs it in Activity, and has an undo.
- **12:00 email:** yesterday's payout summary goes to the order-alert emails once a day. On Render's free plan it arrives on the first wake-up after 12:00.
- **Database (founder approved):** migration `20261111120000_add_payouts` adds `Order.deliveredAt` (set on delivery; older delivered orders get their last update time) and the `Payout` and `PayoutEmail` tables (row level security on).
- **Cooler Box is now a flat 2.5% from R2000** (founder; the 3.5% tier is gone, it could lose money on spirits paid by card).
- New `lib/payouts.js` with `test/payouts.test.js` (4 tests). Cache `ekoyini-shell-v20`. Tests: 87. Scenarios 25/26.

### 11 Nov 2026 (later): separate WhatsApp buttons for the tavern and the driver
- The one "Send WhatsApp to Tavern & Driver" button tried to open two WhatsApp chats at once. Phones only open the first, so the dispatcher only ever saw the tavern's "please prepare this order" message. It is now two buttons on the order card: **1. WhatsApp tavern (prepare)** and **2. WhatsApp driver (collect & deliver)**.
- The tavern message now shows only what to pack and who collects it (driver name and car). No customer address and no total (POPIA). The driver message is unchanged: pickup, address, landmark, pin, tracking link.
- `admin-api.js` loads with a version tag so dispatchers get the new buttons straight away. Tests: 83.

### 11 Nov 2026 (later): 14 new products from the Shoprite shelf, with photos
- **Brandy:** KWV 3 Year R230.99, KWV 5 Year R262.49, KWV 10 Year R482.99, KWV 15 Year R1049.99, Richelieu International R246.74, Olof Bergh Solera R220.49.
- **Whisky:** Redbreast 12 R1679.99, The Glenlivet 15 R1364.99, Maker's Mark R545.99. **Tequila:** Espolon Reposado R650.99. **Champagne:** G.H. Mumm Grand Cordon R909.49.
- **Beer six-packs:** Miller Genuine Draft 6 x 330ml R117.69; Castle Double Malt and Castle Lite Draught 6 x 500ml cans R130 (the can floor).
- Prices are the Shoprite regular price + 5% (spirits) or 7% (beer, champagne). Photos were cut from the founder's screenshots and normalised like the rest (`public/images/brands/*.webp`). Castle Lite Draught has no photo yet (the screenshot's age badge covers the pack).
- Catalogue: 344 products. Deploy rehearsed on a copy (330 -> 344). Cache `ekoyini-shell-v19`. Tests: 83.

### 11 Nov 2026: changes now go live without pull requests
- Founder decision: tested changes are pushed straight to the live branch. Every push still runs all tests first (a failing test stops the deploy), gets a changelog entry and a Render check.

### 11 Nov 2026 (later): beer & spirit prices from the Shoprite shelf (only increases)
- Founder rule: always the highest regular shelf price, then 7% (beer) / 5% (spirits). Promotions are never used. A Shoprite price that is lower than ours is ignored, and founder-fixed prices stay as they are (Hennessy VS, Klipdrift Export, Jameson, Heineken dumpies, Castle Lite and Black Label cans).
- 25 prices go up, none go down. Beer six-packs: Black Label, Castle Milk Stout, Hansa, Sol and Stella 330ml; Heineken 500ml cans R139.09. Spirits: Scottish Leader R325.49, Viceroy R236.24, Bisquit VS R682.49, Courvoisier VSOP R997.49, Martell VS R608.99, Inverroche Amber R566.99, Cruz R367.49, Frangelico R346.49, Southern Comfort R209.99, Wild Africa Cream R178.49, and the Butlers liqueur range R241.49.
- Honor VS is unchanged: Shoprite's R599.99 is the Honor VS Gold Edition, a different bottle. Tests: 83.

### 11 Nov 2026 (later): cider & RTD pack sizes and prices from the Shoprite shelf
- From the founder's Shoprite Ziyabuya screenshots: pack sizes corrected and renamed in place (same product id, order history kept). Strongbow, Smirnoff Storm, Belgravia, Redd's MXD and Chillers Punch cans are 440ml; Hunter's Iced cans are 500ml; Brutal Fruit and Extreme bottles are 275ml.
- **New:** Redd's Original and Redd's Berry 660ml quarts (R26.74; returnable, so the bottle & crate charge applies). No photo yet. Catalogue is now 330 products.
- Founder rule checked: no price went down in this batch. Bernini 6 x 275ml stays at R117.69 (higher price on file R109.99, not Shoprite's R104.99); a test now guards it.
- Prices updated to the Shoprite shelf + 7% (for example Strongbow 6 x 440ml R139.09, Smirnoff Storm 6 x 440ml R155.14, Ice Tropez 6 x 275ml R524.29, Chillers Punch 6 x 440ml R165.84). The R130 can six-pack floor still applies. Strongbow quart stays at R32.10 (highest verified retail on file, R30).
- The deploy renames rows in `scripts/ensure-schema.js` before the seed runs. Tested on a copy of the live catalogue (328 -> 330, no duplicates). Tests: 82. Scenarios: 25/26.

### 11 Nov 2026 (later): one discount only, at half our markup
- **Founder rule:** a discount may never be more than half of our markup (5% / 7%), and discounts never stack.
- **Cooler Box halved:** 2.5% from R2000 and 3.5% from R4000 (was 5% / 8%), still only 04:00-20:00. Pages show the numbers from `public/pricing.js` through the new `pctLabel()` helper (so 2.5% never shows as "3%").
- **Case discount removed:** a case now costs its single price times the number in the case (`CASE_DISCOUNT_PCT = 0` in `lib/catalogue-2026-11.js`). The deploy price step sets `retailCaseDiscountPct` to 0 and recalculates `retailCaseZAR` on all 328 products (checked on a local copy). Cart and checkout no longer offer "Full cases" when there is no saving.
- Promo codes are unchanged (admin-created, still apply on top of the Cooler Box).
- Service worker cache bumped to `ekoyini-shell-v18`. Tests: 82. Staged scenarios: 25/26.

### 11 Nov 2026 (later): legal pages filled in; trading hours follow the partner taverns
- `privacy.html` and `terms.html` have no placeholders left: Ekoyini Holdings, 7 Torquay Street, Summerstrand, Gqeberha; contact support@ekoyini.co.za and WhatsApp 064 004 5465; refunds within 7 business days.
- The Information Officer is named by role ("the head of Ekoyini Holdings"), not by person. The founder asked that his personal details stay off the app (safety).
- Trading hours (founder): orders follow the licensed trading hours of the partner tavern that supplies them. An order placed outside those hours is held for the next opening, or cancelled and refunded on request.
- Service worker cache bumped to `ekoyini-shell-v17`.

### 11 Nov 2026: order without a GPS pin; order emails live
- **No-pin checkout:** a customer who can't or won't share their location can still order. They pay the base delivery fee (R40, plus any load fee) and must give a landmark (3+ letters) so the driver can find them. The rule is `noPinProblem()` in `public/pricing.js`, used by checkout and the server. The admin order card shows "No GPS pin: call the customer to confirm the distance" in orange.
- **Emails:** ekoyini.co.za verified in Resend (DKIM + SPF on Domains.co.za). Render has a new send-only `RESEND_API_KEY` and `RESEND_FROM_EMAIL=Ekoyini <orders@ekoyini.co.za>`. Test email delivered. Mailboxes admin@, orders@, support@ created (Domains.co.za Email Only 10).
- Service worker cache bumped to `ekoyini-shell-v16`. Tests: 81. Staged scenarios: 25/26 (new 2.5b; 6.3 needs Render's real proxy).

### 10 Nov 2026 (late): full launch-readiness diagnosis
- `MARKET_READINESS.md` rewritten: software about 95% ready, launch overall about 70%. Six blockers: order emails not sending (`RESEND_API_KEY` missing on Render), checkout needs a GPS pin (no fallback), trading hours not enforced, legal-page placeholders, no order ever delivered or paid by card, licence position to confirm.
- Staged scenarios updated for the 10 Nov rules (customer pin, 328 products, bottles & crates): 24/25 pass (6.3 needs Render's real proxy). Tests: 80.

### 10 Nov 2026 (night): shop aisle cards show real products (sponsor-ready)
- The four shop aisle banners (Beer & Cider, Spirits, Wine & Bubbly, Mixers & Essentials) used stock photos. They are now rounded cards in their own colour with a white plate bottom-right showing three real products (Castle Lite, Black Label quart, Savanna; Hennessy, Johnnie Walker Black, Klipdrift; 4th Street, Moët, JC Le Roux; Red Bull, Coca-Cola, Appletiser), a "Shop now" button that jumps to the aisle, and swipe/dots as before.
- **Sponsor-ready:** each aisle's `featured` block in `AISLES` (shop.html) holds its label, product photos and an optional search link, so a brand partner (SAB, Distell/Heineken, Pernod Ricard, Diageo) can take an aisle by editing one block. Cloudflare Web Analytics (live) gives the visitor numbers for those talks.
- Fixed: the "Cooler Box" title on the shop's Cooler Box card was white on white.
- New trimmed banner photos in `public/images/promo/`. Service worker cache `ekoyini-shell-v15`.

### 10 Nov 2026 (night): product sheet in the shop, photo summary in checkout
- **Shop product sheet:** tap a drink's photo or name to open it big, with every pack of that drink side by side (e.g. Black Label: 6 cans, 6 dumpies, quart), each with its price and how many are already in your cart. Pick a pack, set the quantity, "Add to cart · R282.36". Notes explain six-packs, returnable bottles and crates, the case price, the Cooler Box and the Safety Seal where they apply.
- **Checkout:** a "Your order · 15 items" card at the top with product photos (tap to edit in the cart); the review lists each item with its photo and pack.
- **Load fee in whole rands**, so a few grams over 20 kg no longer shows "Heavy load R0.38".
- Checked in a phone-sized browser against a local copy: sheet opens, pack switch, 12 quarts added in one tap, checkout summary and review render. Service worker cache `ekoyini-shell-v14`. Tests: 80.

### 10 Nov 2026 (evening): bottles & crates on returnable quarts
**Database change (founder approved):** new column `Order.bottleDepositFee` (migration `20261110120000_add_bottle_deposit_fee`, adds one column only).
- Our ride-along driver makes one trip and can't take empties back, so returnable quarts carry a bottle charge. Founder rules: **R52 per crate of 12** (R2 a bottle + R28 crate) or **R3 a bottle loose**; bottles that don't fill a crate are R3 each. 12 quarts in a crate R52, loose R36; 6 quarts R18; 18 quarts in a crate R70.
- Returnable: Black Label, Castle Lager, Castle Lite, Castle Milk Stout, Hansa, Lion, Windhoek Lager and Draught, Flying Fish, Redd's MXD and Strongbow quarts. Not returnable: Amstel, Corona, Heineken, Sol, Stella and Hunter's quarts, and every can, dumpy, NRB and spirit.
- Checkout shows a **Bottles & crates** step when there are returnable quarts ("In a crate" or "No crate, loose" once there are 12 or more), and a separate bill line. The cart estimate assumes a crate. The admin order card and the orders CSV show it. Never discounted by the Cooler Box or a promo.
- Rule in `public/pricing.js` (`isReturnableQuart`, `bottleDepositFor`), charged by the server (`validateAndPriceOrder`) and included in the Yoco amount. Tests: 80.

### 10 Nov 2026 (evening): every product photo the same size
- Founder: "make sure items are similar sizes, some items seem tiny". Product photos came from many shops: the product filled anything from 56% to 100% of its photo, so a Breezer dumpy looked half the size of a Klipdrift. `scripts/normalize-photos.js` (run by hand, not on deploy) trimmed the white border of all 321 photos and centred each product on a 480px white square at 88% of the frame. Same file names and formats, so the photo map, database and tests are unchanged; total size stays about 8.5 MB.
- Shop tiles show photos larger (less padding) and the home rails and category tiles use 94% / 92% of the tile. Service worker cache `ekoyini-shell-v13`.

### 10 Nov 2026 (later): the 16 partner taverns are the dark stores
- The founder's 16 taverns, with Google Maps pins, are created by `prisma/seed.js` on deploy (only when missing, so a location corrected later in Admin → Delivery is kept): Oom Cola's Place (Gqalane), Mabaso, Skwerini NU2, Coke's Tavern, Zwide Liquor Stores, One Way Bottle Store, KwaLifa and Mafa, Monde's Lounge, KwaNceba, KwaMagxaki Butchery, Maleidini, Skwerini (Wells Estate), KwaMasinga, Ekupholeni Cocktail Lounge, Barbara's Lounge and KwaSiba. Endaweni (closed) and TigersMilk are left out.
- The five made-up sample taverns from the first setup are removed (only if no order was ever assigned to one).
- Delivery distance is now measured to the nearest of these, and checkout asks customers to pin their location. Rehearsed locally: a Zwide customer matches Zwide Liquor Stores at 0.4 km (R40); a central Gqeberha customer matches KwaNceba at 7 km (R64.18).

### 10 Nov 2026 (later): delivery base back to R40
- Founder: the delivery base starts at R40. Now R40 covers the first 3 km, then R6 a km (5 km R52, 10 km R82). Load fee, Care & Handling and Cooler Box unchanged. Tests updated.

### 10 Nov 2026: delivery priced by distance AND load, lower Care & Handling, Cooler Box from R2000
Founder: 96 quarts (8 crates) paid the same R40 delivery as one six-pack, while Care & Handling went up. Fixed in `public/pricing.js` (shared by cart, checkout and server):
- **Distance, like the delivery apps:** R35 covers the first 3 km to the nearest dark store, then R6 a km. No more R40/R55/R75 jumps.
- **Load:** every product has an estimated weight from its pack (quart about 1.25 kg, six-pack of cans about 3.1 kg, 2 kg ice = 2 kg). Orders over 20 kg pay R1.50 a kg above 20 kg, 100% to the driver. The founder's 96 quarts are about 120 kg, so R150. A normal cooler box (a few six-packs, a bottle, ice) pays nothing extra. The server weighs the order from the real catalogue (`orderWeightKg`), never from what the browser sends. The load fee rides inside `Order.deliveryFee` (no database change); cart and checkout show it as its own "Heavy load (about N kg)" line.
- **Care & Handling:** 3% of the items, minimum R10, maximum R40 (was 5%, R15–R75).
- **Cooler Box:** 5% from R2000, 8% from R4000 (was R1000 / R2000), still 04:00–20:00. All page wording reads the numbers from `pricing.js`.
- **Dark stores:** admin Delivery tab has a new "Add a tavern / dark store" form (name, area, phone, location pasted from Google Maps as "-33.87, 25.56"; super admin, logged). Delivery distance is measured to the nearest one with a location; once one has a location, customers are asked to pin theirs at checkout.
- **Ice Tropez** six-pack (6 x 275ml) added at R401.24 (Shoprite R374.99 + 7%). No photo yet (retailer photos are not reachable from here; founder to send a single-bottle photo). Catalogue is 328 rows.
- **Home banners:** bottles are much bigger (trimmed banner copies in `public/images/promo/`), the Cooler Box banner shows Corona instead of Black Label, and the Black-owned banner adds Kwande Gin. Service worker cache `ekoyini-shell-v11`.
- Tests: 77 (new distance and load tests; fee and Cooler Box tests updated). Rehearsed against a local copy: 96 quarts quote R35 + R150 load + R40 care; a pin 6 km from a dark store adds R18; fake items sent to the quote endpoint weigh nothing.

### 9 Nov 2026 (night): a new home screen, built like a top-tier delivery app
Founder: "nothing wow… I still don't feel like this is a top tier app." The old home page was a long brochure (8 phone screens, about 7,000px) with no products on it, so it took two taps to see anything to buy. The new home (`public/index.html` + `public/home-app.css`) works like Uber Eats, Sixty60 and Bolt Food:
- **Top:** "Deliver to" address chip (tap to change) and a live greeting with the 20–45 min after pickup promise; a big search bar.
- **Deals carousel** (swipe): Cooler Box (5%/8% with a live countdown to 8pm, or "back at 4am"), the R10 spirits Safety Seal, and Black-owned brands. Real product photos.
- **Live Cooler Box card:** reads the real cart and says exactly how much more unlocks 5% or 8%.
- **Shop by category:** 14 photo tiles (beer, ciders, whisky, brandy, cognac, gin, vodka, tequila, liqueurs, wine, bubbly, cold drinks, energy, water & ice).
- **Popular right now** and **Top shelf** rails: real products, prices and pack sizes from `/api/products`, with a one-tap **+** that turns into a − 1 + stepper. Picked from the founder's Siba fast movers.
- **Floating "View cart" bar** with item count and total, like the shop.
- Occasion packs, brands with a story, "Why Ekoyini" (20–45 min after pickup, live tracking, Safety Seal + ID check, pay your way), a 3-line "How it works", the 18+ note and the footer.
- Removed: the long ride-along explainer, the animated example cooler, the taverns list and the closing banner (the shared-stock model means customers don't pick a tavern).
- Onboarding, age gate, install prompt and bottom nav are unchanged. Page is about 3,100px on a phone (was about 7,000px). Checked on a phone-sized and a desktop browser against a local copy of the deploy: no page errors, no sideways scroll, add-to-cart and the Cooler Box card work.
- Service worker cache `ekoyini-shell-v10`.

### 9 Nov 2026 (evening, fix): Monin syrups back to R230.99
- The R85 Monin price was a misreading. The founder: Monin syrups are expensive and must all be R230 or more. Override removed; they are back at R230.99 (shelf R219.99 + 5%). A test now keeps every Monin syrup at R230 or more.
- The Siba receipts of 4 Sep and 5 Nov 2026 (the ones behind the 6 Nov receipt calibration) are checked again: every item is at or above its Siba cost. Ten more items added to the never-below-Siba test (Amarula, Bug Booster, Gordons, Klipdrift Premium, KWV 12, Skyy, Corona dumpies, Extreme dumpies, Heineken dumpies, Robertson Chapel Dry Red 1.5L).

### 9 Nov 2026 (later): a sensible shop and SKU order
Founder: "currently there's no order in the SKU list or shop".
- **One shelf order** in `public/shelf-order.js`, shared by the shop, `/api/products` and the admin stock list. Sections: Beer → Cider & RTDs → Brandy → Whisky → Cognac → Gin → Vodka → Premium Vodka → Rum → Tequila → Premium Tequila → Liqueurs → Wine → Boxed Wine → Sparkling → Champagne → Mixers & Cold Drinks → Energy Drinks → Water & Ice. Brands stay together; packs run can → dumpy → NRB → quart → bottle; sold-out items go last in the shop.
- **Water and ice are one section** ("Water & Ice": still water, sparkling water, then ice).
- **Mixers & Cold Drinks**: cold drinks first (Appletiser, Coke, Liqui Fruit, Schweppes), then cordials, Monin syrups, then bitters and cherries.
- **Moved:** Ponchos Tequila Coffee from Liqueurs to Tequila (next to the other Ponchos); Mofaya Original and Orange Ting from Mixers to Energy Drinks (with Red Bull). Extreme stays in Cider & RTDs (it is alcoholic).
- **Fixed flags:** Grenadine and Kola Tonic cordials were marked alcoholic; now non-alcoholic.
- ~~Monin syrups R85~~ (reverted, see the fix entry above).
- **Bonaqua Still 500ml photo**: the founder's single-bottle photo (from I-Camagu, `bonaqua-still-500ml.webp`, 3 KB) replaces a 24-bottle case photo; water is sold one bottle at a time.
- Rum and Energy Drinks had no aisle in the shop banner; now under Spirits and Mixers & Essentials.
- Service worker cache `ekoyini-shell-v9`. Tests: 75 (new `test/shelf-order.test.js`). Checked in a phone-sized browser against a local copy of the deploy.

### 9 Nov 2026 (late night): founder prices, R130 can floor, six-packs only
Founder decisions after comparing the app with his Siba receipts. New file `lib/founder-prices-2026-11-09.js`: final prices that win over every other list (`finalPriceFor` checks it first).
- **Fixed prices:** Heineken dumpies 6-pack R145 (was R117.70), Castle Lite and Black Label cans 6-pack R130, Savanna Dry 500ml NRB **six-pack** R210 (was a single bottle), Appletiser 1L R45, Red Bull **single 250ml can** R30 (was a 355ml six-pack), Coca-Cola **500ml can** R20 (new product, single).
- **R130 minimum for alcoholic can six-packs.** Corona and Savanna keep their own prices (the founder's exceptions); mixers and cold drinks are not covered. Raised: Lion, Castle Lager, Hansa, Milk Stout, Amstel, Budweiser, Sol, Stella, Windhoek, Heineken, Smirnoff Storm, Redd's, Strongbow, Hunter's, Flying Fish Chill and Belgravia cans.
- **Strategic spirits at Siba cost + 14%** (instead of 15–28%): Jägermeister R410.40, Ponchos Coffee R364.80, Jameson R478.80, Jameson Select R684, Olmeca Reposado R399.
- **What is sold as a six-pack:** beer, cider and RTD cans, dumpies and 500ml NRBs. Cold drinks, energy drinks, water and ice are sold loose (Mofaya and Schweppes cans keep their six-packs). Rule in `packSizeFor()`, used by the seed.
- **Database (no Prisma migration):** `ensure-schema.js` renames the Red Bull row from `Can (355ml)` to `Can (250ml)` in place (same id, order history kept) and no longer turns loose cold-drink cans into six-packs. Catalogue is now 327 rows (322 workbook + 5 house products). Rehearsed on a local copy: deploying twice gives the same result.
- Tests: 70 (new `test/founder-prices.test.js`).

### 9 Nov 2026 (night): never sell below the Siba stock price
The founder's Siba receipts (27 Sep and 9 Nov) show what stock costs. Six rows were priced below cost and are raised to the Siba price + 7%:

| Product | Siba cost | Was | Now |
|---|---|---|---|
| Breezer Blackberry / Watermelon cans 6-pack | R150 | R128.39 | R160.50 |
| Breezer Blueberry cans 6-pack (same family) | R150 | R128.39 | R160.50 |
| Castle Lite cans 6-pack | R115 | R112.35 | R123.05 |
| Black Label cans 6-pack | R115 | R112.34 | R123.05 |
| Savanna Dry 500ml NRB (each) | R27.50 | R26.74 | R29.43 |

- New test: 20 receipt items (beer, RTD, spirits, water) can never be priced below their Siba cost.
- Most other receipt items were already Siba price + 5%/7% exactly (Bernini, Brutal Fruit, Sol, Stella, Hennessy VS, Tanqueray, Aquelle).

### 9 Nov 2026 (evening): ice bag photos
- Founder's photos: Ice Bag 1kg (R20) = blue bag, Ice Bag 2kg (R35) = plain white bag. 1kg file renamed to `ice-bag-1kg-blue.jpg`; 2kg now `ice-bag-2kg-white.jpg` (was a branded "ICE" print bag). Prices unchanged.

### 9 Nov 2026 (evening): prices always use the HIGHEST retail price
Founder rule restated: every price starts from the highest regular retail price of the same pack, never a crate/case divided down and never a promotion. 10 rows from the 8 Nov correction broke it and are raised (shelf base, then 5% or 7%):

| Product | Was | Now | Base now |
|---|---|---|---|
| Hennessy VSOP | R1,038.45 | R1,144.50 | R1,090 (was a bulk-case R989) |
| Hendrick's Gin | R472.50 | R628.95 | R599 |
| Jägermeister | R309.75 | R440.99 | R419.99 |
| Jameson Original | R419.99 | R477.75 | R455 |
| Jameson Select Reserve | R619.49 | R693.00 | R660 |
| Ponchos Tequila Coffee | R336.00 | R409.49 | R389.99 |
| Klipdrift Premium | R293.99 | R304.49 | R289.99 |
| Heineken quart | R29.95 | R32.09 | R29.99 |
| Amstel quart | R23.19 | R25.67 | R23.99 single (was crate / 12) |
| Black Label quart | R23.19 | R23.53 | R21.99 single (was crate / 12) |

- Two new tests: a correction can never sit below a verified retail price already on file, and premium brands can never be cheaper than the value brands below them (Courvoisier VS ≥ Honor VS, Hennessy VSOP ≥ VS, JW Black ≥ Red, and more).
- Review sheet `prisma/data/price-corrections-2026-11-08.csv` updated. 133 rows are still shelf estimates worth checking.

### 9 Nov 2026 (evening): Castle Lite photos fixed
- The Castle Lite quart and dumpy photos were swapped: the quart showed a short-neck dumpy and the dumpy showed the tall 660ml quart.
- Files renamed to say what they show: `castle-lite-quart-660ml.jpg` (was `castle-lite-dumpy-330ml.jpg`) and `castle-lite-dumpy.png` (was the junk-named `Castlelite340Mldumpies1.png`). `FORMAT_PHOTO_MAP` updated; the deploy's photo sync updates the live products. Can photo unchanged.
- Render settings set today (no code): `CF_ANALYTICS_TOKEN`, `MARKETING_LINK_SECRET`, `ORDER_ALERT_EMAILS`, `RESEND_FROM_EMAIL` (Ekoyini &lt;admin@ekoyini.co.za&gt;); `RESEND_API_KEY` added by the founder.

### 9 Nov 2026 (night): marketing opt-in, sales reports, visitor analytics
**Database change:** new table `MarketingConsent` (migration `20261109120000_add_marketing_consent`, only adds a table). It is locked away from the public Supabase roles by the deploy lock-down like every other table.
- **Marketing opt-in (POPIA s69):**
  - "Send me specials" boxes at sign-up and checkout, unticked by default.
  - A **Specials on WhatsApp & email** switch on the profile page.
  - Each choice is saved with date and source, and opting out keeps the record as proof.
  - An order without the field never changes an existing choice.
  - **Unsubscribe links:** `/unsubscribe.html?u=…&t=…` is signed per customer (`MARKETING_LINK_SECRET`) and needs a button press, so link scanners can't unsubscribe people.
- **Admin → Reports tab:**
  - Sales, orders, average order, repeat-customer rate, opt-in count, best sellers, top areas, orders by day, busiest hours (SA time) and payment mix, for 7 / 30 / 90 days or 12 months.
  - Paid and cash orders only; unpaid EFT and cancelled orders are counted separately.
- **Downloads (super admins only, each one written to the Activity log):**
  - **Marketing list:** opted-in customers only, with orders, spend, last order and an unsubscribe link.
  - **Orders CSV:** areas only, no street addresses.
  - Cells are protected against spreadsheet formula injection. Dispatchers can see reports but can't download.
- **Visitor analytics:** customer pages load `/analytics.js`, which turns on Cloudflare Web Analytics only when `CF_ANALYTICS_TOKEN` is set on Render (free, no cookies, no personal data). The admin and driver pages are never tracked.
- **Fixes and housekeeping:**
  - The "Turn on order alerts" button is readable on desktop.
  - `TRUST_PROXY_HOPS=3` is set on Render (from the live `[proxy]` logs).
  - Service-worker cache `v8`.
  - Tests: 62.

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
