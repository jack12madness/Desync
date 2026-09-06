import { useEffect, useState } from "react";
import { Trash2, Plus, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { DURATION_LABELS } from "@/context/CartContext";

const DURATIONS = ["day", "week", "month", "lifetime"];

export default function KeyManager({ product, onClose, onChanged }) {
  const isAccountProduct = product.kind === "account";
  const [keys, setKeys] = useState(null);
  const [input, setInput] = useState("");
  const [duration, setDuration] = useState(() => {
    const ds = DURATIONS.filter((d) => product.prices && product.prices[d] != null);
    return ds[0] || "day";
  });
  const [mode, setMode] = useState(isAccountProduct ? "accounts" : "keys");
  const [adding, setAdding] = useState(false);

  const load = () =>
    api.get(`/admin/keystock/${product.id}`).then(({ data }) => setKeys(data)).catch(() => setKeys([]));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const addKeys = async () => {
    if (!input.trim()) return;
    setAdding(true);
    try {
      const { data } = await api.post("/admin/keystock", { product_id: product.id, duration, keys: input, mode });
      const noun = mode === "accounts" ? "account" : "key";
      toast.success(`${data.added} ${noun}${data.added === 1 ? "" : "s"} added to ${DURATION_LABELS[duration]}${data.skipped ? `, ${data.skipped} duplicates skipped` : ""}${data.invalid ? `, ${data.invalid} invalid lines skipped` : ""}`);
      setInput("");
      load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setAdding(false);
    }
  };

  const removeKey = async (k) => {
    try {
      await api.delete(`/admin/keystock/${k.id}`);
      toast.success("Key removed");
      load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const countFor = (d) => (keys || []).filter((k) => k.status === "available" && k.duration === d).length;
  const productDurations = DURATIONS.filter((d) => product.prices && product.prices[d] != null);
  const sorted = [...(keys || [])].sort((a, b) => (a.duration || "").localeCompare(b.duration || ""));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0A1628] border-[#1E2D4A] text-slate-100 max-h-[85vh] overflow-y-auto rounded-xl" data-testid="key-manager-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#5B8CFF]" /> Key Stock — {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 mt-1" data-testid="keys-count">
          {productDurations.map((d) => (
            <span
              key={d}
              data-testid={`keys-count-${d}`}
              className={`px-3 py-1 rounded-full border text-xs font-medium ${
                countFor(d) > 0
                  ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-300"
                  : "bg-amber-400/10 border-amber-400/30 text-amber-300"
              }`}
            >
              {DURATION_LABELS[d]}: {countFor(d)}
            </span>
          ))}
          <span className="text-xs text-slate-500 ml-1">One key per sale, first in first out</span>
        </div>

        <div className="mt-5">
          {!isAccountProduct && (
          <div className="flex gap-2 mb-3" data-testid="keys-mode-toggle">
            {[["keys", "License keys"], ["accounts", "Discord accounts"]].map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setInput(""); }}
                data-testid={`keys-mode-${m}`}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-widest border transition-all ${
                  mode === m
                    ? "bg-blue-400 text-[#050B18] border-blue-400"
                    : "border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          )}
          <label className="text-sm text-slate-300 block mb-2">
            {mode === "keys"
              ? "Add keys — one per line, into a duration pool"
              : product.account_type === "rockstar"
                ? "Add Rockstar accounts — one per line: E-Mail: x | Rockstar Password: y | 2FA Key: z | 2FA Redeem: url"
                : product.account_type === "steam"
                ? "Add Steam accounts — one per line as email:password"
                : "Add Discord accounts — one per line as email:email password:discord password:discord token"}
          </label>
          <div className="flex gap-3 mb-3">
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger data-testid="keys-duration-select" className="w-44 bg-[#050B18] border-[#1E2D4A]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0A1628] border-[#1E2D4A] text-slate-100">
                {productDurations.map((d) => (
                  <SelectItem key={d} value={d} data-testid={`keys-duration-${d}`}>{DURATION_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder={mode === "keys"
              ? "XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY"
              : product.account_type === "rockstar"
                ? "E-Mail: buyer@mail.com | Rockstar Password: pass123 | 2FA Key: ABCDEF123 | 2FA Redeem: https://totp.danhersam.com/"
                : product.account_type === "steam"
                ? "account@mail.com:password123\nanother@mail.com:pass456"
                : "buyer@mail.com:emailpass123:discordpass456:MTIzNDU2.token.xyz\nnext@mail.com:pass2:dpass2:OTk4.token.abc"}
            data-testid="keys-input"
            className="w-full rounded-lg bg-[#050B18] border border-[#1E2D4A] focus:border-[#2E6BFF] focus:outline-none font-mono text-sm p-3 text-slate-100 placeholder:text-slate-600"
          />
          <button
            onClick={addKeys}
            disabled={adding || !input.trim()}
            data-testid="keys-add-button"
            className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold disabled:opacity-40 transition-all duration-200 active:scale-95"
          >
            <Plus className="w-4 h-4" /> {adding ? "Adding..." : `Add to ${DURATION_LABELS[duration]} pool`}
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {keys === null && <div className="text-sm text-slate-500 py-8 text-center">Loading...</div>}
          {keys !== null && keys.length === 0 && (
            <div className="text-sm text-slate-500 py-8 text-center" data-testid="keys-empty">
              No keys yet — paste your supplier keys above
            </div>
          )}
          {sorted.map((k) => (
            <div
              key={k.id}
              data-testid={`key-row-${k.id}`}
              className="flex items-center gap-3 p-3 bg-[#050B18] border border-[#1E2D4A] rounded-lg"
            >
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2E6BFF]/10 border border-[#2E6BFF]/30 text-[#8FB8E8] uppercase tracking-wider shrink-0">
                {DURATION_LABELS[k.duration] || k.duration || "—"}
              </span>
              {k.account && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-400/10 border border-violet-400/30 text-violet-300 uppercase tracking-wider shrink-0">
                  Account
                </span>
              )}
              <code className="font-mono text-sm text-slate-100 flex-1 truncate">{k.key}</code>
              {k.status === "available" ? (
                <>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-300">Available</span>
                  <button
                    onClick={() => removeKey(k)}
                    data-testid={`key-delete-${k.id}`}
                    className="p-1.5 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : k.status === "reserved" ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-sky-400/10 border border-sky-400/30 text-sky-300">
                  Reserved {k.reserved_order_id ? `· ${k.reserved_order_id.slice(0, 8).toUpperCase()}` : ""}
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-600 text-slate-400">
                  Sold {k.assigned_order_id ? `· ${k.assigned_order_id.slice(0, 8).toUpperCase()}` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
