# Ekoyini Drinks Delivery: Claude Code handoff (8 Nov 2026)

## 1. What this is
Alcohol delivery app for Gqeberha townships (ride-along delivery). Founder: Thandu (Thanduxolo Makeleni), Ekoyini Group.

Stack: Node/Express 4, Prisma 5, Supabase Postgres, Yoco payments, vanilla HTML/JS in /public and /admin, hosted on Render, domain www.ekoyini.co.za.

## 2. Where everything lives
- Repo: icamagulakwantu/EkoyinAlcDelivery, branch claude/ekoyini-alcohol-delivery-1xnmtz (last known head 1a47e7bf, 8 Nov 06:42 UTC).
- Render: workspace tea-da2vkrflk1mc73f3do20, service ekoyini-api = srv-da5g9rbm8hqs73cjm1hg, FREE plan (cold starts). Build `npm install && npx prisma generate`, start `node server.js`. The dashboard commands override render.yaml.
- Supabase LIVE database: project acmpbftpiwmdzwoxbjxp ("ekoyini-2"). Do NOT write to tvuyimcgspxyiuxwymjr (old stale copy) or czbwwofxbzukpwyvadrh.
- Source of truth for product photos: the founder's other app, repo icamagulakwantu/I-Camagu (live API https://i-camagu.co.za/api/basket/catalogue).
- Live product list: https://www.ekoyini.co.za/api/products.
