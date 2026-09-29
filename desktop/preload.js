const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desync", {
  api: (method, path, body, token) => ipcRenderer.invoke("api", { method, path, body, token }),
  storeGet: (key) => ipcRenderer.invoke("store-get", key),
  storeSet: (key, value) => ipcRenderer.invoke("store-set", key, value),
  storeClear: () => ipcRenderer.invoke("store-clear"),
  appInfo: () => ipcRenderer.invoke("app-info"),
  orderAlert: (count) => ipcRenderer.invoke("order-alert", count),
  restartUpdate: () => ipcRenderer.invoke("update-restart"),
  onUpdateStatus: (cb) => ipcRenderer.on("update-status", (_e, data) => cb(data)),
});
