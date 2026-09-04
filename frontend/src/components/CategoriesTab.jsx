import { useEffect, useState } from "react";
import { Plus, Trash2, Tag, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

export default function CategoriesTab({ onChanged }) {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // {id, name, image_url}

  const load = () =>
    api.get("/categories").then(({ data }) => setCategories(data)).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post("/admin/categories", {
        name: name.trim(), sort_order: categories.length + 1, image_url: imageUrl.trim() || null,
      });
      toast.success(`Category '${name.trim()}' created`);
      setName(""); setImageUrl("");
      load();
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing?.name.trim()) return;
    try {
      await api.put(`/admin/categories/${editing.id}`, {
        name: editing.name.trim(), image_url: editing.image_url?.trim() || null,
      });
      toast.success("Category updated");
      setEditing(null);
      load();
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e));
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
          Create a category (e.g. FiveM, Accounts) — the photo shows on its shop collection card
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name *"
            data-testid="category-name-input"
            className={fieldCls}
          />
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Photo URL (e.g. /images/og-banner.png)"
            data-testid="category-image-input"
            className={fieldCls}
          />
          <button
            onClick={create}
            disabled={saving || !name.trim()}
            data-testid="category-create-button"
            className="rounded-lg inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 disabled:opacity-40 transition-all"
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
            {c.image_url ? (
              <img src={c.image_url} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
            ) : (
              <Tag className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            {editing?.id === c.id ? (
              <>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  data-testid={`category-edit-name-${c.id}`}
                  className={`${fieldCls} h-9`}
                />
                <Input
                  value={editing.image_url || ""}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="Photo URL"
                  data-testid={`category-edit-image-${c.id}`}
                  className={`${fieldCls} h-9`}
                />
                <button onClick={saveEdit} data-testid={`category-edit-save-${c.id}`} className="p-1.5 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditing(null)} data-testid={`category-edit-cancel-${c.id}`} className="p-1.5 border border-slate-600 text-slate-400 hover:bg-slate-700/30 rounded transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="font-mono text-sm text-slate-100 flex-1">{c.name}</span>
                <span className="text-[10px] font-mono text-slate-500">{c.product_count ?? 0} products</span>
                <button
                  onClick={() => setEditing({ id: c.id, name: c.name, image_url: c.image_url || "" })}
                  data-testid={`category-edit-${c.id}`}
                  className="p-1.5 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => remove(c)}
                  data-testid={`category-delete-${c.id}`}
                  className="p-1.5 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
