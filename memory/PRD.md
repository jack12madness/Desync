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

### 2026-09-04 — Steam/Rockstar accounts + collections-first shop
- Account types: ProductIn.account_type (discord|steam|rockstar, shown in account product form with format hints). Steam/Rockstar paste format: email:password (colons in password OK). Delivery/email render only the fields present (dynamic _account_box + ACCOUNT_FIELDS in KeyRow)
- Categories: image_url field (create + inline edit in CategoriesTab); GET /api/categories enriches with product_count, min_price, max_price; PUT /admin/categories/{id} (rename cascades to products)
- Shop redesigned: collections-first — big category cards (photo, COLLECTION tag, price range, product count, arrow) → click shows that category's products with "All collections" back button. Filter pills removed. testids: collection-card-*, collections-grid, back-to-collections
- Verified: steam bulk add (2 ok, colon-password, 1 invalid), steam account delivered end-to-end, category image/count/range, collections UI click-through. 9/9 regression pass


### 2026-09-04 — Discord username at checkout + multi-send
- CheckoutIn.discord_username stored on orders (Stripe/PayPal/bank); cart has required "Discord username" field (buttons disabled + toast until filled, persisted in localStorage); admin orders show "discord: name" per order
- Customers Send-key dialog has "How many to send" qty input (1-100); backend validates stock >= qty, pulls N keys/accounts into one $0 order with deliverables list, email renders all
- Verified: username stored + displayed, qty=2 sends 2 accounts, over-stock rejected 400. 9/9 regression pass


### 2026-09-03 — Bank transfer "payment sent" reservation flow
- Buyer clicks "I have sent the payment" on the bank-pending page → stock instantly reserved (keystock status "reserved" + reserved_order_id), cart cleared, reported state shown. Idempotent (double-click safe)
- Admin orders: "buyer says paid" badge + "Cancel & release stock" button (releases reserved keys back to available, emails buyer "we could not verify your payment")
- Mark-paid consumes the reserved keys first (fallback to available); 48h auto-expiry also releases reserved stock
- KeyManager shows "Reserved · ORDERID" chip on reserved keys
- Verified: stock 1→0 on report, idempotent re-report, restore on cancel, reserved key delivered on mark-paid; UI flow incl. cart clear. 9/9 regression pass


### 2026-09-03 — Account products as first-class type
- ProductIn.kind ("cheat"|"account"); admin Products header has two buttons: Add Cheat (blue) / Add Account (violet)
- Account product form hides Status, Anti-cheat and Loader fields; title "New Discord Account"; min-buy field present
- KeyManager for account products forces accounts paste mode (toggle hidden); pool selector defaults to first priced duration
- Storefront: account cards/modals show violet stock-count badge ("N in stock") instead of detection StatusPill
- Demo product "Aged Discord Accounts" (kind=account, lifetime €2.50, 3 test accounts shop1-3) created in PREVIEW only


### 2026-09-03 — Discord account sales + min-buy quantity
- Stock items can now be Discord accounts: keystock docs carry `account: {email, email_password, discord_password, discord_token}`; bulk paste in KeyManager with "License keys / Discord accounts" mode toggle — format `email:emailpass:discordpass:token` per line (colons in discord password handled; invalid lines + dupes reported)
- Delivery: fulfilled orders carry `deliverables` list; email renders credential blocks (4 fields) or key boxes; My Orders KeyRow shows all deliverables with per-field copy buttons; PaymentSuccess shows account-specific setup steps
- Min-buy / quantity: ProductIn.min_buy (admin product form field); cart auto-adds at min qty with stepper (can't go below min); _price_cart enforces min + stock>=qty, multiplies totals; Stripe line_items quantity=qty; fulfillment assigns qty keys/accounts, partial = key_pending; assign-keys tops up
- Verified: bulk add (3 ok/1 dup/1 invalid), account delivered end-to-end, min-buy 400 below min, qty×2 = €29.98 with 2 deliverables, UI stepper + notes. 9/9 regression tests pass

### 2026-09-03 — Bank transfer (PayID/BSB) + Customers + Expenses
- Bank transfer checkout: POST /api/payments/bank-transfer → order awaiting_payment with reference DS-XXXXXXXX + 48h expiry; BankPending page shows PayID/BSB/amount/reference; "not instant delivery" messaging on cart, page and email; auto-cancel loop (15min) cancels expired + emails buyer
- Admin: mark-paid button on awaiting orders → full fulfillment (key + email + loader link); bank details editable in Orders tab settings card
- Real PayID/BSB set in PREVIEW settings (user-provided); PROD settings endpoint is old code until deploy — re-save on live admin after deployment
- Customers tab: aggregate by email (spent/orders/last) + manual add + Send key (pulls stock, $0 order, emails key)
- Expenses tab: label/amount/category/date CRUD; stats now include expenses, profit, customers (SalesStats 6 cards)
- Note: Cloudflare replaces origin HTTP 502 with its own page — never raise 502 from endpoints (use 500)


### 2026-09-03 — Per-product share links with artwork previews
- New route /product/{id} (ProductPage.jsx) — opens that product's modal directly, deep-linkable
- Backend GET /api/share/product/{id} serves crawler HTML with that product's og:image (its artwork), og:title, price in description; humans are meta-refresh/JS redirected to /product/{id}; 404 for unknown ids
- Share button (Share2 icon) in product modal copies the share link; Discord/Twitter show the product's artwork in the embed
- Share URLs use STORE_URL env (preview → preview URL, production → desync.website)
- Verified: crawler curl shows correct og tags + product image, browser page opens modal, clipboard copy works

### 2026-09-03 — Link preview banner (Open Graph)
- User-supplied Desync banner (960×540, "UNDETECTED. UNMATCHED.") saved as /app/frontend/public/images/og-banner.png
- index.html: og:/twitter: meta tags (summary_large_image) pointing at https://desync.website/images/og-banner.png; theme-color #2E6BFF (Discord embed strip). Discord/Twitter crawls read these static tags — works for all routes since SPA serves same HTML
- Needs a deploy for the banner image to exist on desync.website; Discord caches embeds — re-paste link after deploy (cache can take hours)

### 2026-09-03 — FAQ cleanup
- Removed the "Do I need the HWID spoofer?" FAQ entry (references deleted GHOST product); FAQ now 4 items. Only remaining HWID mention is in unused ReviewsMarquee.jsx
- Refund FAQ rewritten to "all purchases are final / no refunds" except where required by law (matches TOS section 4)
- KNOWN PROD ISSUE (user reported, paused): on live site, My Orders lookup for jackogoong@gmail.com showed "No paid orders found" + a Cloudflare "origin sent unparseable response" error toast — needs deployer debug if it recurs after current deploy

### 2026-09-03 — Admin resend order email
- POST /api/admin/orders/{id}/resend-email (paid orders only, 400 otherwise, 401 unauth); attaches fresh loader links before sending; sets email_sent
- "Resend email" button on each paid order row in admin Orders tab
- Fixed email validator conflict: loader filename moved out of anchor text (anti-phishing G3 rule rejects host-like anchor text such as .exe filenames) — button now says "Download loader", filename shown as plain text beside it
- Note: provider rejects fake @test.com recipients (502) — expected; real buyer emails deliver

### 2026-09-03 — Per-product loader files
- Bug fix (same day): frontend download button built link with double `/api/api/` (API const already includes /api) → 404 on live site. Fixed: api.js exports BASE_URL (bare backend origin), KeyRow uses BASE_URL + download_url. Verified end-to-end: href correct, 200 download, bytes match
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
