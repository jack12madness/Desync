/* Desync Desktop renderer — key login, generator, staff snapshot.
   Uses the Electron IPC bridge (window.desync) when packaged; falls back to
   direct fetch in a plain browser for development. */

const API_BASE_DEFAULT = "https://desync.website";
const isElectron = typeof window.desync !== "undefined";
const GEN_TYPES = ["steam", "discord", "rockstar"];
const HISTORY_MAX = 50;

// ---------- transport + storage adapters ----------
async function api(method, path, body, token) {
  if (isElectron) return window.desync.api(method, path, body, token);
  const base = (localStorage.getItem("desync_api_base") || API_BASE_DEFAULT).replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { detail: `Network error — ${e.message}` } };
  }
}
const storeGet = isElectron
  ? (k) => window.desync.storeGet(k)
  : async (k) => { try { return JSON.parse(localStorage.getItem("desync_" + k)); } catch { return null; } };
const storeSet = isElectron
  ? (k, v) => window.desync.storeSet(k, v)
  : async (k, v) => localStorage.setItem("desync_" + k, JSON.stringify(v));
const storeClear = isElectron
  ? () => window.desync.storeClear()
  : async () => ["gen_key", "admin_token", "history"].forEach((k) => localStorage.removeItem("desync_" + k));

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const aud = (n) => `A$${Number(n || 0).toFixed(2)}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const newRequestId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

let toastTimer = null;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  if (btn) {
    const old = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = old; }, 1200);
  }
}

function show(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $(viewId).classList.remove("hidden");
  const headerActions = $("header-actions");
  headerActions.innerHTML = "";
  if (viewId === "view-generator" || viewId === "view-admin") {
    const btn = document.createElement("button");
    btn.className = "link-btn";
    btn.dataset.testid = "logout-button";
    btn.textContent = "Log out";
    btn.onclick = logout;
    headerActions.appendChild(btn);
  }
}

async function logout() {
  await storeClear();
  clearInterval(orderPollTimer);
  lastOrderCount = null;
  state = { key: null, genData: null, adminToken: null };
  renderHistory([]);
  show("view-chooser");
}

const DURATION_LABELS = { day: "1 Day", "3d": "3 Days", week: "1 Week", month: "1 Month", lifetime: "Lifetime" };
const durLabel = (product, d) => (product && product.duration_labels && product.duration_labels[d]) || DURATION_LABELS[d] || d;

let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    o.start();
    o.stop(audioCtx.currentTime + 0.5);
  } catch { /* audio unavailable */ }
}

// ---------- state ----------
let state = { key: null, genData: null, adminToken: null };
let countdownTimer = null;
let orderPollTimer = null;
let lastOrderCount = null;
let adminProducts = [];

// ---------- customer: key login + generator ----------
async function keyLogin() {
  const key = $("key-input").value.trim();
  const errEl = $("key-error");
  errEl.classList.add("hidden");
  if (!key) { errEl.textContent = "Paste your key first"; errEl.classList.remove("hidden"); return; }
  $("btn-key-login").disabled = true;
  const { status, data } = await api("POST", "/gen/validate", { key });
  $("btn-key-login").disabled = false;
  if (status === 200 && data && data.valid) {
    state.key = key;
    state.genData = data;
    await storeSet("gen_key", key);
    renderGenerator();
    show("view-generator");
  } else {
    errEl.textContent = (data && data.detail) || "That key didn't work — check it and try again";
    errEl.classList.remove("hidden");
  }
}

async function refreshGenerator() {
  if (!state.key) return;
  const { status, data } = await api("POST", "/gen/validate", { key: state.key });
  if (status === 200 && data && data.valid) {
    state.genData = data;
    renderGenerator();
  } else if (status === 401 || status === 403) {
    toast((data && data.detail) || "Key no longer valid");
    await logout();
  } else {
    toast((data && data.detail) || "Couldn't reach the site");
  }
}

function tierName(d) {
  const max = Math.max(...GEN_TYPES.map((t) => (d.limits && d.limits[t]) || 0));
  return max >= 3 ? "Full access · 3 of each / hour" : "Standard · 1 of each / hour";
}

function renderGenerator() {
  const d = state.genData;
  if (!d) return;
  $("gen-tier").textContent = tierName(d);
  const wrap = $("gen-types");
  wrap.innerHTML = "";
  for (const t of GEN_TYPES) {
    const limit = (d.limits && d.limits[t]) || 0;
    const used = (d.used && d.used[t]) || 0;
    const maxed = used >= limit;
    const card = document.createElement("div");
    card.className = "gen-card";
    card.dataset.testid = `gen-card-${t}`;
    card.innerHTML = `
      <div class="gen-card-top">
        <span class="gen-card-name">${t}</span>
        <span class="gen-count ${maxed ? "maxed" : ""}" data-testid="gen-count-${t}">${used}/${limit} used</span>
      </div>
      <div class="gen-bar"><div class="gen-bar-fill ${maxed ? "maxed" : ""}" style="width:${limit ? Math.min(100, (used / limit) * 100) : 0}%"></div></div>
      <div class="gen-card-bottom">
        <span class="gen-countdown" data-testid="gen-countdown-${t}"></span>
        <button class="gen-btn" data-testid="gen-btn-${t}" ${maxed ? "disabled" : ""}>Generate</button>
      </div>`;
    card.querySelector(".gen-btn").onclick = () => generate(t);
    wrap.appendChild(card);
  }
  startCountdowns();
}

function startCountdowns() {
  clearInterval(countdownTimer);
  const tick = () => {
    const resets = (state.genData && state.genData.resets) || {};
    let anyMaxed = false;
    for (const t of GEN_TYPES) {
      const limit = (state.genData.limits && state.genData.limits[t]) || 0;
      const used = (state.genData.used && state.genData.used[t]) || 0;
      const el = document.querySelector(`[data-testid="gen-countdown-${t}"]`);
      if (!el) continue;
      if (used >= limit && resets[t]) {
        const ms = new Date(resets[t]).getTime() - Date.now();
        if (ms > 0) {
          anyMaxed = true;
          const m = Math.floor(ms / 60000);
          const s = Math.floor((ms % 60000) / 1000);
          el.textContent = `refills in ${m}m ${String(s).padStart(2, "0")}s`;
          continue;
        }
      }
      el.textContent = "";
    }
    if (!anyMaxed) clearInterval(countdownTimer);
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

async function generate(type) {
  const btn = document.querySelector(`[data-testid="gen-btn-${type}"]`);
  if (btn) btn.disabled = true;
  const { status, data } = await api("POST", "/gen/generate", {
    key: state.key, type, request_id: newRequestId(),
  });
  if (btn) btn.disabled = false;
  if (status === 200 && data && data.ok) {
    showResult(type, data.raw || "");
    await addHistory(type, data.raw || "");
    await refreshGenerator();
  } else if (status === 429) {
    toast("Hourly limit reached — watch the countdown");
    await refreshGenerator();
  } else if (status === 409) {
    toast((data && data.detail) || "Out of stock right now — try again soon");
  } else if (status === 401 || status === 403) {
    toast((data && data.detail) || "Key no longer valid");
    await logout();
  } else {
    toast((data && data.detail) || "Generation failed — try again");
  }
}

function showResult(type, raw) {
  const box = $("gen-result");
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="result-card" data-testid="gen-result">
      <div class="result-head">
        <span class="result-type">${esc(type)} account</span>
        <button class="copy-btn" data-testid="gen-result-copy">Copy</button>
      </div>
      <div class="raw-line" data-testid="gen-result-raw">${esc(raw)}</div>
    </div>`;
  box.querySelector(".copy-btn").onclick = (e) => copyText(raw, e.target);
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function getHistory() { return (await storeGet("history")) || []; }
async function addHistory(type, raw) {
  const h = await getHistory();
  h.unshift({ type, raw, ts: new Date().toISOString() });
  await storeSet("history", h.slice(0, HISTORY_MAX));
  renderHistory(h.slice(0, HISTORY_MAX));
}
function renderHistory(h) {
  const wrap = $("gen-history");
  wrap.innerHTML = "";
  if (!h.length) {
    wrap.innerHTML = `<div class="history-empty" data-testid="history-empty">Nothing generated yet — your accounts will be kept here.</div>`;
    return;
  }
  for (const item of h) {
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `
      <span class="history-type">${esc(item.type)}</span>
      <span class="history-raw" title="${esc(item.raw)}">${esc(item.raw)}</span>
      <button class="copy-btn">Copy</button>`;
    row.querySelector(".copy-btn").onclick = (e) => copyText(item.raw, e.target);
    wrap.appendChild(row);
  }
}

// ---------- staff: login + snapshot ----------
async function staffLogin() {
  const username = $("staff-user").value.trim();
  const password = $("staff-pass").value;
  const errEl = $("staff-error");
  errEl.classList.add("hidden");
  if (!username || !password) { errEl.textContent = "Enter both username and password"; errEl.classList.remove("hidden"); return; }
  $("btn-staff-login").disabled = true;
  const { status, data } = await api("POST", "/auth/login", { username, password });
  $("btn-staff-login").disabled = false;
  if (status === 200 && data && data.token) {
    state.adminToken = data.token;
    await storeSet("admin_token", data.token);
    lastOrderCount = null;
    await renderAdmin();
    startOrderPolling();
    show("view-admin");
  } else {
    errEl.textContent = (data && data.detail) || "Login failed";
    errEl.classList.remove("hidden");
  }
}

async function markPaid(orderId, btn) {
  if (btn) btn.disabled = true;
  const { status, data } = await api("POST", `/admin/orders/${orderId}/mark-paid`, null, state.adminToken);
  if (status === 200) {
    toast("Order marked paid — keys sent");
    await renderAdmin();
  } else {
    toast((data && data.detail) || "Couldn't mark paid");
    if (btn) btn.disabled = false;
  }
}

async function setBoostStatus(orderId, productId, duration, status, sel) {
  const { status: code, data } = await api(
    "POST", `/admin/orders/${orderId}/boost-status`,
    { product_id: productId, duration, status }, state.adminToken
  );
  if (code === 200) toast(`Boost marked ${status}`);
  else {
    toast((data && data.detail) || "Couldn't update status");
    if (sel) sel.value = sel.dataset.prev || "pending";
  }
}

async function loadRestockProducts() {
  const { status, data } = await api("GET", "/admin/products", null, state.adminToken);
  if (status !== 200 || !Array.isArray(data)) return;
  adminProducts = data.filter((p) => p.kind !== "boost");
  const sel = $("restock-product");
  sel.innerHTML = adminProducts
    .map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`)
    .join("");
  updateRestockDurations();
}

function updateRestockDurations() {
  const p = adminProducts.find((x) => x.id === $("restock-product").value);
  const sel = $("restock-duration");
  if (!p) { sel.innerHTML = ""; return; }
  sel.innerHTML = Object.keys(p.prices || {})
    .map((d) => `<option value="${esc(d)}">${esc(durLabel(p, d))}</option>`)
    .join("");
}

async function restockSubmit() {
  const productId = $("restock-product").value;
  const duration = $("restock-duration").value;
  const keys = $("restock-keys").value.trim();
  if (!productId || !duration || !keys) { toast("Pick a product and paste at least one key"); return; }
  const btn = $("btn-restock");
  btn.disabled = true;
  const { status, data } = await api("POST", "/admin/keystock", { product_id: productId, duration, keys }, state.adminToken);
  btn.disabled = false;
  if (status === 200 && data) {
    toast(`${data.added ?? 0} key(s) added to stock`);
    $("restock-keys").value = "";
    await renderAdmin();
  } else {
    toast((data && data.detail) || "Couldn't add keys");
  }
}

function startOrderPolling() {
  clearInterval(orderPollTimer);
  orderPollTimer = setInterval(async () => {
    if (!state.adminToken) { clearInterval(orderPollTimer); return; }
    const { status, data } = await api("GET", "/admin/app-summary", null, state.adminToken);
    if (status !== 200 || !data) return;
    const count = (data.today && data.today.orders) || 0;
    if (lastOrderCount !== null && count > lastOrderCount) {
      beep();
      if (isElectron && window.desync.orderAlert) window.desync.orderAlert(count);
      toast(`New order! ${count} in the last 24h`);
      await renderAdmin();
    }
    lastOrderCount = count;
  }, 60000);
}

async function renderAdmin() {
  const token = state.adminToken;
  const [summary, orders] = await Promise.all([
    api("GET", "/admin/app-summary", null, token),
    api("GET", "/admin/orders", null, token),
  ]);
  if (summary.status === 401 || orders.status === 401) {
    toast("Staff session expired — sign in again");
    await storeSet("admin_token", null);
    state.adminToken = null;
    show("view-staff-login");
    return;
  }
  const s = summary.data || {};
  const todayOrders = (s.today && s.today.orders) || 0;
  if (lastOrderCount === null) lastOrderCount = todayOrders;
  const stats = $("admin-stats");
  stats.innerHTML = "";
  for (const [key, label] of [["today", "Last 24h"], ["week", "Last 7 days"], ["month", "Last 30 days"]]) {
    const b = s[key] || { revenue: 0, orders: 0 };
    const card = document.createElement("div");
    card.className = "stat-card";
    card.dataset.testid = `stat-${key}`;
    card.innerHTML = `
      <div class="stat-label">${label}</div>
      <div class="stat-value">${aud(b.revenue)}</div>
      <div class="stat-sub">${b.orders} orders</div>`;
    stats.appendChild(card);
  }

  const boosts = $("admin-boosts");
  boosts.innerHTML = "";
  const pb = s.pending_boosts || [];
  if (!pb.length) {
    boosts.innerHTML = `<div class="list-empty" data-testid="boosts-empty">No boosts waiting — all caught up.</div>`;
  }
  for (const b of pb) {
    const row = document.createElement("div");
    row.className = "list-item boost";
    row.dataset.testid = `boost-${b.order_id}`;
    const what = `${(b.qty || 0).toLocaleString()} ${b.duration_label || b.boost_type || ""}`;
    row.innerHTML = `
      <div class="list-main">
        <div class="list-title">${esc(b.name || "Boost")} — ${esc(what)}</div>
        <div class="list-sub">${esc(b.platform === "tiktok" ? "TikTok" : "Instagram")} ${esc(b.boost_type || "")} · ${esc(b.email || "")}</div>
      </div>
      <button class="copy-btn" data-testid="boost-copy">Copy link</button>
      <select class="status-select" data-testid="boost-status">
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="completed">Completed</option>
      </select>`;
    const sel = row.querySelector(".status-select");
    sel.value = b.status || "pending";
    sel.dataset.prev = sel.value;
    sel.onchange = () => setBoostStatus(b.order_id, b.product_id, b.duration, sel.value, sel);
    row.querySelector(".copy-btn").onclick = (e) => copyText(b.link || "", e.target);
    boosts.appendChild(row);
  }

  const stockEl = $("admin-stock");
  stockEl.innerHTML = "";
  const ls = s.low_stock || [];
  if (!ls.length) {
    stockEl.innerHTML = `<div class="list-empty" data-testid="stock-ok">All products stocked.</div>`;
  }
  for (const item of ls) {
    const row = document.createElement("div");
    row.className = "list-item";
    row.dataset.testid = "stock-warning";
    row.innerHTML = `
      <div class="list-main">
        <div class="list-title">${esc(item.name)}</div>
        <div class="list-sub">${esc(item.duration_label)}</div>
      </div>
      <span class="pill ${item.left === 0 ? "pill-out" : "pill-low"}">${item.left === 0 ? "out" : item.left + " left"}</span>`;
    stockEl.appendChild(row);
  }

  const ordersEl = $("admin-orders");
  ordersEl.innerHTML = "";
  const list = (orders.data || []).slice(0, 10);
  if (!list.length) {
    ordersEl.innerHTML = `<div class="list-empty">No orders yet.</div>`;
  }
  for (const o of list) {
    const hasBoost = (o.items || []).some((i) => i.kind === "boost");
    const row = document.createElement("div");
    row.className = "list-item";
    row.dataset.testid = `order-${o.id}`;
    const names = (o.items || []).map((i) => i.name).join(", ");
    row.innerHTML = `
      <div class="list-main">
        <div class="list-title">${esc(names || "Order")}</div>
        <div class="list-sub">${esc(o.email || "")} · ${aud(o.total)}</div>
      </div>
      ${hasBoost ? '<span class="pill pill-boost">boost</span>' : ""}
      <span class="pill pill-${esc(o.payment_status || "pending")}">${esc(o.payment_status === "awaiting_payment" ? "bank pending" : o.payment_status || "pending")}</span>`;
    if (o.payment_status === "awaiting_payment") {
      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.dataset.testid = `mark-paid-${o.id}`;
      btn.textContent = "Mark paid";
      btn.onclick = () => markPaid(o.id, btn);
      row.appendChild(btn);
    }
    ordersEl.appendChild(row);
  }

  loadRestockProducts();
}

// ---------- wiring ----------
function wire() {
  $("btn-go-key").onclick = () => show("view-key-login");
  $("btn-go-staff").onclick = () => show("view-staff-login");
  $("btn-key-back").onclick = () => show("view-chooser");
  $("btn-staff-back").onclick = () => show("view-chooser");
  $("btn-key-login").onclick = keyLogin;
  $("key-input").addEventListener("keydown", (e) => { if (e.key === "Enter") keyLogin(); });
  $("btn-staff-login").onclick = staffLogin;
  $("staff-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") staffLogin(); });
  $("btn-gen-refresh").onclick = refreshGenerator;
  $("btn-admin-refresh").onclick = renderAdmin;
  $("restock-product").addEventListener("change", updateRestockDurations);
  $("btn-restock").onclick = restockSubmit;
  if (isElectron && window.desync.onUpdateStatus) {
    window.desync.onUpdateStatus((info) => {
      const banner = $("update-banner");
      const text = $("update-text");
      const restartBtn = $("btn-update-restart");
      banner.classList.remove("hidden");
      if (info.state === "available") {
        text.textContent = `Downloading update v${info.version}…`;
        restartBtn.classList.add("hidden");
      } else if (info.state === "downloaded") {
        text.textContent = `v${info.version} ready`;
        restartBtn.classList.remove("hidden");
        restartBtn.onclick = () => window.desync.restartUpdate();
      }
    });
  }
}

async function init() {
  wire();
  const info = isElectron && window.desync.appInfo ? await window.desync.appInfo() : null;
  $("footer-info").textContent = info ? `v${info.version} · ${info.apiBase}` : `dev · ${localStorage.getItem("desync_api_base") || API_BASE_DEFAULT}`;

  const savedKey = await storeGet("gen_key");
  if (savedKey) {
    state.key = savedKey;
    const { status, data } = await api("POST", "/gen/validate", { key: savedKey });
    if (status === 200 && data && data.valid) {
      state.genData = data;
      renderGenerator();
      renderHistory(await getHistory());
      show("view-generator");
      return;
    }
    if (status === 401 || status === 403) await storeSet("gen_key", null);
  }
  const savedToken = await storeGet("admin_token");
  if (savedToken) {
    state.adminToken = savedToken;
    lastOrderCount = null;
    await renderAdmin();
    if (state.adminToken) { startOrderPolling(); show("view-admin"); return; }
  }
  show("view-chooser");
}

init();
