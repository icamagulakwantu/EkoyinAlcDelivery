# Staged scenarios (pre-release check)

24 end-to-end scenarios that drive the real server over HTTP: catalogue, pricing
integrity, promo codes, card / EFT / cash payments, stock races, the full
admin → driver → customer order lifecycle, security and resilience. Run them
before every release. They need a **local** database; never point them at the
live Supabase project (they create orders and change stock).

Not in `test/` on purpose: `node --test` (run on every Render deploy) runs every
file under `test/`, and these need a database and two stand-in services.

```bash
# 1. A throwaway local Postgres, migrated and seeded
export DATABASE_URL="postgresql://postgres@localhost:5432/eko_staging"
node scripts/migrate.js && node prisma/seed.js
APPLY_CATALOGUE_PRICES_ON_DEPLOY=true node scripts/run-catalogue-prices.js

# 2. Stand-ins for Yoco (port 4010) and Supabase login (port 54321)
node staging/mock-yoco.js & node staging/mock-supabase.js &

# 3. The app, pointed at the stand-ins
SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=x ADMIN_API_TOKEN=ekoyini-staging-admin-token-0123456789abcdef \
YOCO_SECRET_KEY=sk_test_x YOCO_WEBHOOK_SECRET=whsec_dGVzdHNlY3JldA== \
YOCO_API_BASE=http://localhost:4010/api APP_BASE_URL=http://localhost:3000 \
PORT=3000 node server.js &

# 4. Run (results also saved to staging/results.json)
STAGING_DATABASE_URL="$DATABASE_URL" node staging/scenarios.js
```

Expected today: 24/25 pass. 6.3 (rate limits vs a faked X-Forwarded-For)
passes only once `TRUST_PROXY_HOPS` is set; see MARKET_READINESS.md.
