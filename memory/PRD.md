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
### 2026-09-13 — Restock announcements to Discord
- New "restock" Discord webhook kind (5th card in Alerts tab: Restock announcements). User's webhook saved in PREVIEW settings — must be re-saved on LIVE admin after deploy (separate DBs)
- KeyManager: after Add keys → confirm screen (added/skipped/raw summary + pool) with "Announce this restock in Discord" checkbox (default on) → Announce & Done / Done / Add more; announce failure keeps the screen open for retry
- POST /api/admin/products/{id}/restock-announce {duration, added}: Kovex-style embed — "{Product} Restocked", "Our product X has just been restocked! [Buy Now]" (links to /product/{id}), Variant/Price/Stock inline fields per priced duration (live counts), product image, green. 400 if no webhook saved or Discord rejects; 401/404 guards verified. Real test post delivered 200


### 2026-09-13 — Full-bleed product photos in buy modal
- ProductModal image no longer crops: object-contain over a blurred cover backdrop (object-cover blur-2xl opacity-40), frame h-64/md:h-80, dark base. testid modal-product-image. Shop cards unchanged (still cover-cropped for grid uniformity)


### 2026-09-13 — Category admin, drag ordering, per-product Discord/instructions, My Orders OTP
- Admin Products tab: category cards first (ProductsTab.jsx), click a category to manage its products; Add Cheat/Add Account pre-fill that category
- Drag-and-drop product ordering per category (HTML5 DnD, grip handles) → POST /api/admin/products/reorder {game, product_ids} validates exact membership, sets sort_order (storefront follows)
- ProductIn adds discord_url (https:// enforced) + instructions (multiline). _attach_loader_links also attaches instructions/discord_url to order items at read time (email, success, My Orders, resend). Ticket claim link = discord_url or legacy ticket_url or store default
- Product form: Discord URL input + instructions textarea; description is now a rich textarea (## heading, - bullet, **bold**) rendered by RichDescription under the product image in ProductModal
- My Orders OTP: POST /orders/lookup/request-code (6-digit, sha256-hashed in lookup_codes, 10min TTL index, 60s resend cooldown), /orders/lookup/verify (5 attempts, single-use) → buyer_lookup JWT (2h); /orders/lookup requires {email, token}. Frontend: 2-step UI, sessionStorage token per email, any email can verify (no orders → "No purchases made with this email yet")
- KeyManager: scrollable key list region (max-h-38vh) + filter input + 100-row cap with show-all (large inventories no longer freeze the modal)
- SalesStats by-product rows keyed by product id (fixes duplicate-key warnings)
- Tests: 32/32 pass incl. new test_otp_reorder.py (OTP hash/expiry/rate-limit/single-use/token-scope, reorder auth+membership+ordering, discord_url validation). Testing agent iteration_2: all UI flows pass
- NOTE: email relay (Emergent Resend) rate-limits under heavy test volume (429 → endpoint surfaces 500 "try again"); transient, retry after 60s. Test recipient whitelist: delivered@resend.dev



### 2026-09-09 — Dupe-detection fix + loader links
- Bug: lines starting with labels like "E-Mail:" parsed "E-Mail" as the address → every line duped. Fix: strict parsers require a real email shape (regex) before accepting; otherwise raw fallback with regex-extracted email for dedupe. Verified with user's space-labeled myrambler lines (3 added, 0 skipped)
- Loader links: ProductIn.loader_link (https:// required) — product form has "or paste a download link" next to file upload; loader doc {link, filename, size:0}; download endpoint 302-redirects to the link (still order-token gated); form shows "external link" for link loaders


### 2026-09-09 — Universal account drop-in (reverted strict Email/Webmail type)
- Removed the "email" account_type option added earlier (user: accounts come in too many formats)
- keystock_add: strict parsers (discord/steam/rockstar) still pretty-print; ANY unmatched line is stored as account.raw (verbatim) with email regex-extracted for dedupe; response returns {added, skipped, raw}
- Delivery: email + My Orders render raw lines as clean mono blocks with copy button; parsed accounts still show per-field rows
- Demo "Email Accounts" product deleted; verified mixed-format paste (1 parsed, 2 raw incl. weird unlabeled line) and raw delivery. 9/9 regression pass


### 2026-09-09 — Email/Webmail account type
- New account_type "email" ("Email / Webmail" in product form): paste format `email : password : webmail :` (space-colon separated), plain `email:password(:webmail)` also works
- User's 30 myrambler.ru accounts were converted from labeled format to the new format (delivered in chat)
- Demo "Email Accounts" product (€1.00 lifetime) in PREVIEW with 3 test entries; delivery shows Email + Email Password + Webmail. 9/9 regression pass


### 2026-09-09 — Steam 5-field template
- Steam bulk paste now accepts: `Steam Username: x | Steam Password: y | E-Mail: z | Password: w | Webmail: url` (plain email:password fallback retained)
- Account schema adds steam_username, steam_password, webmail; email + My Orders render them (dynamic field lists); webmail shown as copyable text (http URLs can't be email links per validator)
- Verified with the user's exact sample line: parsed to all 5 fields, delivered end-to-end, buyer page shows all rows with copy buttons. 9/9 regression pass


### 2026-09-09 — Discord webhook alerts
- Settings discord_webhooks map: orders / payments / bank / low_stock — each posts embeds to its own Discord channel (user creates channel webhooks in Discord: Edit Channel → Integrations → Webhooks)
- New admin "Alerts" tab: 4 channel cards with webhook URL inputs, Save, and per-channel Test button (POST /api/admin/discord-test validates Discord accepts it)
- Triggers: card checkout created → orders; bank order created/reported/cancelled → bank; any fulfillment (stripe/paypal/manual/mark-paid) → payments; stock hits 4 or 0 → low_stock; manual send-key → orders
- Embeds include order ref, total, items+qty, email, discord username. Alerts fail silently (never break checkout). URL validation: must start https://discord. Settings PUT validates + stores
- Verified: validation errors, test-endpoint error paths, order flows unaffected with fake URLs; real delivery needs user's webhook URLs (Test button). 9/9 regression pass


### 2026-09-09 — Uploaded product/category photos (no more expiring Discord links)
- POST /api/admin/products/{id}/image and /api/admin/categories/{id}/image (PNG/JPG/WebP, max 10MB) → stored in Emergent object storage at desync/images/, product image_url becomes /api/media/{uuid}.{ext}
- GET /api/media/{filename} — public, sanitized (uuid.ext only, traversal blocked), streams from storage
- ProductForm: file upload + current photo preview (URL input replaced by upload); CategoriesTab: photo upload on create + edit
- Verified: upload→serve byte-exact, bad ext 400, traversal 404, storefront + form render uploaded images. NOTE: live products still use Discord URLs — re-upload each photo once via live admin after deploy


### 2026-09-07 — Ticket-delivery (generator) products
- ProductIn.delivery ("stock"|"ticket") + ticket_url (default https://discord.gg/de-sync); product form has Delivery method select + ticket link input
- Ticket products: skip all stock checks (infinite, never sold out), fulfillment sets item.ticket_url instead of keys; email renders "Claim via Discord ticket" box with button; My Orders/success show claim box + link; KeyManager shows info note instead of stock UI
- Verified: created generator product with 0 stock → sold → fulfilled with ticket_url, no pending; shop shows no sold-out badge; claim link correct. 9/9 regression pass


### 2026-09-04 — Rockstar 2FA format
- Rockstar bulk paste accepts the user's labeled pipe format: `E-Mail: x | Rockstar Password: y | 2FA Key: z | 2FA Redeem: url` (plain email:password also works as fallback)
- Account schema adds twofa_key + twofa_redeem; email + My Orders render only present fields (both _account_box and KeyRow ACCOUNT_FIELDS are dynamic)
- Demo "Rockstar Accounts" product (lifetime €3.00) created in PREVIEW with 2 test accounts; verified delivery shows all 4 fields incl. redeem URL. 9/9 regression pass


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
