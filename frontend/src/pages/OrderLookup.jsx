import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Copy, KeyRound } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { api, apiError, eur } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

export function KeyRow({ item }) {
  const copy = () => {
    navigator.clipboard.writeText(item.license_key);
    toast.success("License key copied");
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-[#050B18] border border-[#1E2D4A] rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{item.name}</div>
        <div className="text-xs text-slate-500">
          {item.game} · {item.duration_label}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <code
          data-testid={`license-key-${item.product_id}-${item.duration}`}
          className="font-mono text-sm text-[#8FB8E8] bg-[#2E6BFF]/10 border border-[#2E6BFF]/30 px-3 py-1.5 rounded-md"
        >
          {item.license_key}
        </code>
        <button
          onClick={copy}
          data-testid={`copy-key-${item.product_id}-${item.duration}`}
          className="p-2 border border-[#2E6BFF]/30 text-[#8FB8E8] hover:bg-[#2E6BFF]/10 rounded-md transition-colors"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function OrderLookup() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const { data } = await api.post("/orders/lookup", { email });
      setOrders(data);
    } catch (e) {
      toast.error(apiError(e));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="order-lookup-page">
      <Navbar />
      <main className="pt-28 pb-24 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="text-sm font-medium text-[#5B8CFF] mb-2">My Orders</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              Find your keys
            </h1>
            <p className="text-sm text-slate-400 mb-8">
              Enter the email you used at checkout. Every paid order and its license keys will appear.
            </p>
          </motion.div>

          <div className="flex gap-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="you@example.com"
              data-testid="lookup-email-input"
              className="bg-[#0A1628] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] text-sm h-12"
            />
            <button
              onClick={lookup}
              disabled={loading}
              data-testid="lookup-submit-button"
              className="shrink-0 inline-flex items-center gap-2 px-6 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] disabled:opacity-40 transition-all duration-200 active:scale-95"
            >
              <Search className="w-4 h-4" /> {loading ? "..." : "Search"}
            </button>
          </div>

          {orders !== null && (
            <div className="mt-10 space-y-8" data-testid="lookup-results">
              {orders.length === 0 && (
                <div className="text-center py-16 text-sm text-slate-500" data-testid="lookup-empty">
                  No paid orders found for that email
                </div>
              )}
              {orders.map((o) => (
                <div key={o.id} className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl" data-testid={`order-${o.id}`}>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <KeyRound className="w-4 h-4 text-[#5B8CFF]" />
                      Order {o.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="text-sm text-slate-500">
                      {new Date(o.created_at).toLocaleDateString()} · <span className="text-white font-mono font-semibold">{eur(o.total)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {o.items.map((item) => (
                      <KeyRow key={`${item.product_id}-${item.duration}`} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
