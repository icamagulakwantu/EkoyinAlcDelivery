# Ekoyini — Deployment (Render + Supabase)

## 1. Push to your Git remote

```bash
git add .
git commit -m "Deploy"
git push origin main
```

## ⚠️ Important: use Supabase's connection pooler, not the direct connection

Supabase's **direct** database connection (`db.<project-ref>.supabase.co:5432`,
the one shown by default under Project Settings → Database) is **IPv6-only**.
Render's network does **not** support outbound IPv6, so a `DATABASE_URL`
pointing at the direct host fails with:

```
PrismaClientInitializationError: Can't reach database server at
`db.<project-ref>.supabase.co:5432`
```

Use the **Session pooler** connection string instead — same dashboard page,
under "Connection pooling" — which is IPv4-compatible:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Note the username changes to `postgres.<project-ref>` (not just `postgres`)
and the host becomes the regional pooler. Session pooler mode (port 5432)
behaves like a normal Postgres connection and also works for migrations.
Do not use the transaction pooler (port 6543) for migrations.

## 2. Create the Render web service

The real database is **Supabase**. `render.yaml` describes only the web
service; it no longer creates a Render Postgres database (the free one
expires after about 30 days).

- **New → Web Service** (or Blueprint), connect this repo
- **Build Command:** `npm install && npx prisma generate && node scripts/migrate.js && node scripts/optimize-images.js && node prisma/sync-images.js`
- **Start Command:** `node server.js`
- **Health Check Path:** `/api/health`

If you created the service by hand earlier, open Render → Settings → Build
Command and paste the command above. An old command containing
`prisma db push --accept-data-loss` can delete data and must be replaced.

The service is on Render's free plan for now. It sleeps when idle, so a Yoco
payment notice can time out. Move to a paid plan before enabling live card
payments.

### Database changes (migrations)

Every database change is a committed file in `prisma/migrations/`.
`scripts/migrate.js` runs `prisma migrate deploy` on each deploy, which only
applies new files, once each, and never drops data on its own. If it fails,
the deploy stops and the previous version keeps running.

The first deploy after this change marks `0_init` (the database as it
already is) as applied without running it. Nothing in the live database
changes on that deploy.

To add a change: edit `prisma/schema.prisma`, run `npm run migrate:new`
against a development database, review the generated SQL, and commit it.
Never use `prisma db push` against production.

### Lock file

`package-lock.json` is no longer ignored. Run `npm install` once locally and
commit `package-lock.json` so every deploy installs the same versions.

### Environment variables (Render dashboard → Environment)

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **Session pooler** connection string (see above) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `ADMIN_EMAILS` | Comma-separated Supabase Auth emails allowed to use `/admin/admin.html` — the real, per-person admin boundary |
| `ADMIN_API_TOKEN` | A long random string — fallback for scripts/curl and for bootstrapping before any admin account exists |
| `PORT` | Set automatically by Render, no action needed |
| `RESEND_API_KEY` | Optional, order emails |

`npm install` triggers `prisma generate` via the `postinstall` script, and
`render.yaml` also runs `npx prisma generate` explicitly as a safety net.

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
top — make sure these match your production Supabase project. There's no
frontend build step to inject them, so they need to be edited directly.

## 5. Verify

- `GET https://your-app.onrender.com/api/health` → `{"ok":true}`
- `GET https://your-app.onrender.com/api/products` → 264 SKUs
- Deploy log shows `[migrate]` lines and no errors
- Full customer flow: sign up → shop → checkout → track
- Admin dashboard reachable at `/admin/admin.html` — log in with a Supabase
  account whose email is in `ADMIN_EMAILS`

See `LAUNCH_CHECKLIST.md` before sending this URL to real customers.
