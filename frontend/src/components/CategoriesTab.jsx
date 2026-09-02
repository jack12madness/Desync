import { useEffect, useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

export default function CategoriesTab({ onChanged }) {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get("/categories").then(({ data }) => setCategories(data)).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post("/admin/categories", { name: name.trim(), sort_order: categories.length + 1 });
      toast.success(`Category '${name.trim()}' created`);
      setName("");
      load();
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete category '${c.name}'?`)) return;
    try {
      await api.delete(`/admin/categories/${c.id}`);
      toast.success("Category deleted");
      load();
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const fieldCls = "bg-[#050B18] border-slate-700 focus-visible:ring-blue-400 font-mono text-sm";

  return (
    <div data-testid="categories-tab">
      <h2 className="font-display text-xl font-bold uppercase tracking-tight mb-6">
        {categories.length} Categories
      </h2>
      <div className="p-5 bg-[#0F1F38] border border-blue-900/40 rounded-lg mb-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-4">
          Create a category (e.g. FiveM, Rust) — then assign products to it from the Products tab
        </div>
        <div className="flex gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Category name"
            data-testid="category-name-input"
            className={fieldCls}
          />
          <button
            onClick={create}
            disabled={saving || !name.trim()}
            data-testid="category-create-button"
            className="shrink-0 rounded-lg inline-flex items-center gap-2 px-4 py-2 bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 disabled:opacity-40 transition-all"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>
      <div className="space-y-2" data-testid="categories-list">
        {categories.length === 0 && (
          <div className="text-center py-16 font-mono text-sm text-slate-500 uppercase tracking-[0.25em]">
            No categories yet
          </div>
        )}
        {categories.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-4 p-3 bg-[#0F1F38] border border-blue-900/40 rounded-lg"
            data-testid={`category-row-${c.id}`}
          >
            <Tag className="w-4 h-4 text-blue-400" />
            <span className="font-mono text-sm text-slate-100 flex-1">{c.name}</span>
            <button
              onClick={() => remove(c)}
              data-testid={`category-delete-${c.id}`}
              className="p-1.5 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
