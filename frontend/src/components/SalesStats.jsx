import { useEffect, useState } from "react";
import { Euro, ShoppingBag, KeyRound, Users } from "lucide-react";
import { api, eur } from "@/lib/api";

export default function SalesStats() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/admin/products").then(({ data }) => setProducts(data)).catch(() => {});
  }, []);

  if (!stats) return null;

  const cards = [
    { icon: Euro, label: "Revenue", value: eur(stats.total_revenue), testid: "stat-revenue" },
    { icon: ShoppingBag, label: "Paid Orders", value: stats.total_orders, testid: "stat-orders" },
    { icon: KeyRound, label: "Keys Sold", value: stats.keys_sold, testid: "stat-keys" },
    { icon: Users, label: "Drop Waitlist", value: stats.waitlist, testid: "stat-waitlist" },
  ];

  const byProduct = Object.entries(stats.by_product || {})
    .map(([pid, v]) => ({ name: products.find((p) => p.id === pid)?.name || "Deleted product", ...v }))
    .sort((a, b) => b.revenue - a.revenue);
  const maxRevenue = Math.max(...byProduct.map((p) => p.revenue), 1);

  return (
    <div className="mb-10" data-testid="admin-stats">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="p-5 bg-[#0F1F38] border border-[#1E2D4A] rounded-xl" data-testid={c.testid}>
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <c.icon className="w-4 h-4 text-[#5B8CFF]" />
              <span className="text-xs font-medium">{c.label}</span>
            </div>
            <div className="font-display text-2xl font-bold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      {byProduct.length > 0 && (
        <div className="mt-4 p-5 bg-[#0F1F38] border border-[#1E2D4A] rounded-xl" data-testid="stats-by-product">
          <div className="text-sm font-semibold text-white mb-4">Sales by product</div>
          <div className="space-y-3">
            {byProduct.map((p) => (
              <div key={p.name} className="flex items-center gap-4">
                <div className="w-48 sm:w-64 truncate text-sm text-slate-300">{p.name}</div>
                <div className="flex-1 h-2 rounded-full bg-[#050B18] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8FB8F0] to-[#2E6BFF]"
                    style={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 w-16 text-right">{p.sold} sold</div>
                <div className="font-mono text-sm text-[#8FB8E8] w-20 text-right">{eur(p.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
