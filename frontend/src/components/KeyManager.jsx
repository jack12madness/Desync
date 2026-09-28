import { useEffect, useState } from "react";
import { Trash2, Plus, KeyRound, Download, Copy, X } from "lucide-react";
import ScrollModal from "@/components/ScrollModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { durLabel, orderedPriceKeys } from "@/context/CartContext";

// price keys ordered by duration length (custom durations slot in naturally)
const orderedDurations = (product) => orderedPriceKeys(product);

export default function KeyManager({ product, onClose, onChanged }) {
  const isAccountProduct = product.kind === "account";
  const [keys, setKeys] = useState(null);
  const [input, setInput] = useState("");
  const [duration, setDuration] = useState(() => orderedDurations(product)[0] || "day");
  const [mode, setMode] = useState(isAccountProduct ? "accounts" : "keys");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState(null); // {added, skipped, raw, duration}
  const [announce, setAnnounce] = useState(true);
  const [announcing, setAnnouncing] = useState(false);
  const [exportData, setExportData] = useState(null); // string[] | null
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    try {
      const { data } = await api.get(`/admin/keystock/${product.id}/export`);
      setExportData(data.lines);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setExporting(false);
    }
  };

  const copyExport = async () => {
    await navigator.clipboard.writeText((exportData || []).join("\n"));
    toast.success(`${exportData.length} line${exportData.length === 1 ? "" : "s"} copied — paste into your gen`);
  };

  const downloadExport = () => {
    const blob = new Blob([(exportData || []).join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${product.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-stock.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const [moving, setMoving] = useState(false);
  const moveToGen = async () => {
    if (!window.confirm(`Copy ${exportData.length} line(s) and REMOVE them from store stock? This is a one-way move to your gen.`)) return;
    setMoving(true);
    try {
      await navigator.clipboard.writeText((exportData || []).join("\n")).catch(() => {});
      const { data } = await api.post(`/admin/keystock/${product.id}/export-move`);
      toast.success(`${data.removed} item${data.removed === 1 ? "" : "s"} copied and removed from store stock`);
      setExportData(null);
      load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setMoving(false);
    }
  };

  const [sendCount, setSendCount] = useState(12);
  const [sendEmail, setSendEmail] = useState("");
  const [sendingStock, setSendingStock] = useState(false);
  const isGeneratorProduct = /generator/i.test(product.name || "");
  const [genCount, setGenCount] = useState(5);
  const [genDuration, setGenDuration] = useState("");
  const [generating, setGenerating] = useState(false);

  const generateKeys = async () => {
    const dur = genDuration || productDurations[0];
    if (!dur) {
      toast.error("This product has no priced durations to stock into");
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post(`/admin/products/${product.id}/generate-keys`, { count: genCount, duration: dur });
      toast.success(`${data.created} DSYNC keys generated into the ${durLabel(product, dur)} pool`);
      load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setGenerating(false);
    }
  };
  const sendStock = async () => {
    const n = Math.max(1, Math.min(parseInt(sendCount) || 0, exportData.length));
    if (!sendEmail.trim()) {
      toast.error("Enter an email to send the stock to");
      return;
    }
    if (!window.confirm(`Email ${n} item(s) to ${sendEmail.trim()} in original paste format and REMOVE them from store stock?`)) return;
    setSendingStock(true);
    try {
      const { data } = await api.post(`/admin/keystock/${product.id}/send-stock`, { count: n, email: sendEmail.trim() });
      toast.success(`${data.sent} item${data.sent === 1 ? "" : "s"} emailed to ${data.email} and removed from stock`);
      await doExport();
      load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSendingStock(false);
    }
  };

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
      setConfirm({ added: data.added, skipped: data.skipped, raw: data.raw, duration, mode });
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
  const productDurations = orderedDurations(product);
  const sorted = [...(keys || [])].sort((a, b) => (a.duration || "").localeCompare(b.duration || ""));
  const isTicket = product.delivery === "ticket";
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const filteredKeys = filter
    ? sorted.filter((k) => (k.key || "").toLowerCase().includes(filter.toLowerCase()))
    : sorted;
  const visibleKeys = showAll ? filteredKeys : filteredKeys.slice(0, 100);

  const finishRestock = async () => {
    if (announce && confirm?.added > 0) {
      setAnnouncing(true);
      try {
        await api.post(`/admin/products/${product.id}/restock-announce`, {
          duration: confirm.duration, added: confirm.added,
        });
        toast.success("Restock announced in Discord");
      } catch (e) {
        toast.error(apiError(e));
        setAnnouncing(false);
        return; // keep the confirm screen open so they can retry or untick
      }
      setAnnouncing(false);
    }
    setConfirm(null);
  };

  if (isTicket) {
    return (
      <ScrollModal onClose={onClose} testid="key-manager-modal" className="max-w-2xl">
        <h2 className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2 mb-4">
          <KeyRound className="w-5 h-5 text-[#5B8CFF]" /> Key Stock — {product.name}
        </h2>
        <div className="p-5 rounded-lg bg-[#050B18] border border-[#2E6BFF]/30 text-sm text-slate-400 leading-relaxed" data-testid="ticket-mode-note">
          This product uses <span className="text-white font-semibold">Discord ticket delivery</span> — infinite
          stock, never sold out. After paying, buyers are sent to{" "}
          <span className="font-mono text-[#8FB8E8]">{product.discord_url || product.ticket_url || "https://discord.gg/de-sync"}</span>{" "}
          to open a ticket. Nothing to manage here.
        </div>
      </ScrollModal>
    );
  }

  if (confirm) {
    const noun = confirm.mode === "accounts" ? "account" : "key";
    return (
      <ScrollModal onClose={() => setConfirm(null)} testid="restock-confirm-modal" className="max-w-md">
        <h2 className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2 mb-4">
          <KeyRound className="w-5 h-5 text-emerald-400" /> Restock complete
        </h2>
          <div className="p-4 rounded-lg bg-[#050B18] border border-[#1E2D4A] space-y-2" data-testid="restock-confirm-summary">
            <div className="text-sm text-slate-300">
              <span className="text-emerald-300 font-mono font-bold">{confirm.added}</span>{" "}
              {noun}{confirm.added === 1 ? "" : "s"} added to{" "}
              <span className="text-white font-semibold">{product.name}</span>{" "}
              <span className="text-slate-500">({durLabel(product, confirm.duration)} pool)</span>
            </div>
            {confirm.skipped > 0 && (
              <div className="text-xs text-amber-300">{confirm.skipped} duplicate{confirm.skipped === 1 ? "" : "s"} skipped</div>
            )}
            {confirm.raw > 0 && (
              <div className="text-xs text-slate-500">{confirm.raw} stored exactly as pasted</div>
            )}
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30">
            <input
              type="checkbox"
              checked={announce}
              onChange={(e) => setAnnounce(e.target.checked)}
              data-testid="restock-announce-toggle"
              className="w-4 h-4 accent-[#5865F2]"
            />
            <span className="text-xs text-slate-300 leading-relaxed">
              <span className="text-white font-semibold">Announce this restock in Discord</span>{" "}
              — posts a restocked embed with variants, prices and live stock
            </span>
          </label>
          <div className="flex gap-3 mt-1">
            <button
              onClick={finishRestock}
              disabled={announcing}
              data-testid="restock-confirm-done"
              className="flex-1 px-5 py-2.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold disabled:opacity-40 transition-all duration-200 active:scale-95"
            >
              {announcing ? "Announcing..." : announce ? "Announce & Done" : "Done"}
            </button>
            <button
              onClick={() => setConfirm(null)}
              data-testid="restock-add-more"
              className="px-5 py-2.5 rounded-lg border border-[#1E2D4A] text-sm text-slate-300 hover:border-[#2E6BFF]/50 hover:text-white transition-all"
            >
              Add more
            </button>
          </div>
      </ScrollModal>
    );
  }

  return (
    <ScrollModal onClose={onClose} testid="key-manager-modal" className="max-w-2xl">
        <h2 className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2 mb-4">
          <KeyRound className="w-5 h-5 text-[#5B8CFF]" /> Key Stock — {product.name}
        </h2>

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
              {durLabel(product, d)}: {countFor(d)}
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
              : "Add accounts — one per line, any format is auto-detected"}
          </label>
          {mode === "accounts" && (
            <div className="text-[10px] font-mono text-slate-500 -mt-1.5 mb-2">
              Discord (email:email pass:discord pass:token), labeled pipes (Steam / Rockstar) and email:password all auto-detect — anything else is stored and delivered exactly as pasted
            </div>
          )}
          <div className="flex gap-3 mb-3">
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger data-testid="keys-duration-select" className="w-44 bg-[#050B18] border-[#1E2D4A]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0A1628] border-[#1E2D4A] text-slate-100">
                {productDurations.map((d) => (
                  <SelectItem key={d} value={d} data-testid={`keys-duration-${d}`}>{durLabel(product, d)}</SelectItem>
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
              : "buyer@mail.com:emailpass123:discordpass456:MTIzNDU2.token.xyz\nE-Mail: acc@mail.com | Steam Password: pass | Steam Username: user123\nE-Mail: acc2@mail.com | Rockstar Password: pass | 2FA Key: ABCDEF | 2FA Redeem: https://..."}
            data-testid="keys-input"
            className="w-full rounded-lg bg-[#050B18] border border-[#1E2D4A] focus:border-[#2E6BFF] focus:outline-none font-mono text-sm p-3 text-slate-100 placeholder:text-slate-600"
          />
          <button
            onClick={addKeys}
            disabled={adding || !input.trim()}
            data-testid="keys-add-button"
            className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold disabled:opacity-40 transition-all duration-200 active:scale-95"
          >
            <Plus className="w-4 h-4" /> {adding ? "Adding..." : `Add to ${durLabel(product, duration)} pool`}
          </button>
        </div>

        {isGeneratorProduct && (
          <div className="mt-4 p-4 rounded-lg bg-violet-400/5 border border-violet-400/30" data-testid="gen-keys-card">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-violet-300 mb-1">
              Generator keys
            </div>
            <div className="text-xs text-slate-400 mb-3 leading-relaxed">
              Create DSYNC-XXXX keys straight into stock. Customers redeem them in their portal for lifetime Generator access (1 of each type per hour).
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                min={1}
                max={100}
                value={genCount}
                onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                data-testid="gen-keys-count"
                className="w-20 h-9 rounded-lg bg-[#050B18] border border-[#1E2D4A] focus:border-violet-400 focus:outline-none font-mono text-xs px-3 text-slate-100"
              />
              <Select value={genDuration || productDurations[0] || ""} onValueChange={setGenDuration}>
                <SelectTrigger data-testid="gen-keys-duration" className="w-36 h-9 bg-[#050B18] border-[#1E2D4A] font-mono text-xs">
                  <SelectValue placeholder="Pool" />
                </SelectTrigger>
                <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
                  {productDurations.map((d) => (
                    <SelectItem key={d} value={d}>{durLabel(product, d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={generateKeys}
                disabled={generating}
                data-testid="gen-keys-button"
                className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-violet-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-violet-300 disabled:opacity-40 transition-all"
              >
                <Plus className="w-4 h-4" /> {generating ? "Generating..." : "Generate keys"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center gap-3 mb-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter keys..."
              data-testid="keys-filter-input"
              className="flex-1 h-9 rounded-lg bg-[#050B18] border border-[#1E2D4A] focus:border-[#2E6BFF] focus:outline-none font-mono text-xs px-3 text-slate-100 placeholder:text-slate-600"
            />
            <button
              onClick={doExport}
              disabled={exporting}
              data-testid="keys-export-button"
              title="Pull available stock out in the original paste format — for your Discord gen"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#2E6BFF]/40 text-[#8FB8E8] text-xs font-mono font-bold uppercase tracking-widest hover:bg-[#2E6BFF]/10 disabled:opacity-40 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> {exporting ? "..." : "Export"}
            </button>
            <span className="text-[10px] font-mono text-slate-500 shrink-0" data-testid="keys-list-count">
              {filteredKeys.length} total
            </span>
          </div>
          {exportData !== null && (
            <div className="mb-3 p-3 rounded-lg bg-[#050B18] border border-[#2E6BFF]/30" data-testid="keys-export-panel">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  {exportData.length} available item{exportData.length === 1 ? "" : "s"} — original paste format
                </span>
                <button onClick={() => setExportData(null)} data-testid="keys-export-close" className="p-1 text-slate-500 hover:text-white transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                readOnly
                value={exportData.join("\n")}
                rows={Math.min(10, Math.max(3, exportData.length))}
                data-testid="keys-export-text"
                className="w-full rounded-lg bg-[#0A1628] border border-[#1E2D4A] font-mono text-xs p-3 text-[#8FB8E8] focus:outline-none"
                onFocus={(e) => e.target.select()}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={copyExport}
                  data-testid="keys-export-copy"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-xs font-semibold transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy all
                </button>
                <button
                  onClick={downloadExport}
                  data-testid="keys-export-download"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#1E2D4A] text-xs text-slate-300 hover:border-[#2E6BFF]/50 hover:text-white transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Download .txt
                </button>
              </div>
              <button
                onClick={moveToGen}
                disabled={moving || exportData.length === 0}
                data-testid="keys-export-move"
                className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-semibold hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> {moving ? "Moving..." : "Copy & remove from store (move to gen)"}
              </button>
              <div className="mt-3 pt-3 border-t border-[#1E2D4A]">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
                  Send some to an email — original paste format, removed from stock
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={exportData.length}
                    value={sendCount}
                    onChange={(e) => setSendCount(e.target.value)}
                    data-testid="keys-send-count"
                    className="w-20 h-9 rounded-lg bg-[#0A1628] border border-[#1E2D4A] focus:border-[#2E6BFF] focus:outline-none font-mono text-xs px-3 text-slate-100"
                  />
                  <input
                    type="email"
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder="send-to@example.com"
                    data-testid="keys-send-email"
                    className="flex-1 h-9 rounded-lg bg-[#0A1628] border border-[#1E2D4A] focus:border-[#2E6BFF] focus:outline-none font-mono text-xs px-3 text-slate-100 placeholder:text-slate-600"
                  />
                  <button
                    onClick={sendStock}
                    disabled={sendingStock || exportData.length === 0}
                    data-testid="keys-send-button"
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-xs font-semibold disabled:opacity-40 transition-colors"
                  >
                    {sendingStock ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1" data-testid="keys-list">
          {keys === null && <div className="text-sm text-slate-500 py-8 text-center">Loading...</div>}
          {keys !== null && keys.length === 0 && (
            <div className="text-sm text-slate-500 py-8 text-center" data-testid="keys-empty">
              No keys yet — paste your supplier keys above
            </div>
          )}
          {keys !== null && keys.length > 0 && filteredKeys.length === 0 && (
            <div className="text-sm text-slate-500 py-8 text-center" data-testid="keys-filter-empty">
              No keys match that filter
            </div>
          )}
          {visibleKeys.map((k) => (
            <div
              key={k.id}
              data-testid={`key-row-${k.id}`}
              className="flex items-center gap-3 p-3 bg-[#050B18] border border-[#1E2D4A] rounded-lg"
            >
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2E6BFF]/10 border border-[#2E6BFF]/30 text-[#8FB8E8] uppercase tracking-wider shrink-0">
                {durLabel(product, k.duration)}
              </span>
              {k.account && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-400/10 border border-violet-400/30 text-violet-300 uppercase tracking-wider shrink-0">
                  Account
                </span>
              )}
              <code className="font-mono text-sm text-slate-100 flex-1 truncate" title={k.key}>{k.key}</code>
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
          {!showAll && filteredKeys.length > 100 && (
            <button
              onClick={() => setShowAll(true)}
              data-testid="keys-show-all"
              className="mt-2 text-xs font-mono text-[#8FB8E8] hover:text-white transition-colors"
            >
              Showing 100 of {filteredKeys.length} — show all
            </button>
          )}
        </div>
    </ScrollModal>
  );
}
