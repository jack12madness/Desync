# Desync — Product Requirements & Status

## Original problem statement
Full-stack storefront "Desync" for FiveM game-cheat products (future: other games). No buyer accounts — email collected at checkout; paid orders deliver stocked license keys by email. Staff manage products, key inventory, coupons, waitlist, launch details, reporting. Visual style: clean dark-blue GTA-inspired, exact user-supplied character art must be preserved.

## Architecture
- React frontend (port 3000), FastAPI backend (port 8001, /api prefix), MongoDB via MONGO_URL/DB_NAME
- Auth: custom JWT username/password admin auth (owner: voidowner; second owner: jack) — see test_credentials.md
- Payments: Stripe checkout + webhook fulfillment (test sandbox). PayPal code KEPT but UI hidden (SHOW_PAYPAL=false in CartDrawer.jsx)
- Email: Emergent-managed Resend (order keys, waitlist confirm, low-stock alerts, announcements)
- Key stock: per product + duration (day/week/month/lifetime); fulfillment assigns stocked key or marks keys_pending

## What's implemented (latest first)

### 2026-09-03 — Per-product loader files
- Admins attach a loader (.exe/.zip, max 150MB) per product in the product create/edit form; replace or remove supported. Files live in Emergent object storage (desync/loaders/...), metadata on product doc
- Buyers get a secure per-order download link (order download_token, works forever for paid orders): on payment success page, in My Orders, and as a button in the order email (replaced old "Discord #downloads" setup text)
- Download endpoint: GET /api/orders/{order_id}/loader/{product_id}?token=... — validates paid order + token (403 otherwise) + item in order; streams with attachment filename. Public products list exposes only has_loader (storage path hidden)
- Endpoints: POST/DELETE /api/admin/products/{id}/loader; orders get download_token at creation, older orders lazily backfilled
- Verified: upload .exe ok, .txt rejected 400, download bytes match with valid token, 403 wrong token, My Orders shows button, admin form shows current loader; 9/9 regression tests pass

### 2026-09-02 — TOS checkbox, Privacy Policy, admin tab cleanup
- Cart now requires agreeing to Terms of Service + Privacy Policy (checkbox, links to /terms and /privacy) before the Pay button enables; toast error if skipped
- New Privacy Policy page at /privacy (13 sections, Australian privacy law, footer link)
- Launch and Waitlist admin tabs removed (files deleted); admin tabs now: Products, Categories, Orders, Coupons, Staff. Backend waitlist endpoints remain but unused by UI
- Note: SalesStats shows a "Deleted product" row for historical orders of removed products (cosmetic, admin-only)

### 2026-09-02 — TOS page, Next Drop removed
- New Terms of Service page at /terms (19 sections, linked in footer; dates filled 2 September 2026, Queensland/Australia, EUR, delync.gg@hotmail.com)
- Next Drop page removed: /drop route gone, nav + footer links removed, DropPage.jsx deleted. Backend waitlist endpoints + admin Waitlist/Launch tabs still exist (now have no public page)

### 2026-09-02 — Coupons, Categories, Sold-out, PayPal hidden
- DESYNC10 coupon: 10% sitewide, only active code (old 5% deleted). Hero chip + cart placeholder updated
- Categories: `categories` collection; public GET /api/categories; admin create/delete (delete blocked when products assigned); admin Categories tab; product form "Game" field is now a category dropdown
- Hero "Games" stat is dynamic = total categories; hero badge lists category names
- Data migration (/app/scripts/migrate_categories.py): deleted all non-FiveM products (2 remain), created "FiveM" category; SEED_PRODUCTS trimmed to FiveM only
- Sold-out: GET /api/products includes per-duration `stock` map; card shows Sold Out badge + dims image; modal disables buying; checkout returns 400 for empty pools
- PayPal hidden in cart UI (code/endpoints kept intentionally)
- Tests: /app/backend/tests/test_desync_features.py (9/9 pass); report /app/test_reports/iteration_1.json

### Earlier
- Stripe checkout + webhook fulfillment end-to-end; PayPal sandbox create/capture (hidden now)
- Coupons system (create/validate/toggle/delete, Stripe discount, usage counts)
- Waitlist + CSV export + launch announcement emails; drop page countdown
- KeyManager per-duration stock, pending-key assignment + re-email
- SalesStats reporting; Launch tab settings; staff management (owner-only)
- Rebrand VOIDWARE -> Desync; logo.svg; Discord pack in /app/assets/discord-pack
- Hero uses upscaled user-supplied crew art (/app/frontend/public/images/hero-crew.png); drop page has NO character cutout (user rejected it)
- Fake reviews removed; Discord links = https://discord.gg/GapTZMAY7v
- Production Cloudflare 520 on login: fixed via path/dotenv hardening + redeploy; user confirmed resolved

## Backlog
- P0: await user confirmation of latest hero image quality + this batch; deploy to production if user asks (deployments need explicit consent; last deploy completion unverified)
- P1: PayPal live credentials + re-enable (SHOW_PAYPAL=true) when user wants it
- P1: own-domain sender (needs user's verified Resend domain/key)
- P2: order search/filters; giveaway/single-use code batches; consider server-side gating of /api/paypal/* while hidden

## Known cautions
- Never regenerate/alter hero characters — user demands exact supplied art
- insert_one mutates docs with _id — strip before returning
- Careful editing email_utils.py (waitlist fn clipped twice historically)
