# Desync Desktop — Windows app for the Generator + admin on the go

A downloadable Windows app for Desync customers and staff. Customers log in with their DSYNC key and generate Steam, Discord and Rockstar accounts from their desktop; staff log in with their admin account to check sales, orders and stock from anywhere.

## Who it's for

- **Customers** who bought the FiveM Account Generator (or redeemed a key) and want a dedicated app instead of the website portal
- **The owner (and future staff)** who want to keep an eye on orders, sales and stock without opening the admin website

## Core features and experience

**Generator (customer side)**
- Key login screen: paste DSYNC key, app validates it against the live site and remembers it locally
- Home screen shows the customer's tier and hourly allowance (3/3/3 for paid Generator keys, 1/1/1 for standard)
- Three generate buttons — Steam, Discord, Rockstar — each producing an account instantly with one-click copy
- Live "refills in X minutes" countdown per account type when the hourly limit is used up
- Generation history inside the app so previously generated accounts are never lost

**Admin (staff side)**
- Separate staff login (same username/password as the web admin)
- Sales snapshot: today / week / month revenue and order counts
- Recent orders list with statuses (paid, pending bank, boost orders flagged)
- Low-stock and out-of-stock warnings so restocks never get missed
- Pending boost submissions with their links, so fulfilment can start from the app

**General**
- Dark Desync look and feel (same blue/black theme as the store)
- Remembers logins locally; log out button clears them
- Talks to the live site (desync.website) — nothing is stored in the app except the login
- Ships as a single Windows installer (.exe) anyone can download and run

## User flow

1. Customer downloads and installs the app, opens it, pastes their DSYNC key
2. App validates the key, shows their allowance, and they start generating accounts
3. Staff open the same app, choose "Staff login", sign in, and land on the sales snapshot
4. Staff check recent orders and stock warnings, and copy boost links to fulfil them

## UI/UX feel

Compact dark window (roughly phone-sized, ~420×720), Desync navy/black with blue accents and pink for boost items, big readable account cards with copy buttons, minimal chrome — feels like a purpose-built tool, not a wrapped webpage.

## Implementation phases

**Phase 1 — MVP (built now)**
- Windows desktop app shell with customer key login and staff login
- Full Generator: validate key, generate all three account types, hourly-limit countdowns, copy buttons, local history
- Admin view: sales snapshot, recent orders, low-stock warnings, pending boost links
- Automated build pipeline: pushing the code to GitHub produces a ready-to-download Windows installer

**Phase 2 — later**
- Admin actions from the app: mark bank orders paid, set boost statuses, add keys to stock
- Auto-update so the app updates itself on launch
- System tray icon and launch-at-startup option

**Phase 3 — later**
- Code-signed installer (removes the Windows SmartScreen warning)
- New-order notifications
- macOS/Linux builds if ever needed

## Assumptions

- The app talks to the live site at desync.website; preview is used during development
- Generator rules stay exactly as they are on the website (same keys, same hourly limits, same stock pools) — the app is a second door into the same system, not a separate one
- Windows only for now; installer is unsigned at first, so Windows may show a one-time "unknown publisher" warning on install (signing is phase 3)
- The installer is produced by an automated GitHub build — the user publishes the code with the existing "Save to Github" feature and downloads the built installer from GitHub
- The app is a compact custom-built interface, not a wrapper around the website
- Customer key login and staff login live in the same app; customers never see the staff side without staff credentials
