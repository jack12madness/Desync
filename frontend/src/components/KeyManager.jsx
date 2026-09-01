import { useEffect, useState } from "react";
import { Trash2, Plus, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { DURATION_LABELS } from "@/context/CartContext";

const DURATIONS = ["day", "week", "month", "lifetime"];

export default function KeyManager({ product, onClose, onChanged }) {
  const [keys, setKeys] = useState(null);
  const [input, setInput] = useState("");
  const [duration, setDuration] = useState("day");
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
      const { data } = await api.post("/admin/keystock", { product_id: product.id, duration, keys: input });
      toast.success(`${data.added} key${data.added === 1 ? "" : "s"} added to ${DURATION_LABELS[duration]}${data.skipped ? `, ${data.skipped} duplicates skipped` : ""}`);
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
          <label className="text-sm text-slate-300 block mb-2">Add keys — one per line, into a duration pool</label>
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
            placeholder={"XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY"}
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
