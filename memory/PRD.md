# VOIDWARE — PRD

## Original Problem Statement
User is reselling game cheats, mainly FiveM, expanding to other games. Wants a look inspired by getcheats.gg (dark navy gaming storefront, hero + product cards with "From €X.XX") but NOT a copy. Brand name TBD (agent chose VOIDWARE). Stripe test-mode payments. Guest checkout (email only, no buyer accounts) so keys can be delivered to their email. Admin dashboard with custom username/password logins the owner creates (no Google/Emergent-managed auth). After purchase: order confirmation + license key delivery + order retrieval area.

## Architecture
- Frontend: React 19 + Tailwind + shadcn/ui + framer-motion + lenis (smooth scroll). Dark obsidian/void-navy theme, electric cyan accent, Cabinet Grotesk/Outfit/JetBrains Mono.
- Backend: FastAPI + MongoDB (motor). Single server.py.
- Auth: custom JWT admin auth (bcrypt, 12h Bearer tokens). Owner role can create/delete admin users. Seeded owner from env (ADMIN_USERNAME/ADMIN_PASSWORD).
- Payments: Stripe claimable sandbox (Flow A, test mode). Hosted Checkout with inline price_data (EUR), SMP managed payments with automatic-tax fallback (sandbox country AU, digital goods). Webhook /api/stripe/webhook + status-poll fallback, idempotent fulfillment.
- Orders: created pending at checkout; on payment, license keys (VOID-XXXX-XXXX-XXXX) generated per item. Lookup by email.
- Design blueprint: /app/design_guidelines.json

## User Personas
- Buyer (guest): browses, buys with email, gets keys, retrieves later by email.
- Owner (voidowner): full control, creates staff accounts.
- Staff admin: manages products and views orders.

## Core Requirements (static)
1. Storefront with hero, product grid, game filters, status badges
2. Product modal with duration pricing (day/week/month/lifetime)
3. Cart drawer + guest email checkout via Stripe
4. License key delivery on confirmation page + My Orders lookup
5. Public status matrix page
6. Admin dashboard: product CRUD, orders, staff management (owner only)

## Implemented (2026-09-01)
- Full storefront: kinetic masked-reveal hero with parallax, status banner, filterable product grid with spotlight-hover cards, reviews marquee, FAQ, footer
- Product modal with duration selector, features, add-to-cart/buy-now
- Cart drawer with email capture → Stripe hosted checkout (test mode)
- Payment success page (polls until paid, shows keys + copy + setup steps), cancel page
- Order lookup by email (/orders)
- Status page (/status) with live product statuses
- Admin login (/admin) + dashboard (/admin/dashboard): product CRUD, orders list, staff account management (owner only)
- Backend: products/status/orders/checkout/webhook/admin endpoints, seeded 7 products, brute-safe auth, Mongo indexes
- Stripe sandbox provisioned (claimable), EUR pricing, SMP tax handling with fallback

## Implemented (2026-09-01, round 2)
- Full redesign to deep navy/royal-blue cinematic theme (#050B18 base, #2E6BFF accent) per user feedback — closer to getcheats.gg reference: split hero with right-side character render + blue halo, blue underline accent headline, rounded-xl tall 3:4 portrait product cards with circular blue arrow CTA
- Email key delivery via Emergent-managed Resend (email_utils.py, guardrail gate on every send): order keys emailed on payment fulfillment, waitlist confirmation emails
- Hype drop page /drop: live countdown (target 2026-09-22T17:00Z), blurred teaser art, email waitlist with success state + live operator count
- Waitlist backend: POST /api/waitlist (upsert), GET /api/waitlist/count, GET /api/admin/waitlist; admin dashboard Waitlist tab
- Product art refreshed to cinematic soldier/character set

## Implemented (2026-09-01, round 3)
- Hero rebuilt full-bleed to match getcheats.gg reference: edge-to-edge cinematic background, characters bleeding off right edge, overlaid headline "Get the Upper Hand / with VOIDWARE" with blue underline, light-blue "Search Products" pill + dark "Join Discord", icon stat row with dividers (3+ Years | 12k Customers | 18 Games), 5%-off chip bottom-left
- Custom GTA-style key art generated via Gemini Nano Banana (EMERGENT_LLM_KEY), saved at /app/frontend/public/images/hero-gta.png; generator script at /app/scripts/gen_hero.py

## Implemented (2026-09-01, round 4)
- De-"AI robot" cleanup: removed terminal styling across all pages (no more mono HUD labels, // jargon, chamfer clips) — clean rounded buttons, pill filters, plain sans text matching the reference's clean navy look
- Generated 7 custom GTA-style human product images (Nano Banana), saved locally in /app/frontend/public/images/ and wired into the catalog; generator at /app/scripts/gen_products.py
- Restyled: StatusPill (soft rounded pills), StatusBanner (clean trust strip), ProductModal, CartDrawer, ReviewsMarquee, Faq, Footer, StatusPage, OrderLookup, PaymentSuccess, PaymentCancel, AdminLogin, AdminDashboard (rounded buttons), DropPage
- New staff account: Jack / Joise2701 (owner role), verified login

## Implemented (2026-09-01, round 5)
- Full rebrand VOIDWARE -> Desync: navbar/footer/admin logo + wordmark ("De[blue]sync[/blue]"), hero headline "with Desync", browser tab title + favicon + meta, email sender name (EMAIL_FROM_NAME), new license key prefix DESYNC-, API banner
- Logo: custom SVG mark — glitched/desynced split "D" in blue gradient at /app/frontend/public/images/logo.svg (AI image generation was budget-blocked, so the mark is hand-crafted vector — crisp at any size, works as favicon)

## Implemented (2026-09-01, round 6)
- Discord branding pack (vector-rendered, exact Discord sizes): server avatar 512x512, server banner 960x540 (mark + wordmark + tagline), welcome image 1920x640. Files at /app/assets/discord-pack/ and preview/downloadable on the site under /images/discord/. Generator: /app/scripts/gen_discord_pack.py

## Implemented (2026-09-01, round 7)
- Animated loading splash: glitch-D halves slide in from opposite sides with a desync flicker, Desync wordmark, gradient progress bar, "Undetected. Unmatched." tagline, fades out after ~3s revealing the site (component: SplashScreen.jsx, mounted in App.js with AnimatePresence)

## Implemented (2026-09-01, round 8)
- SellAuth-style key stock: admin pastes real keys per product (bulk, one per line) via Key Manager in dashboard; on successful payment one available key is atomically assigned FIFO and delivered (confirmation page + email + My Orders). Out-of-stock items flag the order keys_pending and show "key being assigned" instead of a fake key. Sold keys show which order took them; available keys can be deleted; duplicate keys rejected
- Admin login fully redesigned: split-screen with brand panel ("Run the whole operation."), GTA art backdrop, clean card form
- Restored 5 missing products (were deleted during testing) with their new artwork

## Implemented (2026-09-01, round 9)
- Per-duration key pools: keys are added into day/week/month/lifetime pools per product; sales pull from the matching pool only; key manager shows per-duration counts and duration tags on each key; existing keys migrated to day pool
- Low-stock alerts: when a pool drops to 4 keys (and again at 0), an alert email fires to the notification email set in admin (Orders tab -> Low-stock alerts card). Tested live to resend test inbox
- Real Discord invite https://discord.gg/qh3aUNKcYc wired into every Join Discord link (navbar, hero, footer, drop page)

## Implemented (2026-09-01, round 10)
- Pending-Key Filler: orders that sold with an empty pool show "Keys pending — assign now" in admin Orders; one click pulls a key from the matching pool, updates the order and re-emails the buyer
- Sales stats: dashboard top strip (Revenue / Paid Orders / Keys Sold / Waitlist) + per-product sales bars (GET /api/admin/stats)
- Drop date & teaser now admin-editable (Launch tab) and served publicly via GET /api/drop-config; DropPage renders live settings. Currently set to 2026-10-01 18:00 UTC with sample teaser "SPECTRE v2 — full rewrite..." (owner should edit)
- Go-live checklist in Launch tab: auto-checked items (alert email, Discord link, products live, pools stocked, drop date) + manual checkboxes (Stripe claimed, live test purchase, custom domain) persisted in settings

## Implemented (2026-09-01, round 11)
- Branded sender readiness: email_utils send_email now uses direct Resend API when RESEND_API_KEY + EMAIL_FROM_ADDRESS env vars are present (own verified domain, e.g. keys@desync.gg), else falls back to Emergent-managed sender. Awaiting user's domain + Resend key
- Production 520 fix: absolute-path load_dotenv + sys.path hardening in server.py (prod-import-safe from any cwd); root cause was Cloudflare edge routing pointer for /api/*, remedy = redeploy (user confirmed, redeploy in progress)

## Implemented (2026-09-01, round 12)
- Discount codes: admin Coupons tab (create % codes, optional max uses, enable/disable, delete, usage counter); cart has code field with applied chip, discount line and new total; server re-validates at checkout and computes discounted Stripe amounts server-side; used_count increments only on paid fulfillment
- Removed fake reviews section from home; hero stats replaced with factual ones (24/7 Support, Instant Delivery, 7 Games)
- Live-site 520 confirmed fixed by user after redeploy
- Test coupon LAUNCH20 (20% off, max 5 uses) exists in admin
- Discord invite corrected to https://discord.gg/GapTZMAY7v everywhere (navbar, hero, footer). NOTE: live deployed site needs a redeploy to pick this up (preview is instant)

## Implemented (2026-09-01, round 13)
- Announce bot: Launch tab "Announce the drop" card — editable subject + message, confirm dialog, one click emails the entire waitlist with a shop link; records last-sent time; POST /api/admin/announce (tested: 1/1 delivered)
- Fixed coupon-create response serialization (insert_one _id leak)

## Implemented (2026-09-01, round 14)
- Waitlist export: admin Waitlist tab "Export CSV" button downloads desync-waitlist.csv (email + joined date); GET /api/admin/waitlist/export (401 without auth, verified)
- Redeploy pushed live with all changes since last deploy (Discord invite fix, coupons, per-duration stock, alerts, announce bot, export, stats, launch tab, email dual-path, startup hardening)

## Implemented (2026-09-02, round 15)
- Hero art replaced with Michael-and-Trevor-style fan-art homage (suited arms-crossed man + bald bat-wielding man, rooftop, navy grade), generated via Nano Banana at /app/frontend/public/images/hero-gta.png (script /app/scripts/gen_hero2.py)
- Clarified for user: package reinstall on republish is normal fresh-build behavior; admin changes persist in the database; preview and live use separate databases

## Implemented (2026-09-02, round 16)
- Franklin-style character (green/black bomber, fade, gold chain, rooftop, matching navy grade) generated at /app/frontend/public/images/character-franklin.png (script /app/scripts/gen_franklin.py) and placed on the drop page as a right-edge figure with left-fade mask; trio complete: Michael+Trevor on home hero, Franklin on /drop

## Implemented (2026-09-02, round 17)
- Hero art replaced again per user reference: full heist-crew lineup — all three characters in matching dark suits with duffel bags and rifles (Michael/Trevor/Franklin-style trio), on the navy night backdrop with left negative space (script /app/scripts/gen_hero3.py, overwrote hero-gta.png). Reference was the GTA V heist artwork; characters/styling echoed, background kept as ours

## Implemented (2026-09-02, round 18)
- Hero now uses the user's OWN cutout photo of the GTA trio (image-removebg-preview (1).png, 707x353 RGBA) — characters pixel-identical to what they sent, no AI redraw. Saved at /app/frontend/public/images/hero-crew.png; Hero.jsx renders it bottom-right, enlarged (~58-64% width) and raised (bottom 3%) per user nudge request, over the navy atmosphere

## Implemented (2026-09-02, round 19)
- Drop page AI Franklin replaced with the REAL Franklin cropped from the user's own trio cutout (alpha-edge crop x468-700 of hero-crew.png, 232x353 RGBA) at /app/frontend/public/images/character-franklin.png; drop page figure restyled to bottom-anchored object-contain cutout. Entire site now uses the user's own character art

## Implemented (2026-09-02, round 20)
- Removed the Franklin cutout from the drop page per user (didn't like it) — drop page back to clean blurred backdrop
- Home hero crew scaled way up (~76-88% width, right-bleed) to match the old full-bleed presence while keeping the user's exact photo characters

## Implemented (2026-09-02, round 21)
- PayPal checkout (SANDBOX keys from user): gold PayPal button + PayPal-hosted "Debit or Credit Card" in cart drawer next to Stripe. Backend: OAuth token cache, POST /api/paypal/create (validates cart + coupon server-side, EUR, internal order with payment_provider=paypal), POST /api/paypal/capture (captures then fulfills via shared _fulfill_order), GET /api/orders/by-id/{id} for the success page. PaymentSuccess handles ?order= (PayPal) and ?session_id= (Stripe). Frontend env REACT_APP_PAYPAL_CLIENT_ID; backend env PAYPAL_CLIENT_ID/SECRET/BASE_URL (sandbox api-m.sandbox.paypal.com). To go live: swap to live PayPal app keys + PAYPAL_BASE_URL=https://api-m.paypal.com

## Implemented (2026-09-02, round 22)
- Hero quality fix: user's cutout was 707px and blurry at hero size. AI-upscaled the exact photo 2x to 1442x720 (identity-locked enhance pass, /app/scripts/upscale_crew.py), then cut the white background with a border-flood scipy cutout + edge erosion/feather (/app/scripts/cutout_crew_fast.py — rembg kept getting killed by the exec sandbox). Characters pixel-identical, now sharp at hero size. Note: PayPal + hero art still awaiting a republish to hit the live site

## Verified
- API: login/me, admin products, checkout session creation (real Stripe URL), wrong-password 401, status matrix, lookup gating (unpaid hidden), waitlist join/count/admin list
- E2E browser: home render, product modal, duration select, cart, Stripe checkout page (correct item/price/email), drop page countdown + waitlist join with success state
- Fulfillment: signed webhook simulation → order paid → key VOID-635E-SP1H-3K7D issued → lookup returns it → success page renders keys
- Email: order key email + waitlist confirmation both sent successfully via managed email proxy (test inbox delivered@resend.dev)
- Admin UI: login, products tab, orders tab

## Backlog
- P0: User claims Stripe sandbox (onboarding URL shared) before go-live; update Discord links to real server invite
- P1: Real email delivery of keys (Resend), download links per product in admin
- P2: Coupons/discount codes, crypto payments toggle, review submission, product image upload (object storage)
