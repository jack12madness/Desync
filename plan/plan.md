# Desync Customer Portal, Generator Entitlements & Reviews

A customer portal where buyers verify their email with a one-time code and see everything tied to their purchases — orders, licenses, Generator key, and hourly generation allowance — plus a secure Generator API the desktop app can call, admin customer management, and a moderated reviews system.

## Who it's for
- Customers who bought anything from Desync (view orders, keys, entitlements, leave reviews)
- Desync Generator owners (get a key, generate Steam/Discord/Rockstar accounts within hourly limits)
- Store staff (manage customers, Generator keys, entitlements, reviews moderation)

## Core features and experience

**1. Customer Portal (replaces "My Orders")**
- Navigation item "My Orders" becomes "Customer Portal".
- Same email + one-time-code login already proven on My Orders: enter email, receive a 6-digit code (10-minute expiry, 60-second resend cooldown, 5-try limit, single use), enter code, in. No passwords. Verified access lasts for the browser session.
- The customer only ever sees data tied to their verified email. One email = one customer, no duplicate accounts no matter how many orders exist.
- Dashboard sections: **Overview** (email, customer since date, Generator status, live allowance counters), **Orders** (every order: ID, date, products, quantities, price paid, payment status, keys/accounts as they appear today), **Products** (licenses with download links and setup instructions), **Generator** (status, key with reveal/copy, per-type allowance with "X / 3 remaining" and a next-reset countdown, generation history), **Account** (email, member-since, review prompt).
- Everything shown today in My Orders (keys, accounts, loader downloads, instructions, Discord links) keeps working inside the portal unchanged.

**2. Generator entitlement system**
- Buying the existing "FiveM Account Generator" product (any duration) automatically grants Generator access and issues a unique key in the format `DSYNC-XXXX-XXXX-XXXX`, visible in the portal.
- Any order totalling **over A$10** (price actually paid, after discounts) grants the standard entitlement: **1 Steam + 1 Discord + 1 Rockstar per hour**. Orders of A$10 or less grant nothing. Multiple qualifying orders do not stack — the standard allowance stays 1 of each.
- Owning the Generator overrides the standard allowance: **3 of each type per hour**.
- Limits are rolling-hour, calculated server-side from recorded usage — never from anything the Generator app sends.
- Generation pulls real accounts from the **shared shop stock pools** (the same account stock the store sells). Admin picks which product's pool feeds each type (defaults: the existing Steam/Discord/Rockstar account products). A generated account is consumed from stock so it can't be sold afterwards. If a pool is empty, generation for that type reports "out of stock" without consuming allowance... (allowance is only consumed on successful generation).
- Refunded or cancelled orders revoke the entitlements they granted (Generator access off, key revoked); already-generated accounts are not clawed back.

**3. Generator API (for the desktop app)**
- The app sends only the Generator key and the account type wanted. The server answers: key valid + active + not revoked, customer not disabled, allowance remaining, then performs the generation, records it (customer, key, type, timestamp, request ID, success/failure) and returns the account.
- Replay protection: each request carries a unique request ID; duplicates are rejected.
- No admin credentials, Stripe secrets or database access anywhere near the app — only the customer's own Generator key.

**4. Admin customer management (new "Customers" upgrade + Generator section)**
- Search customers by email, order ID, Generator key, or customer ID.
- Customer profile: email, orders, products, Generator access + key + status, current hourly limits, usage this hour, generation history, account creation date.
- Actions: grant/remove Generator access, generate/revoke/regenerate key, reset hourly usage, add/remove manual entitlements, disable/re-enable customer.
- Migration tool: add an existing Generator customer by email → access on, key auto-generated, status active — no purchase needed. Existing Generator customers get imported this way before launch.
- Every admin action is written to an audit log (who, what, when, which customer).

**5. Reviews**
- Only customers with a paid order can review (verified through their portal session). One review per order by default; admin can allow more. Submissions are rate-limited, text is sanitized, and emails are never shown publicly.
- Review form: 1–5 stars, written review, optional product picker, optional display name (falls back to a neutral label, never the email).
- Portal shows an "Enjoying your purchase? Leave us a review" prompt after a paid order.
- All reviews start as **pending** — nothing goes public until an admin approves it in the new Admin Reviews section (view all, approve, hide/remove, filter by product or rating, see the submitting customer/order).
- Public site gets a "What our customers say" section: average stars, total count, recent approved reviews (name, stars, text, product), and a Leave a Review button that sends people to the portal. Styled to match the existing dark-blue Desync look.

## User flow
- **Customer**: Portal → email → code → dashboard. Sees orders automatically, Generator key if entitled, allowance counters counting down within the hour, can submit a review for a paid order.
- **Generator owner**: copies key from portal → pastes into the Generator app → app validates against the API → generates accounts until the hourly allowance is used → allowance refills as the hour rolls.
- **Staff**: admin → Customers → search → open profile → grant access / regenerate key / reset usage / disable. Admin → Reviews → approve or hide. Admin → Customers → "Add existing Generator customer" for migration.

## UI/UX feel
- Existing Desync dark-blue theme untouched: same fonts, borders, spacing, buttons.
- Portal feels like the current My Orders page extended into a tabbed dashboard.
- Generator allowance shown as bold counters (e.g. "Steam 2 / 3 remaining") with a live next-reset countdown.
- Reviews section uses the site's existing card and typography style — star icons, quiet borders, no template look.

## Implementation phases
- **Phase 1 (built now)**: everything above — Customer Portal with email-code login and all dashboard sections, entitlement engine (Generator product, >A$10 rule, refund revocation), Generator API with server-side limits and replay protection, shared-stock generation, admin customer management + migration + audit log, full reviews system (submit, moderate, public section).
- **Phase 2 (later, optional)**: per-customer custom allowance overrides (e.g. 5/hour for a VIP), review replies from the store, export generation history.
- **Phase 3 (later, optional)**: Generator access expiry tied to subscription duration, review photos, entitlement gifting/transfer.

## Assumptions
- "FiveM Account Generator" (existing product) is the Generator; buying any duration of it grants access and a key. Generator access does not expire with the duration in Phase 1 (durations exist on that product but entitlement stays until revoked/refunded).
- Shared stock: generation consumes accounts from the admin-designated source product pools (defaulting to the existing Steam/Discord/Rockstar account products); a consumed account is no longer sellable in the shop.
- The >A$10 rule uses the paid order total (after discounts), in AUD.
- Standard entitlement never stacks; owning the Generator replaces it (3/hour) rather than adding to it.
- Existing buyers keep working: their orders appear in the portal by email with no action needed; existing Generator customers are imported manually via the admin migration tool.
- Reviews are pending-by-default and require admin approval before showing publicly.
- "Generator application" is a desktop app that talks to the public API with only the customer's key — no other credentials exist client-side.
- The email verification flow reuses the proven My Orders OTP system (same security rules), extended to log into the portal.
