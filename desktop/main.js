// Desync Desktop — Electron main process.
// All network goes through here (no CORS issues, single place for the API base).
// Includes: system tray with minimize-to-tray, auto-updates (packaged builds),
// and a new-order alert hook the renderer can trigger for staff.
const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

const API_BASE = (process.env.DESYNC_API_URL || "https://desync.website").replace(/\/$/, "");

let win = null;
let tray = null;
let quitting = false;

// ---- tiny JSON store in userData (key, staff token, history) ----
const storeFile = () => path.join(app.getPath("userData"), "desync-store.json");
function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), "utf8"));
  } catch {
    return {};
  }
}
function writeStore(data) {
  try {
    fs.writeFileSync(storeFile(), JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("store write failed", e);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 720,
    minWidth: 380,
    minHeight: 620,
    backgroundColor: "#050B18",
    title: "Desync Desktop",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  // close button minimizes to tray instead of quitting
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "build", "tray.png");
  if (!fs.existsSync(iconPath)) return;
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip("Desync Desktop");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Desync", click: () => { if (win) { win.show(); win.focus(); } } },
      { type: "separator" },
      { label: "Quit", click: () => { quitting = true; app.quit(); } },
    ])
  );
  tray.on("click", () => {
    if (win) {
      if (win.isVisible()) win.focus();
      else win.show();
    }
  });
}

// ---- auto updates (packaged builds only; publishes come from GitHub Releases) ----
function setupAutoUpdate() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch {
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.on("update-available", (info) => {
    if (win) win.webContents.send("update-status", { state: "available", version: info.version });
  });
  autoUpdater.on("update-downloaded", (info) => {
    if (win) win.webContents.send("update-status", { state: "downloaded", version: info.version });
  });
  ipcMain.handle("update-restart", () => autoUpdater.quitAndInstall());
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    createWindow();
    createTray();
    setupAutoUpdate();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("before-quit", () => { quitting = true; });
  app.on("window-all-closed", () => {
    // keep running in the tray; Quit comes from the tray menu
    if (process.platform === "darwin" && !tray) app.quit();
  });
}

// ---- API proxy: renderer never talks to the network directly ----
ipcMain.handle("api", async (_event, { method, path: p, body, token }) => {
  try {
    const res = await fetch(`${API_BASE}/api${p}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON response */
    }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { detail: `Network error — check your connection (${err.message})` } };
  }
});

// ---- new order alert: flash the window + tray tooltip ----
ipcMain.handle("order-alert", (_e, count) => {
  if (win) {
    if (win.isMinimized() || !win.isVisible()) win.flashFrame(true);
  }
  if (tray) tray.setToolTip(`Desync Desktop — ${count} order(s) in the last 24h`);
});

ipcMain.handle("store-get", (_e, key) => readStore()[key] ?? null);
ipcMain.handle("store-set", (_e, key, value) => {
  const s = readStore();
  s[key] = value;
  writeStore(s);
});
ipcMain.handle("store-clear", () => writeStore({}));
ipcMain.handle("app-info", () => ({ version: app.getVersion(), apiBase: API_BASE, packaged: app.isPackaged }));
