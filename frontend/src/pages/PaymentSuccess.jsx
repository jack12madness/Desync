import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import { KeyRow } from "@/pages/OrderLookup";
import { api, eur } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState({ status: "polling", order: null });
  const { clearCart } = useCart();
  const tries = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setState({ status: "error", order: null });
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid" && data.order) {
          setState({ status: "paid", order: data.order });
          clearCart();
          return;
        }
        tries.current += 1;
        if (tries.current < 30) setTimeout(poll, 2500);
        else setState({ status: "timeout", order: null });
      } catch {
        if (!cancelled) setState({ status: "error", order: null });
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, clearCart]);

  return (
    <div data-testid="payment-success-page">
      <Navbar />
      <main className="pt-28 pb-24 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {state.status === "polling" && (
            <div className="text-center py-24" data-testid="payment-polling">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-6" />
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight">Confirming Payment</h1>
              <p className="text-sm text-slate-400 mt-3 font-mono uppercase tracking-widest">Talking to Stripe...</p>
            </div>
          )}

          {state.status === "paid" && state.order && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
              <div className="text-center mb-10">
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-5" data-testid="payment-success-icon" />
                <div className="text-xs font-mono uppercase tracking-[0.25em] text-blue-400 mb-2">// Payment Confirmed</div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight">
                  You're Locked In
                </h1>
                <p className="text-sm text-slate-400 mt-3">
                  Keys are tied to <span className="text-blue-300 font-mono">{state.order.email}</span> — retrieve them anytime via My Orders.
                </p>
              </div>

              <div className="p-6 bg-[#0F1F38] border border-blue-500/30 rounded-lg shadow-[0_0_60px_rgba(46,107,255,0.08)]" data-testid="license-key-display">
                <div className="flex items-center justify-between mb-5 text-xs font-mono uppercase tracking-widest text-slate-500">
                  <span>ORDER {state.order.id.slice(0, 8).toUpperCase()}</span>
                  <span className="text-blue-300">{eur(state.order.total)}</span>
                </div>
                <div className="space-y-3">
                  {state.order.items.map((item) => (
                    <KeyRow key={`${item.product_id}-${item.duration}`} item={item} />
                  ))}
                </div>
                <div className="mt-6 p-4 border border-dashed border-blue-500/30 rounded text-xs text-slate-400 leading-relaxed">
                  <span className="font-mono uppercase tracking-widest text-blue-400 block mb-2">Setup // 60 seconds</span>
                  1. Download the loader from the Discord #downloads channel.
                  2. Run as Administrator, paste your key.
                  3. Launch your game and press INSERT to open the menu.
                </div>
              </div>

              <div className="mt-8 text-center">
                <Link
                  to="/orders"
                  data-testid="success-view-orders-link"
                  className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-blue-300 hover:text-blue-200"
                >
                  View in My Orders <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          )}

          {(state.status === "error" || state.status === "timeout") && (
            <div className="text-center py-24" data-testid="payment-error-state">
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight">Still Processing</h1>
              <p className="text-sm text-slate-400 mt-4 max-w-md mx-auto">
                We couldn't confirm your payment yet. If you completed checkout, your keys will appear under
                My Orders within a few minutes — or ping us on Discord.
              </p>
              <Link to="/orders" className="mt-6 inline-flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-blue-300">
                Check My Orders <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
