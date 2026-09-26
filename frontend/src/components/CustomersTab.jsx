import { useEffect, useState } from "react";
import { UserPlus, KeyRound, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError, aud } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { DURATION_LABELS } from "@/context/CartContext";

const DURATION_ORDER = ["day", "week", "month", "lifetime"];

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

  const load = () => api.get("/admin/customers").then(({ data }) => setCustomers(data)).catch(() => {});

  useEffect(() => {
    load();
    api.get("/admin/products").then(({ data }) => setProducts(data)).catch(() => {});
  }, []);

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

  return (
    <div data-testid="customers-tab">
      <h2 className="font-display text-xl font-bold uppercase tracking-tight mb-6">
        {customers.length} Customers
      </h2>

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
        {customers.length === 0 && (
          <div className="text-center py-16 font-mono text-sm text-slate-500 uppercase tracking-[0.25em]">
            No customers yet
          </div>
        )}
        {customers.map((c) => (
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
            {c.last_order && (
              <span className="text-[10px] font-mono text-slate-600">
                last: {new Date(c.last_order).toLocaleDateString()}
              </span>
            )}
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
