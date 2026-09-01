import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const MANUAL_ITEMS = [
  { key: "stripe_claimed", label: "Stripe account claimed and ready for live payments" },
  { key: "real_test_done", label: "Ran a real end-to-end test purchase with a live card" },
  { key: "domain_done", label: "Custom domain connected" },
];

export default function LaunchTab() {
  const [settings, setSettings] = useState(null);
  const [dropDate, setDropDate] = useState("");
  const [teaser, setTeaser] = useState("");
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/admin/settings").then(({ data }) => {
      setSettings(data);
      setDropDate(data.drop_date ? data.drop_date.slice(0, 16) : "");
      setTeaser(data.drop_teaser || "");
    }).catch(() => {});
    api.get("/admin/products").then(({ data }) => setProducts(data)).catch(() => {});
    api.get("/admin/keystock/counts").then(({ data }) => setCounts(data)).catch(() => {});
  }, []);

  const saveDrop = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/admin/settings", {
        drop_date: dropDate ? new Date(dropDate).toISOString() : null,
        drop_teaser: teaser || null,
      });
      setSettings(data);
      toast.success("Drop settings saved — live on the drop page");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleManual = async (key, value) => {
    const checklist = { ...(settings?.checklist || {}), [key]: value };
    setSettings((s) => ({ ...s, checklist }));
    try {
      await api.put("/admin/settings", { checklist });
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const liveProducts = products.filter((p) => p.active).length;
  const stockedPools = Object.values(counts).filter((c) => (c.total || 0) > 0).length;

  const autoItems = [
    { label: "Alert email set for low stock", done: !!settings?.notify_email, testid: "check-alert-email" },
    { label: "Discord invite linked across the site", done: true, testid: "check-discord" },
    { label: `${liveProducts} products live in the shop`, done: liveProducts > 0, testid: "check-products" },
    { label: `${stockedPools} key pool${stockedPools === 1 ? "" : "s"} stocked`, done: stockedPools > 0, testid: "check-stock" },
    { label: "Drop date set for countdown", done: !!settings?.drop_date, testid: "check-drop-date" },
  ];

  const fieldCls = "bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] h-11";

  return (
    <div className="space-y-6" data-testid="launch-tab">
      <div className="p-5 bg-[#0F1F38] border border-[#1E2D4A] rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-4 h-4 text-[#5B8CFF]" />
          <div className="text-sm font-semibold text-white">Next drop — countdown & teaser</div>
        </div>
        <p className="text-xs text-slate-500 mb-5">Controls the live countdown on the /drop page</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-300 block mb-2">Drop date & time</label>
            <Input
              type="datetime-local"
              value={dropDate}
              onChange={(e) => setDropDate(e.target.value)}
              data-testid="drop-date-input"
              className={fieldCls}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 block mb-2">Teaser text</label>
            <Input
              value={teaser}
              onChange={(e) => setTeaser(e.target.value)}
              placeholder="Our next release is locked and in final testing..."
              data-testid="drop-teaser-input"
              className={fieldCls}
            />
          </div>
        </div>
        <button
          onClick={saveDrop}
          disabled={saving}
          data-testid="drop-settings-save"
          className="mt-4 px-5 py-2.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold disabled:opacity-40 transition-all duration-200"
        >
          {saving ? "Saving..." : "Save Drop Settings"}
        </button>
      </div>

      <div className="p-5 bg-[#0F1F38] border border-[#1E2D4A] rounded-xl">
        <div className="text-sm font-semibold text-white mb-1">Go-live checklist</div>
        <p className="text-xs text-slate-500 mb-5">Auto-checked items update themselves — tick the manual ones as you finish them</p>
        <div className="space-y-3" data-testid="launch-checklist">
          {autoItems.map((item) => (
            <div key={item.testid} className="flex items-center gap-3" data-testid={item.testid}>
              {item.done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-slate-600 shrink-0" />
              )}
              <span className={`text-sm ${item.done ? "text-slate-200" : "text-slate-500"}`}>{item.label}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2E6BFF]/10 border border-[#2E6BFF]/30 text-[#8FB8E8] uppercase tracking-wider">auto</span>
            </div>
          ))}
          {MANUAL_ITEMS.map((item) => {
            const done = !!settings?.checklist?.[item.key];
            return (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer" data-testid={`check-${item.key}`}>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => toggleManual(item.key, e.target.checked)}
                  className="w-4 h-4 accent-[#2E6BFF]"
                  data-testid={`check-${item.key}-input`}
                />
                <span className={`text-sm ${done ? "text-slate-200" : "text-slate-500"}`}>{item.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
