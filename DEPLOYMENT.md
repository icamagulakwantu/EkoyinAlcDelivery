# Ekoyini — Deployment (Render)

## 1. Push to your Git remote

```bash
git add .
git commit -m "Deploy"
git push origin main
```

## 2. Create the Render services

`render.yaml` already describes both services (web service + Postgres) —
if your Render account has Blueprint support, just point it at this repo
and it will provision both automatically. Otherwise, by hand:

### Web service

- **New → Web Service**, connect this repo
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Health Check Path:** `/api/health`

### Environment variables (Render dashboard → Environment)

| Variable | Value |
|---|---|
| `DATABASE_URL` | From your Supabase project (or Render Postgres, if you provisioned one instead) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `ADMIN_API_TOKEN` | A long random string — this is the real security boundary for `/orders` and other admin routes |
| `PORT` | Set automatically by Render, no action needed |
| `RESEND_API_KEY` | Optional, Phase 2 |

`npm install` triggers `prisma generate` via the `postinstall` script — this
is what fixed the earlier deploy bug where Render's `NODE_ENV=production`
skipped `devDependencies` and `prisma generate` silently never ran (every DB
call then 500'd). `prisma` now lives in `dependencies`, and `render.yaml`
also runs `npx prisma generate` explicitly as a second safety net.

## 3. Seed the production database

Once deployed, open a shell on the Render service (or run locally against
the production `DATABASE_URL`) and run:

```bash
npm run seed
```

Safe to re-run — it upserts by `(name, bottleFormat)` rather than
duplicating rows.

## 4. Point the frontend at your Supabase project

`public/auth.js` has `SUPABASE_URL` / `SUPABASE_ANON_KEY` constants at the
top — make sure these match your production Supabase project before (or
right after) deploying. They're committed as placeholders; there's no
frontend build step here to inject them from environment variables, so they
need to be edited directly in the file.

## 5. Verify

- `GET https://your-app.onrender.com/api/health` → `{"ok":true}`
- `GET https://your-app.onrender.com/api/products` → 264 SKUs
- Full customer flow: sign up → shop → checkout → track
- Admin dashboard reachable at `/admin/admin.html` with your `ADMIN_API_TOKEN`

See `LAUNCH_CHECKLIST.md` before sending this URL to real customers.
