# Ekoyini — Quickstart

Get the app running locally in a few minutes.

## 1. Prerequisites

- Node.js 18+ (needed for the built-in `fetch` used to verify Supabase tokens)
- A [Supabase](https://supabase.com) project (free tier is fine) — gives you Postgres + Auth in one place

## 2. Clone & install

```bash
git clone <this-repo-url>
cd ekoyini-webapp
npm install
```

`npm install` also runs `prisma generate` automatically (via `postinstall`).

## 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Supabase dashboard → Project Settings → Database → Connection string (URI). Locally this can be the direct connection; if you deploy to a host without outbound IPv6 (e.g. Render), use the **Session pooler** string instead — see `DEPLOYMENT.md`. |
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → `anon` `public` key |
| `ADMIN_API_TOKEN` | Make up a long random string yourself |
| `RESEND_API_KEY` | Optional — leave blank until Phase 2 email is wired up |

Also open `public/auth.js` and replace the two placeholder constants at the
top (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) with the same values — the
frontend needs them directly since it talks to Supabase Auth from the
browser. These are the public **anon** key, safe to expose client-side.

## 4. Push the schema and seed the database

```bash
npx prisma db push
npm run seed
```

This creates the tables and loads all 264 SKUs (257 alcohol + 7 water/ice)
plus 5 taverns.

## 5. Start the server

```bash
npm start
```

The app is now at `http://localhost:3000`. The admin dashboard is at
`http://localhost:3000/admin/admin.html`.

## 6. Try it out

1. Visit `/signup.html`, create an account (Supabase Auth — check your email
   if confirmation is required by your project's settings).
2. Browse `/shop.html`, add a few dumpies/spirits to build up a Cooler Box
   discount, add to cart.
3. Checkout — age gate, delivery details, place the order.
4. Copy the order code from the confirmation screen and look it up at
   `/track.html`.
5. Open `/admin/admin.html`, enter the PIN (default `2025`, see
   `admin/admin-api.js`), the OTP flow will open a WhatsApp link to the
   founder number — and enter your `ADMIN_API_TOKEN` when prompted. Assign
   the order to a tavern + driver, then dispatch it.

See `DEPLOYMENT.md` for pushing this to Render, and `LAUNCH_CHECKLIST.md`
before taking real orders.
