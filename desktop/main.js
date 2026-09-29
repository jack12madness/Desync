// Desync Desktop — Electron main process.
// All network goes through here (no CORS issues, single place for the API base).
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const API_BASE = (process.env.DESYNC_API_URL || "https://desync.website").replace(/\/$/, "");

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
  const win = new BrowserWindow({
    width: 420,
    height: 720,
    minWidth: 380,
    minHeight: 620,
    backgroundColor: "#050B18",
    title: "Desync Desktop",
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
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
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

ipcMain.handle("store-get", (_e, key) => readStore()[key] ?? null);
ipcMain.handle("store-set", (_e, key, value) => {
  const s = readStore();
  s[key] = value;
  writeStore(s);
});
ipcMain.handle("store-clear", () => writeStore({}));
ipcMain.handle("app-info", () => ({ version: app.getVersion(), apiBase: API_BASE }));
