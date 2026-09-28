import { useEffect, useState } from "react";
import { UserPlus, KeyRound, Send, Search, Zap, RefreshCw, Ban, CheckCircle, Trash2, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ScrollModal from "@/components/ScrollModal";
import { api, apiError, aud } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { DURATION_LABELS } from "@/context/CartContext";

const DURATION_ORDER = ["day", "3d", "week", "month", "lifetime"];
const GEN_TYPES = [["steam", "Steam"], ["discord", "Discord"], ["rockstar", "Rockstar"]];

export default function CustomersTab() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(null);
  const [sendProduct, setSendProduct] = useState("");
  const [sendDuration, setSendDuration] = useState("");
  const [sendQty, setSendQty] = useState(1);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState(null); // null = show all customers list
  const [profile, setProfile] = useState(null); // profile data or null
  const [importEmail, setImportEmail] = useState("");
  const [pools, setPools] = useState({ steam: "", discord: "", rockstar: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/customers").then(({ data }) => setCustomers(data)).catch(() => {});

  useEffect(() => {
    load();
    api.get("/admin/products").then(({ data }) => setProducts(data)).catch(() => {});
    api.get("/admin/settings").then(({ data }) => {
      const p = data.gen_pools || {};
      setPools({ steam: p.steam || "", discord: p.discord || "", rockstar: p.rockstar || "" });
    }).catch(() => {});
  }, []);

  const search = async () => {
    if (query.trim().length < 2) {
      setMatches(null);
      return;
    }
    try {
      const { data } = await api.get("/admin/customers/search", { params: { q: query.trim() } });
      setMatches(data);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const openProfile = async (em) => {
    try {
      const { data } = await api.get(`/admin/customers/${encodeURIComponent(em)}/profile`);
      setProfile(data);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const genAction = async (action) => {
    if (!profile) return;
    const em = profile.customer?.email || profile.orders[0]?.email;
    setBusy(true);
    try {
      await api.post(`/admin/customers/${encodeURIComponent(em)}/generator`, { action });
      toast.success(`Done: ${action.replace("_", " ")}`);
      await openProfile(em);
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const importGen = async () => {
    if (!importEmail.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/customers/import-generator", { email: importEmail.trim() });
      toast.success(`Generator access granted — key ${data.key}`);
      setImportEmail("");
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const savePools = async () => {
    try {
      await api.put("/admin/settings", { gen_pools: Object.fromEntries(Object.entries(pools).filter(([, v]) => v)) });
      toast.success("Generator pools saved");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const add = async () => {
    if (!email.trim()) return;
    try {
      await api.post("/admin/customers", { email: email.trim(), name: name.trim() || null, note: note.trim() || null });
      toast.success("Customer saved");
      setEmail(""); setName(""); setNote("");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const sendKey = async () => {
    if (!sendProduct || !sendDuration) {
      toast.error("Pick a product and duration");
      return;
    }
    try {
      const { data } = await api.post("/admin/customers/send-key", {
        email: sending.email, product_id: sendProduct, duration: sendDuration, qty: sendQty,
      });
      toast.success(`${data.sent_count} key${data.sent_count === 1 ? "" : "s"} emailed to ${sending.email}`);
      setSending(null);
      setSendProduct(""); setSendDuration(""); setSendQty(1);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const fieldCls = "bg-[#050B18] border-slate-700 focus-visible:ring-blue-400 font-mono text-sm";
  const selectedProduct = products.find((p) => p.id === sendProduct);
  const durations = selectedProduct
    ? DURATION_ORDER.filter((d) => selectedProduct.prices?.[d] != null)
    : [];
  const accountProducts = products.filter((p) => p.kind === "account");
  const visible = matches === null ? customers : customers.filter((c) => matches.includes(c.email));
  const g = profile?.generator;

  return (
    <div data-testid="customers-tab">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight">
          {customers.length} Customers
        </h2>
        <div className="flex-1 min-w-56 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search email, order ID, generator key..."
            data-testid="customer-search-input"
            className={fieldCls}
          />
          <button
            onClick={search}
            data-testid="customer-search-button"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1E2D4A] text-xs font-mono uppercase tracking-widest text-slate-300 hover:border-blue-400/50 hover:text-white transition-all"
          >
            <Search className="w-3.5 h-3.5" /> Search
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="p-5 bg-[#0F1F38] border border-blue-900/40 rounded-lg">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-4">
            Import existing Generator customer — access on, key auto-generated, no purchase needed
          </div>
          <div className="flex gap-3">
            <Input value={importEmail} onChange={(e) => setImportEmail(e.target.value)} placeholder="their email" data-testid="gen-import-email" className={fieldCls} />
            <button
              onClick={importGen}
              disabled={busy || !importEmail.trim()}
              data-testid="gen-import-button"
              className="shrink-0 rounded-lg inline-flex items-center gap-2 px-4 py-2 bg-violet-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-violet-300 disabled:opacity-40 transition-all"
            >
              <Zap className="w-4 h-4" /> Import
            </button>
          </div>
        </div>
        <div className="p-5 bg-[#0F1F38] border border-blue-900/40 rounded-lg">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-4">
            Generator stock pools — which product's stock feeds each account type
          </div>
          <div className="grid grid-cols-3 gap-2">
            {GEN_TYPES.map(([t, label]) => (
              <div key={t}>
                <div className="text-[10px] font-mono text-slate-500 mb-1">{label}</div>
                <Select value={pools[t] || "auto"} onValueChange={(v) => setPools((p) => ({ ...p, [t]: v === "auto" ? "" : v }))}>
                  <SelectTrigger data-testid={`gen-pool-${t}`} className={fieldCls}>
                    <SelectValue placeholder="Auto" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
                    <SelectItem value="auto">Auto (name match)</SelectItem>
                    {accountProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <button
            onClick={savePools}
            data-testid="gen-pools-save"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 transition-all"
          >
            Save pools
          </button>
        </div>
      </div>

      <div className="p-5 bg-[#0F1F38] border border-blue-900/40 rounded-lg mb-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-4">
          Add a customer manually (e.g. Discord buyers) — then use Send key to email them a license
        </div>
        <div className="grid sm:grid-cols-4 gap-3">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" data-testid="customer-email-input" className={fieldCls} />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name / Discord tag" data-testid="customer-name-input" className={fieldCls} />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" data-testid="customer-note-input" className={fieldCls} />
          <button
            onClick={add}
            disabled={!email.trim()}
            data-testid="customer-add-button"
            className="rounded-lg inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 disabled:opacity-40 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      <div className="space-y-2" data-testid="customers-list">
        {visible.length === 0 && (
          <div className="text-center py-16 font-mono text-sm text-slate-500 uppercase tracking-[0.25em]" data-testid="customers-empty">
            {matches === null ? "No customers yet" : "No customers match that search"}
          </div>
        )}
        {visible.map((c) => (
          <div
            key={c.email}
            className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4 bg-[#0F1F38] border border-blue-900/40 rounded-lg"
            data-testid={`customer-row-${c.email}`}
          >
            <div className="flex-1 min-w-48">
              <div className="font-mono text-sm text-slate-100 truncate">{c.email}</div>
              {(c.name || c.note) && (
                <div className="text-[11px] text-slate-500 truncate">
                  {[c.name, c.note].filter(Boolean).join(" — ")}
                </div>
              )}
            </div>
            <span className="font-mono text-sm font-bold text-[#8FB8E8]" data-testid={`customer-spent-${c.email}`}>
              {aud(c.total_spent)}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              {c.orders} order{c.orders === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => openProfile(c.email)}
              data-testid={`customer-manage-${c.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-400/10 border border-violet-400/40 text-violet-300 text-xs font-medium hover:bg-violet-400/20 transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Manage
            </button>
            <button
              onClick={() => setSending(c)}
              data-testid={`customer-send-key-${c.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-400/10 border border-blue-400/40 text-blue-300 text-xs font-medium hover:bg-blue-400/20 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" /> Send key
            </button>
          </div>
        ))}
      </div>

      {profile && (
        <ScrollModal onClose={() => setProfile(null)} testid="customer-profile-modal" className="max-w-3xl">
          <h2 className="font-display text-xl font-bold tracking-tight text-white mb-1 flex items-center gap-3 flex-wrap">
            {profile.customer?.email || "Unknown"}
            {profile.customer?.disabled && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/40 text-rose-300" data-testid="profile-disabled-badge">DISABLED</span>
            )}
          </h2>
          <div className="text-[11px] font-mono text-slate-500 mb-5">
            {profile.customer?.created_at ? `customer since ${new Date(profile.customer.created_at).toLocaleDateString()}` : "no customer record yet"}
            {" · "}{profile.orders.length} order{profile.orders.length === 1 ? "" : "s"}
            {" · "}{aud(profile.orders.filter((o) => o.payment_status === "paid").reduce((s, o) => s + (o.total || 0), 0))} paid
          </div>

          <div className="p-4 rounded-lg bg-[#050B18] border border-[#1E2D4A] mb-4" data-testid="profile-generator">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-violet-300" /> Generator
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${g.access ? "bg-emerald-400/10 border-emerald-400/40 text-emerald-300" : "bg-slate-500/10 border-slate-500/40 text-slate-400"}`} data-testid="profile-gen-status">
                {g.access ? `ACTIVE (${g.source || "manual"})` : "OFF"}
              </span>
            </div>
            {g.key && (
              <div className="font-mono text-xs text-[#8FB8E8] mb-2" data-testid="profile-gen-key">
                {g.key} {!g.key_active && <span className="text-rose-400">(revoked)</span>}
              </div>
            )}
            <div className="flex gap-3 text-[11px] font-mono text-slate-500 mb-3">
              {GEN_TYPES.map(([t, label]) => (
                <span key={t} data-testid={`profile-usage-${t}`}>{label}: {g.used[t] || 0}/{g.limits[t] || 0} this hour</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {g.access ? (
                <button onClick={() => genAction("revoke")} disabled={busy} data-testid="gen-action-revoke" className="px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 text-xs hover:bg-rose-500/10 transition-colors disabled:opacity-40">Revoke access</button>
              ) : (
                <button onClick={() => genAction("grant")} disabled={busy} data-testid="gen-action-grant" className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs hover:bg-emerald-500/10 transition-colors disabled:opacity-40">Grant access</button>
              )}
              <button onClick={() => genAction("regenerate_key")} disabled={busy} data-testid="gen-action-regenerate" className="px-3 py-1.5 rounded-lg border border-[#2E6BFF]/40 text-[#8FB8E8] text-xs hover:bg-[#2E6BFF]/10 transition-colors disabled:opacity-40 inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Regenerate key
              </button>
              <button onClick={() => genAction("reset_usage")} disabled={busy} data-testid="gen-action-reset" className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-300 text-xs hover:bg-amber-500/10 transition-colors disabled:opacity-40">Reset usage</button>
              {profile.customer?.disabled ? (
                <button onClick={() => genAction("enable")} disabled={busy} data-testid="gen-action-enable" className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs hover:bg-emerald-500/10 transition-colors disabled:opacity-40 inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Enable</button>
              ) : (
                <button onClick={() => genAction("disable")} disabled={busy} data-testid="gen-action-disable" className="px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 text-xs hover:bg-rose-500/10 transition-colors disabled:opacity-40 inline-flex items-center gap-1"><Ban className="w-3 h-3" /> Disable</button>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-[#050B18] border border-[#1E2D4A]">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">Recent generations</div>
              {profile.gen_history.length === 0 ? (
                <div className="text-xs text-slate-600">none yet</div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto" data-testid="profile-gen-history">
                  {profile.gen_history.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${h.success ? "bg-emerald-400" : "bg-rose-400"}`} />
                      <span className="text-slate-300 capitalize">{h.type}</span>
                      <span className="text-slate-600 font-mono">{new Date(h.ts).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 rounded-lg bg-[#050B18] border border-[#1E2D4A]">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">Audit trail</div>
              {profile.audit.length === 0 ? (
                <div className="text-xs text-slate-600">no admin actions recorded</div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto" data-testid="profile-audit">
                  {profile.audit.map((a) => (
                    <div key={a.id} className="text-[11px] text-slate-400">
                      <span className="text-slate-600 font-mono">{new Date(a.ts).toLocaleString()}</span>{" "}
                      <span className="text-[#8FB8E8]">{a.admin}</span> {a.action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-[#050B18] border border-[#1E2D4A]">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">Orders</div>
            <div className="space-y-1 max-h-48 overflow-y-auto" data-testid="profile-orders">
              {profile.orders.length === 0 && <div className="text-xs text-slate-600">no orders</div>}
              {profile.orders.map((o) => (
                <div key={o.id} className="flex items-center gap-3 text-[11px]">
                  <span className="font-mono text-slate-500">{o.id.slice(0, 8)}</span>
                  <span className="text-slate-300 truncate flex-1">{o.items?.map((i) => i.name).join(", ")}</span>
                  <span className="font-mono text-slate-400">{aud(o.total)}</span>
                  <span className={`font-mono text-[10px] uppercase ${o.payment_status === "paid" ? "text-emerald-400" : "text-slate-500"}`}>{o.payment_status}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollModal>
      )}

      <Dialog open={!!sending} onOpenChange={(open) => !open && setSending(null)}>
        <DialogContent className="bg-[#0A1628] border-[#1E2D4A] text-slate-100 sm:max-w-md" data-testid="send-key-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold tracking-tight text-white">
              Send a key
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-slate-500 font-mono mb-4">{sending?.email}</div>
          <div className="space-y-3">
            <Select value={sendProduct} onValueChange={(v) => { setSendProduct(v); setSendDuration(""); }}>
              <SelectTrigger data-testid="send-key-product" className={fieldCls}>
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sendDuration} onValueChange={setSendDuration} disabled={!sendProduct}>
              <SelectTrigger data-testid="send-key-duration" className={fieldCls}>
                <SelectValue placeholder="Duration" />
              </SelectTrigger>
              <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
                {durations.map((d) => (
                  <SelectItem key={d} value={d}>{DURATION_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1.5">
                How many to send
              </label>
              <Input
                type="number"
                min="1"
                max="100"
                value={sendQty}
                onChange={(e) => setSendQty(Math.max(1, parseInt(e.target.value) || 1))}
                data-testid="send-key-qty"
                className={fieldCls}
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pulls {sendQty > 1 ? `${sendQty} keys/accounts` : "one key"} from stock, records a $0 order, and emails everything with download links.
            </p>
            <button
              onClick={sendKey}
              disabled={!sendProduct || !sendDuration}
              data-testid="send-key-submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" /> Email the key
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
