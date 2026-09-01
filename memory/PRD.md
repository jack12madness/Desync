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
