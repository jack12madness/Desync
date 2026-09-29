# Desync Desktop

Windows app for Desync customers (Account Generator) and staff (sales snapshot).
Talks to the live site at `https://desync.website` — nothing is stored in the app
except the login (DSYNC key or staff token) and local generation history.

## Getting the installer (no dev tools needed)

1. Push this repo to GitHub with Emergent's **Save to Github** feature.
2. On GitHub, open the **Actions** tab — every push that touches `desktop/`
   runs the "Build Windows installer" workflow.
3. Open the finished run and download the **DesyncDesktop-Setup** artifact.
   Inside is the installer `.exe` — share it with customers.

Note: the installer is unsigned, so Windows SmartScreen shows a one-time
"unknown publisher" warning (More info → Run anyway). Code signing is a
later phase.

## Features (phase 1)

- **Customers**: log in with a DSYNC key; generate Steam / Discord / Rockstar
  accounts with live hourly-limit countdowns; one-click copy; history kept on
  the PC; key remembered between launches.
- **Staff**: log in with the web admin account; sales snapshot (24h / 7d / 30d),
  pending boost submissions with copyable links, low/out-of-stock warnings,
  recent orders.

## Development

```bash
cd desktop
npm install
npm start                 # runs against https://desync.website
DESYNC_API_URL=https://<preview-url> npm start   # point at a preview backend
```

The renderer also runs in a plain browser for UI work: serve `desktop/renderer/`
statically and set `localStorage.desync_api_base` to the API origin.

## Layout

- `main.js` — Electron main process: window, IPC API proxy, JSON store
- `preload.js` — exposes `window.desync` to the renderer
- `renderer/` — UI (no build step, plain HTML/CSS/JS)
