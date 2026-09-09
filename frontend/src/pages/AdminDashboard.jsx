import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, LogOut, Terminal, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusPill from "@/components/StatusPill";
import { api, apiError, eur } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { DURATION_LABELS } from "@/context/CartContext";
import KeyManager from "@/components/KeyManager";
import SalesStats from "@/components/SalesStats";
import CouponsTab from "@/components/CouponsTab";
import CategoriesTab from "@/components/CategoriesTab";
import CustomersTab from "@/components/CustomersTab";
import ExpensesTab from "@/components/ExpensesTab";
import AlertsTab from "@/components/AlertsTab";

const EMPTY_PRODUCT = {
  game: "", name: "", description: "", image_url: "", status: "undetected",
  features: [], anticheat: "", prices: { day: "", week: "", month: "", lifetime: "" },
  min_buy: 1, kind: "cheat", account_type: "discord", delivery: "stock", ticket_url: "", loader_link: "", active: true, sort_order: 0,
};

function ProductForm({ initial, categories, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_PRODUCT;
    return {
      ...initial,
      prices: { day: "", week: "", month: "", lifetime: "", ...initial.prices },
      features: (initial.features || []).join(", "),
    };
  });
  const [loaderFile, setLoaderFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [removeLoader, setRemoveLoader] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setPrice = (k, v) => setForm((f) => ({ ...f, prices: { ...f.prices, [k]: v } }));

  const save = () => {
    const prices = {};
    for (const [k, v] of Object.entries(form.prices)) {
      if (v !== "" && v != null && !isNaN(parseFloat(v))) prices[k] = parseFloat(v);
    }
    if (!form.game || !form.name || Object.keys(prices).length === 0) {
      toast.error("Game, name and at least one price are required");
      return;
    }
    onSave({
      game: form.game, name: form.name, description: form.description,
      image_url: form.image_url, status: form.status, anticheat: form.anticheat, kind: form.kind || "cheat",
      loader_link: form.loader_link?.trim() || null,
      features: typeof form.features === "string"
        ? form.features.split(",").map((s) => s.trim()).filter(Boolean)
        : form.features,
      prices, min_buy: Math.max(1, parseInt(form.min_buy) || 1), account_type: form.kind === "account" ? (form.account_type || "discord") : null, delivery: form.delivery || "stock", ticket_url: form.delivery === "ticket" ? (form.ticket_url?.trim() || "https://discord.gg/de-sync") : null, active: form.active, sort_order: Number(form.sort_order) || 0,
    }, loaderFile, removeLoader, imageFile);
  };

  const fieldCls = "bg-[#050B18] border-slate-700 focus-visible:ring-blue-400 font-mono text-sm";
  const labelCls = "text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 block mb-1.5";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0A1628] border-blue-500/20 text-slate-100 max-h-[90vh] overflow-y-auto" data-testid="product-form-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold uppercase tracking-tight">
            {initial?.id ? "Edit Product" : form.kind === "account" ? "New Discord Account" : "New Cheat"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-4 mt-2">
          <div>
            <label className={labelCls}>Category</label>
            <Select value={form.game} onValueChange={(v) => set("game", v)}>
              <SelectTrigger data-testid="product-form-game" className={fieldCls}>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <div className="text-[10px] font-mono text-amber-400 mt-1.5">
                No categories yet — create one in the Categories tab first
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Name</label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="SPECTRE // Executor" data-testid="product-form-name" className={fieldCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Description</label>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} data-testid="product-form-description" className={fieldCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Product photo — upload a PNG/JPG (never expires)</label>
            {form.image_url && (
              <div className="flex items-center gap-3 mb-2">
                <img src={form.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-700" data-testid="product-form-image-preview" />
                <span className="text-[10px] font-mono text-slate-500 truncate flex-1">{form.image_url}</span>
              </div>
            )}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(e) => setImageFile(e.target.files[0] || null)}
              data-testid="product-form-image-upload"
              className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-400 file:px-4 file:py-2 file:text-xs file:font-mono file:font-bold file:uppercase file:text-[#050B18] hover:file:bg-blue-300 file:cursor-pointer"
            />
            {imageFile && (
              <div className="text-[10px] font-mono text-emerald-400 mt-1.5" data-testid="product-form-image-selected">
                {imageFile.name} — uploads on save
              </div>
            )}
            <div className="text-[10px] font-mono text-slate-600 mt-1.5">
              Uploaded files are stored on Desync storage — Discord links expire after a few days
            </div>
          </div>
          {form.kind === "account" && (
            <div>
              <label className={labelCls}>Account type</label>
              <Select value={form.account_type || "discord"} onValueChange={(v) => set("account_type", v)}>
                <SelectTrigger data-testid="product-form-account-type" className={fieldCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
                  <SelectItem value="discord">Discord (email:email pass:discord pass:token)</SelectItem>
                  <SelectItem value="steam">Steam (username | password | email | email pass | webmail)</SelectItem>
                  <SelectItem value="rockstar">Rockstar (email | password | 2FA key | redeem link)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {form.kind !== "account" && (
            <>
              <div>
                <label className={labelCls}>Status</label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger data-testid="admin-status-select" className={fieldCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
                    <SelectItem value="undetected">Undetected</SelectItem>
                    <SelectItem value="updating">Updating</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                    <SelectItem value="detected">Detected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelCls}>Anti-Cheat Target</label>
                <Input value={form.anticheat} onChange={(e) => set("anticheat", e.target.value)} placeholder="EAC / FiveM Guard" data-testid="product-form-anticheat" className={fieldCls} />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className={labelCls}>Features (comma separated)</label>
            <Input value={form.features} onChange={(e) => set("features", e.target.value)} placeholder="Aimbot, ESP, Stream Proof" data-testid="product-form-features" className={fieldCls} />
          </div>
          {form.kind !== "account" && (
          <div className="sm:col-span-2">
            <label className={labelCls}>Loader — upload a file (.exe/.zip) or paste a download link</label>
            {initial?.loader && !removeLoader ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#050B18] border border-slate-700" data-testid="product-form-loader-current">
                <span className="font-mono text-sm text-slate-200 flex-1 truncate">{initial.loader.filename}</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {initial.loader.link ? "external link" : `${(initial.loader.size / 1024 / 1024).toFixed(1)} MB`}
                </span>
                <button
                  type="button"
                  onClick={() => setRemoveLoader(true)}
                  data-testid="product-form-loader-remove"
                  className="text-xs font-mono text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                {removeLoader && (
                  <div className="text-[10px] font-mono text-amber-400 mb-1.5">Current loader will be removed on save unless you pick a new one or set a link</div>
                )}
                <input
                  type="file"
                  accept=".exe,.zip"
                  onChange={(e) => setLoaderFile(e.target.files[0] || null)}
                  data-testid="product-form-loader"
                  className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-400 file:px-4 file:py-2 file:text-xs file:font-mono file:font-bold file:uppercase file:text-[#050B18] hover:file:bg-blue-300 file:cursor-pointer"
                />
                {loaderFile && (
                  <div className="text-[10px] font-mono text-emerald-400 mt-1.5" data-testid="product-form-loader-selected">
                    {loaderFile.name} — uploads on save
                  </div>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">or</span>
                  <Input
                    value={form.loader_link || ""}
                    onChange={(e) => set("loader_link", e.target.value)}
                    placeholder="https://download link for the loader (must start https://)"
                    data-testid="product-form-loader-link"
                    className={`${fieldCls} flex-1`}
                  />
                </div>
              </>
            )}
          </div>
          )}
          {["day", "week", "month", "lifetime"].map((d) => (
            <div key={d}>
              <label className={labelCls}>{DURATION_LABELS[d]} Price (€) — blank to hide</label>
              <Input type="number" step="0.01" value={form.prices[d]} onChange={(e) => setPrice(d, e.target.value)} data-testid={`product-form-price-${d}`} className={fieldCls} />
            </div>
          ))}
          <div>
            <label className={labelCls}>Sort Order</label>
            <Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} data-testid="product-form-sort" className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Min per purchase (e.g. 5 for account packs)</label>
            <Input type="number" min="1" value={form.min_buy} onChange={(e) => set("min_buy", e.target.value)} data-testid="product-form-min-buy" className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Delivery method</label>
            <Select value={form.delivery || "stock"} onValueChange={(v) => set("delivery", v)}>
              <SelectTrigger data-testid="product-form-delivery" className={fieldCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
                <SelectItem value="stock">Stocked keys — limited inventory</SelectItem>
                <SelectItem value="ticket">Discord ticket — infinite, never sold out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.delivery === "ticket" && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Discord ticket link</label>
              <Input value={form.ticket_url} onChange={(e) => set("ticket_url", e.target.value)} placeholder="https://discord.gg/de-sync" data-testid="product-form-ticket-url" className={fieldCls} />
              <div className="text-[10px] font-mono text-slate-500 mt-1.5">
                Buyers are sent here to open a ticket after payment — no keys needed, never sold out
              </div>
            </div>
          )}
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set("active", e.target.checked)}
                data-testid="product-form-active"
                className="w-4 h-4 accent-blue-400"
              />
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Visible in store</span>
            </label>
          </div>
        </div>
        <button
          onClick={save}
          data-testid="product-form-save"
          className="rounded-lg mt-6 w-full px-6 py-3 bg-blue-400 text-[#050B18] font-mono text-sm font-bold uppercase tracking-widest hover:bg-blue-300 transition-all"
        >
          Save Product
        </button>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} (new) | product
  const [newKind, setNewKind] = useState("cheat");
  const [keysFor, setKeysFor] = useState(null); // product whose keys are being managed
  const [stockCounts, setStockCounts] = useState({});
  const [categories, setCategories] = useState([]);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [bank, setBank] = useState({ payid: "", bank_bsb: "", bank_account_number: "", bank_account_name: "" });
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "admin" });
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/auth/me")
      .then(({ data }) => {
        setAdmin(data);
        loadProducts();
        loadOrders();
        loadSettings();
        loadCategories();
        if (data.role === "owner") loadUsers();
      })
      .catch(() => {
        localStorage.removeItem("void_admin_token");
        navigate("/admin");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProducts = () => {
    api.get("/admin/products").then(({ data }) => setProducts(data)).catch(() => {});
    loadStockCounts();
  };
  const loadStockCounts = () =>
    api.get("/admin/keystock/counts").then(({ data }) => setStockCounts(data)).catch(() => {});
  const loadOrders = () => api.get("/admin/orders").then(({ data }) => setOrders(data)).catch(() => {});
  const loadSettings = () => api.get("/admin/settings").then(({ data }) => {
    setNotifyEmail(data.notify_email || "");
    setBank({
      payid: data.payid || "", bank_bsb: data.bank_bsb || "",
      bank_account_number: data.bank_account_number || "", bank_account_name: data.bank_account_name || "",
    });
  }).catch(() => {});
  const saveSettings = async () => {
    try {
      await api.put("/admin/settings", { notify_email: notifyEmail, ...bank });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const loadUsers = () => api.get("/admin/users").then(({ data }) => setUsers(data)).catch(() => {});
  const loadCategories = () => api.get("/categories").then(({ data }) => setCategories(data)).catch(() => {});

  const saveProduct = async (payload, loaderFile, removeLoader, imageFile) => {
    try {
      let productId;
      if (editing && editing.id) {
        const { data } = await api.put(`/admin/products/${editing.id}`, payload);
        productId = data.id;
        toast.success("Product updated");
      } else {
        const { data } = await api.post("/admin/products", payload);
        productId = data.id;
        toast.success("Product created");
      }
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        await api.post(`/admin/products/${productId}/image`, fd);
        toast.success("Product photo uploaded");
      }
      if (removeLoader) {
        await api.delete(`/admin/products/${productId}/loader`);
        toast.success("Loader removed");
      }
      if (loaderFile) {
        const fd = new FormData();
        fd.append("file", loaderFile);
        await api.post(`/admin/products/${productId}/loader`, fd);
        toast.success("Loader uploaded");
      }
      setEditing(null);
      loadProducts();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const deleteProduct = async (p) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    try {
      await api.delete(`/admin/products/${p.id}`);
      toast.success("Product deleted");
      loadProducts();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const createUser = async () => {
    try {
      await api.post("/admin/users", newUser);
      toast.success(`Admin '${newUser.username}' created`);
      setNewUser({ username: "", password: "", role: "admin" });
      loadUsers();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Remove admin '${u.username}'?`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success("Admin removed");
      loadUsers();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const logout = () => {
    localStorage.removeItem("void_admin_token");
    navigate("/admin");
  };

  const assignKeys = async (orderId) => {
    try {
      const { data } = await api.post(`/admin/orders/${orderId}/assign-keys`);
      if (data.assigned > 0) {
        toast.success(`${data.assigned} key${data.assigned === 1 ? "" : "s"} assigned and emailed to the buyer`);
      } else {
        toast.error("No keys available in the matching pools");
      }
      loadOrders();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const resendEmail = async (orderId) => {
    try {
      const { data } = await api.post(`/admin/orders/${orderId}/resend-email`);
      toast.success(`Delivery email resent to ${data.email}`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const markPaid = async (orderId) => {
    try {
      await api.post(`/admin/orders/${orderId}/mark-paid`);
      toast.success("Marked paid — key assigned and emailed to the buyer");
      loadOrders();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const cancelOrder = async (orderId) => {
    if (!window.confirm("Cancel this order? Reserved stock goes back on sale and the buyer is emailed.")) return;
    try {
      await api.post(`/admin/orders/${orderId}/cancel`);
      toast.success("Order cancelled — stock released");
      loadOrders();
    } catch (e) {
      toast.error(apiError(e));
    }
  };


  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-sm text-slate-500 uppercase tracking-[0.25em]">
        Authenticating...
      </div>
    );
  }

  const fieldCls = "bg-[#050B18] border-slate-700 focus-visible:ring-blue-400 font-mono text-sm";

  return (
    <div className="min-h-screen" data-testid="admin-dashboard">
      <header className="border-b border-blue-500/10 bg-[#0A1628]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/logo.svg" alt="Desync logo" className="w-7 h-7 rounded-lg" />
            <span className="font-display font-extrabold tracking-tight">De<span className="text-blue-400">sync</span> Console</span>
            <span className="ml-3 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              {admin.username} // {admin.role}
            </span>
          </div>
          <button onClick={logout} data-testid="admin-logout-button" className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-rose-400 transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <SalesStats />
        <Tabs defaultValue="products">
          <TabsList className="bg-[#0F1F38] border border-blue-900/40 mb-8">
            <TabsTrigger value="products" data-testid="admin-tab-products" className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-blue-400 data-[state=active]:text-[#050B18]">Products</TabsTrigger>
            <TabsTrigger value="categories" data-testid="admin-tab-categories" className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-blue-400 data-[state=active]:text-[#050B18]">Categories</TabsTrigger>
            <TabsTrigger value="orders" data-testid="admin-tab-orders" className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-blue-400 data-[state=active]:text-[#050B18]">Orders</TabsTrigger>
            <TabsTrigger value="coupons" data-testid="admin-tab-coupons" className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-blue-400 data-[state=active]:text-[#050B18]">Coupons</TabsTrigger>
            <TabsTrigger value="customers" data-testid="admin-tab-customers" className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-blue-400 data-[state=active]:text-[#050B18]">Customers</TabsTrigger>
            <TabsTrigger value="expenses" data-testid="admin-tab-expenses" className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-blue-400 data-[state=active]:text-[#050B18]">Expenses</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="admin-tab-alerts" className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-blue-400 data-[state=active]:text-[#050B18]">Alerts</TabsTrigger>
            {admin.role === "owner" && (
              <TabsTrigger value="staff" data-testid="admin-tab-staff" className="font-mono text-xs uppercase tracking-widest data-[state=active]:bg-blue-400 data-[state=active]:text-[#050B18]">Staff</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="products">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight">{products.length} Products</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => { setNewKind("cheat"); setEditing({}); }}
                  data-testid="admin-add-product-button"
                  className="rounded-lg inline-flex items-center gap-2 px-4 py-2 bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Cheat
                </button>
                <button
                  onClick={() => { setNewKind("account"); setEditing({}); }}
                  data-testid="admin-add-account-button"
                  className="rounded-lg inline-flex items-center gap-2 px-4 py-2 bg-violet-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-violet-300 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Account
                </button>
              </div>
            </div>
            <div className="space-y-3" data-testid="admin-products-list">
              {products.map((p) => (
                <div key={p.id} className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-[#0F1F38] border border-blue-900/40 rounded-lg" data-testid={`admin-product-row-${p.id}`}>
                  <img src={p.image_url} alt="" className="w-16 h-16 object-cover rounded-md saturate-[0.7]" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-100">{p.name}</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      {p.game} // {Object.entries(p.prices || {}).map(([k, v]) => `${DURATION_LABELS[k]} ${eur(v)}`).join(" · ")}
                      {!p.active && <span className="text-rose-400 ml-2">HIDDEN</span>}
                    </div>
                  </div>
                  {p.kind === "account" ? (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-violet-400/10 border border-violet-400/40 text-violet-300 font-mono uppercase tracking-widest" data-testid={`admin-product-kind-${p.id}`}>
                      Account
                    </span>
                  ) : (
                    <StatusPill status={p.status} testid={`admin-product-status-${p.id}`} />
                  )}
                  <button
                    onClick={() => setKeysFor(p)}
                    data-testid={`admin-keys-button-${p.id}`}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      (stockCounts[p.id]?.total || 0) > 0
                        ? "border-[#1E2D4A] text-slate-300 hover:border-[#2E6BFF]/50 hover:text-white"
                        : "border-amber-400/40 text-amber-300 hover:border-amber-400"
                    }`}
                  >
                    {stockCounts[p.id]?.total || 0} keys · Manage
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(p)} data-testid={`admin-edit-product-${p.id}`} className="p-2 border border-blue-500/30 text-blue-300 hover:bg-blue-400/10 rounded transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteProduct(p)} data-testid={`admin-delete-product-${p.id}`} className="p-2 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="categories">
            <CategoriesTab onChanged={loadCategories} />
          </TabsContent>

          <TabsContent value="orders">
            <div className="mb-4 p-4 bg-[#0F1F38] border border-[#1E2D4A] rounded-lg flex flex-col sm:flex-row sm:items-center gap-3" data-testid="low-stock-settings">
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">Low-stock alerts</div>
                <div className="text-xs text-slate-500">Get emailed when any product + duration pool drops to 4 keys, and again at 0</div>
              </div>
              <Input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="you@example.com"
                data-testid="notify-email-input"
                className="sm:w-72 bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] h-10"
              />
              <button
                onClick={saveSettings}
                data-testid="notify-email-save"
                className="px-5 py-2.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold transition-all duration-200"
              >
                Save
              </button>
            </div>
            <div className="mb-6 p-4 bg-[#0F1F38] border border-[#1E2D4A] rounded-lg" data-testid="bank-settings">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">Bank transfer details</div>
                  <div className="text-xs text-slate-500">Shown to buyers who choose Bank Transfer (PayID / BSB) at checkout</div>
                </div>
                <button
                  onClick={saveSettings}
                  data-testid="bank-settings-save"
                  className="px-5 py-2.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold transition-all duration-200"
                >
                  Save
                </button>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <Input value={bank.payid} onChange={(e) => setBank({ ...bank, payid: e.target.value })} placeholder="PayID (email/phone)" data-testid="bank-payid-input" className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] h-10 font-mono text-sm" />
                <Input value={bank.bank_bsb} onChange={(e) => setBank({ ...bank, bank_bsb: e.target.value })} placeholder="BSB" data-testid="bank-bsb-input" className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] h-10 font-mono text-sm" />
                <Input value={bank.bank_account_number} onChange={(e) => setBank({ ...bank, bank_account_number: e.target.value })} placeholder="Account number" data-testid="bank-account-number-input" className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] h-10 font-mono text-sm" />
                <Input value={bank.bank_account_name} onChange={(e) => setBank({ ...bank, bank_account_name: e.target.value })} placeholder="Account name" data-testid="bank-account-name-input" className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] h-10 font-mono text-sm" />
              </div>
            </div>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight mb-6">{orders.length} Orders</h2>
            <div className="space-y-3" data-testid="admin-orders-list">
              {orders.length === 0 && (
                <div className="text-center py-16 font-mono text-sm text-slate-500 uppercase tracking-[0.25em]">No orders yet</div>
              )}
              {orders.map((o) => (
                <div key={o.id} className="p-4 bg-[#0F1F38] border border-blue-900/40 rounded-lg" data-testid={`admin-order-row-${o.id}`}>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
                    <span className="font-mono text-sm text-blue-300">{o.email}</span>
                    {o.discord_username && (
                      <span className="text-xs font-mono text-violet-300" data-testid={`order-discord-${o.id}`}>discord: {o.discord_username}</span>
                    )}
                    <span className="font-mono text-sm font-bold text-slate-100">{eur(o.total)}</span>
                    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border rounded-lg ${
                      o.payment_status === "paid" ? "text-emerald-400 border-emerald-400/40"
                      : o.payment_status === "cancelled" ? "text-rose-400 border-rose-400/40"
                      : o.payment_status === "awaiting_payment" ? "text-sky-300 border-sky-400/40"
                      : "text-amber-400 border-amber-400/40"
                    }`}>
                      {o.payment_status === "awaiting_payment" ? "awaiting bank transfer" : o.payment_status}
                    </span>
                    {o.provider === "bank_transfer" && o.reference && (
                      <span className="text-[10px] font-mono text-slate-500" data-testid={`order-reference-${o.id}`}>ref {o.reference}</span>
                    )}
                    {o.payment_reported && o.payment_status === "awaiting_payment" && (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg bg-emerald-400/10 border border-emerald-400/50 text-emerald-300" data-testid={`payment-reported-${o.id}`}>
                        buyer says paid
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-600">{new Date(o.created_at).toLocaleString()}</span>
                    {o.payment_status === "awaiting_payment" && o.provider === "bank_transfer" && (
                      <>
                        <button
                          onClick={() => markPaid(o.id)}
                          data-testid={`mark-paid-${o.id}`}
                          className="px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/40 text-emerald-300 text-xs font-medium hover:bg-emerald-400/20 transition-colors"
                        >
                          Payment arrived — mark paid
                        </button>
                        <button
                          onClick={() => cancelOrder(o.id)}
                          data-testid={`cancel-order-${o.id}`}
                          className="px-3 py-1.5 rounded-lg bg-rose-400/10 border border-rose-400/40 text-rose-300 text-xs font-medium hover:bg-rose-400/20 transition-colors"
                        >
                          Cancel & release stock
                        </button>
                      </>
                    )}
                    {o.keys_pending && (
                      <button
                        onClick={() => assignKeys(o.id)}
                        data-testid={`assign-keys-${o.id}`}
                        className="px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/40 text-amber-300 text-xs font-medium hover:bg-amber-400/20 transition-colors"
                      >
                        Keys pending — assign now
                      </button>
                    )}
                    {o.payment_status === "paid" && (
                      <button
                        onClick={() => resendEmail(o.id)}
                        data-testid={`resend-email-${o.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-400/10 border border-blue-400/40 text-blue-300 text-xs font-medium hover:bg-blue-400/20 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" /> Resend email
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {o.items.map((it, i) => (
                      <div key={i} className="text-xs font-mono text-slate-400">
                        {it.name} ({it.duration_label})
                        {it.license_key && <span className="text-blue-400 ml-2">{it.license_key}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="coupons">
            <CouponsTab />
          </TabsContent>

          <TabsContent value="customers">
            <CustomersTab />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpensesTab />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsTab />
          </TabsContent>

          {admin.role === "owner" && (
            <TabsContent value="staff">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight mb-6">Staff Accounts</h2>
              <div className="p-5 bg-[#0F1F38] border border-blue-900/40 rounded-lg mb-6">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-4">Create admin — they log in at /admin with this username & password</div>
                <div className="grid sm:grid-cols-4 gap-3">
                  <Input value={newUser.username} onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))} placeholder="username" data-testid="staff-username-input" className={fieldCls} />
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} placeholder="password (6+ chars)" data-testid="staff-password-input" className={fieldCls} />
                  <Select value={newUser.role} onValueChange={(v) => setNewUser((u) => ({ ...u, role: v }))}>
                    <SelectTrigger data-testid="staff-role-select" className={fieldCls}><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={createUser} data-testid="staff-create-button" className="rounded-lg px-4 py-2 bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 transition-all">
                    Create
                  </button>
                </div>
              </div>
              <div className="space-y-2" data-testid="staff-list">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 p-3 bg-[#0F1F38] border border-blue-900/40 rounded-lg">
                    <span className="font-mono text-sm text-slate-100 flex-1">{u.username}</span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400">{u.role}</span>
                    {u.username !== admin.username && (
                      <button onClick={() => deleteUser(u)} data-testid={`staff-delete-${u.username}`} className="p-1.5 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {keysFor && (
        <KeyManager
          product={keysFor}
          onClose={() => setKeysFor(null)}
          onChanged={loadStockCounts}
        />
      )}

      {editing !== null && (
        <ProductForm
          initial={editing.id ? editing : { ...EMPTY_PRODUCT, kind: newKind }}
          categories={categories}
          onSave={saveProduct}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
