import { useEffect, useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

export default function CouponsTab() {
  const [coupons, setCoupons] = useState(null);
  const [form, setForm] = useState({ code: "", percent: "", max_uses: "" });
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/admin/coupons").then(({ data }) => setCoupons(data)).catch(() => setCoupons([]));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.code.trim() || !form.percent) {
      toast.error("Code and percent are required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/coupons", {
        code: form.code,
        percent: parseFloat(form.percent),
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
      });
      toast.success(`Code ${form.code.toUpperCase()} created`);
      setForm({ code: "", percent: "", max_uses: "" });
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    try {
      await api.put(`/admin/coupons/${c.id}`, { active: !c.active });
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete code ${c.code}?`)) return;
    try {
      await api.delete(`/admin/coupons/${c.id}`);
      toast.success("Code deleted");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const fieldCls = "bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] h-10";

  return (
    <div data-testid="coupons-tab">
      <div className="p-5 bg-[#0F1F38] border border-[#1E2D4A] rounded-xl mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-4 h-4 text-[#5B8CFF]" />
          <div className="text-sm font-semibold text-white">Create a discount code</div>
        </div>
        <p className="text-xs text-slate-500 mb-4">Percent off the whole cart — for launch promos and Discord giveaways</p>
        <div className="grid sm:grid-cols-4 gap-3">
          <Input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="CODE (e.g. LAUNCH20)"
            data-testid="coupon-code-input"
            className={`${fieldCls} font-mono uppercase`}
          />
          <Input
            type="number"
            min="1"
            max="100"
            value={form.percent}
            onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))}
            placeholder="% off"
            data-testid="coupon-percent-input"
            className={fieldCls}
          />
          <Input
            type="number"
            min="1"
            value={form.max_uses}
            onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
            placeholder="Max uses (blank = unlimited)"
            data-testid="coupon-max-uses-input"
            className={fieldCls}
          />
          <button
            onClick={create}
            disabled={saving}
            data-testid="coupon-create-button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold disabled:opacity-40 transition-all duration-200"
          >
            <Plus className="w-4 h-4" /> {saving ? "Creating..." : "Create Code"}
          </button>
        </div>
      </div>

      <div className="space-y-2" data-testid="coupons-list">
        {coupons === null && <div className="text-sm text-slate-500 py-10 text-center">Loading...</div>}
        {coupons !== null && coupons.length === 0 && (
          <div className="text-sm text-slate-500 py-10 text-center" data-testid="coupons-empty">No codes yet</div>
        )}
        {(coupons || []).map((c) => (
          <div
            key={c.id}
            data-testid={`coupon-row-${c.code}`}
            className="flex items-center gap-4 p-4 bg-[#0F1F38] border border-[#1E2D4A] rounded-lg"
          >
            <code className="font-mono text-sm font-bold text-white bg-[#2E6BFF]/10 border border-[#2E6BFF]/30 px-3 py-1 rounded-md">
              {c.code}
            </code>
            <span className="text-sm text-[#8FB8E8] font-semibold">{c.percent}% off</span>
            <span className="text-xs text-slate-500">
              {c.used_count} used{c.max_uses ? ` / ${c.max_uses} max` : " · unlimited"}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => toggle(c)}
              data-testid={`coupon-toggle-${c.code}`}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                c.active
                  ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-300"
                  : "bg-slate-500/10 border-slate-600 text-slate-500"
              }`}
            >
              {c.active ? "Active" : "Disabled"}
            </button>
            <button
              onClick={() => remove(c)}
              data-testid={`coupon-delete-${c.code}`}
              className="p-1.5 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
