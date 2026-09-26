import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ArrowLeft, GripVertical, FolderOpen } from "lucide-react";
import StatusPill from "@/components/StatusPill";
import { api, apiError, aud } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { DURATION_LABELS } from "@/context/CartContext";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function ProductsTab({ products, categories, stockCounts, onAdd, onEdit, onDelete, onKeys, onReordered }) {
  const [selectedCat, setSelectedCat] = useState(null); // category name or null
  const [ordered, setOrdered] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const catNames = categories.map((c) => c.name);
  const knownCats = categories.filter((c) => products.some((p) => p.game === c.name) || true);
  const orphanProducts = products.filter((p) => !catNames.includes(p.game));

  useEffect(() => {
    if (!selectedCat) return;
    setOrdered(products.filter((p) => p.game === selectedCat));
  }, [selectedCat, products]);

  const counts = (name) => products.filter((p) => p.game === name).length;

  const handleDrop = async (idx) => {
    setOverIdx(null);
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      return;
    }
    const next = [...ordered];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setDragIdx(null);
    setOrdered(next);
    try {
      await api.post("/admin/products/reorder", { game: selectedCat, product_ids: next.map((p) => p.id) });
      toast.success("Product order saved");
      onReordered?.();
    } catch (e) {
      toast.error(apiError(e));
      onReordered?.();
    }
  };

  if (!selectedCat) {
    return (
      <div data-testid="products-categories-view">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight mb-2">{products.length} Products</h2>
        <p className="text-xs font-mono text-slate-500 mb-6">
          Pick a category to manage its products — drag products to set their shop order
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="admin-category-grid">
          {knownCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.name)}
              data-testid={`admin-cat-card-${slug(c.name)}`}
              className="group flex items-center gap-4 p-4 bg-[#0F1F38] border border-blue-900/40 rounded-lg text-left hover:border-blue-400/60 transition-all"
            >
              {c.image_url ? (
                <img src={c.image_url} alt="" className="w-12 h-12 rounded-md object-cover shrink-0 saturate-[0.8]" />
              ) : (
                <FolderOpen className="w-5 h-5 text-blue-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-100 truncate">{c.name}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  {counts(c.name)} product{counts(c.name) === 1 ? "" : "s"}
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-slate-500 rotate-180 group-hover:text-blue-300 transition-colors" />
            </button>
          ))}
          {knownCats.length === 0 && (
            <div className="col-span-full text-center py-16 font-mono text-sm text-slate-500 uppercase tracking-[0.25em]">
              No categories yet — create one in the Categories tab first
            </div>
          )}
        </div>
        {orphanProducts.length > 0 && (
          <button
            onClick={() => setSelectedCat(orphanProducts[0].game)}
            data-testid="admin-cat-card-uncategorised"
            className="mt-4 text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors"
          >
            {orphanProducts.length} product(s) in categories that no longer exist — manage
          </button>
        )}
      </div>
    );
  }

  return (
    <div data-testid="products-category-view">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedCat(null)}
            data-testid="admin-cat-back"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1E2D4A] text-xs font-mono uppercase tracking-widest text-slate-300 hover:border-blue-400/50 hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Categories
          </button>
          <h2 className="font-display text-xl font-bold uppercase tracking-tight">
            {selectedCat} <span className="text-slate-500 text-sm font-mono">// {ordered.length} products</span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onAdd("cheat", selectedCat)}
            data-testid="admin-add-product-button"
            className="rounded-lg inline-flex items-center gap-2 px-4 py-2 bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Cheat
          </button>
          <button
            onClick={() => onAdd("account", selectedCat)}
            data-testid="admin-add-account-button"
            className="rounded-lg inline-flex items-center gap-2 px-4 py-2 bg-violet-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-violet-300 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>
      <div className="space-y-3" data-testid="admin-products-list">
        {ordered.length === 0 && (
          <div className="text-center py-16 font-mono text-sm text-slate-500 uppercase tracking-[0.25em]" data-testid="admin-products-empty">
            No products in this category yet
          </div>
        )}
        {ordered.map((p, i) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
            onDragLeave={() => setOverIdx((o) => (o === i ? null : o))}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            className={`flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-[#0F1F38] border rounded-lg transition-colors ${
              overIdx === i && dragIdx !== null && dragIdx !== i ? "border-blue-400" : "border-blue-900/40"
            } ${dragIdx === i ? "opacity-50" : ""}`}
            data-testid={`admin-product-row-${p.id}`}
          >
            <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
              <GripVertical
                className="w-4 h-4 text-slate-600 cursor-grab active:cursor-grabbing shrink-0"
                data-testid={`drag-handle-${p.id}`}
              />
              <img src={p.image_url} alt="" className="w-16 h-16 object-cover rounded-md saturate-[0.7]" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-100">{p.name}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  {p.game} // {Object.entries(p.prices || {}).map(([k, v]) => `${DURATION_LABELS[k]} ${aud(v)}`).join(" · ")}
                  {!p.active && <span className="text-rose-400 ml-2">HIDDEN</span>}
                </div>
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
              onClick={() => onKeys(p)}
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
              <button onClick={() => onEdit(p)} data-testid={`admin-edit-product-${p.id}`} className="p-2 border border-blue-500/30 text-blue-300 hover:bg-blue-400/10 rounded transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(p)} data-testid={`admin-delete-product-${p.id}`} className="p-2 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
