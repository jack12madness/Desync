import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, ArrowRight, Mail } from "lucide-react";
import Navbar from "@/components/Navbar";
import { KeyRow } from "@/pages/OrderLookup";
import { api, eur } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const orderId = params.get("order");
  const [state, setState] = useState({ status: "polling", order: null });
  const { clearCart } = useCart();
  const tries = useRef(0);

  useEffect(() => {
    if (!sessionId && !orderId) {
      setState({ status: "error", order: null });
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        if (orderId) {
          const { data } = await api.get(`/orders/by-id/${orderId}`);
          if (!cancelled) {
            setState({ status: "paid", order: data });
            clearCart();
          }
          return;
        }
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid" && data.order) {
          setState({ status: "paid", order: data.order });
          clearCart();
          return;
        }
      } catch (e) {
        if (orderId && e?.response?.status === 404) {
          // paypal capture still settling — keep polling
        } else if (!cancelled && !orderId) {
          // stripe status errors: keep polling too
        }
      }
      if (cancelled) return;
      tries.current += 1;
      if (tries.current < 30) setTimeout(poll, 2500);
      else setState({ status: "timeout", order: null });
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, orderId, clearCart]);

  return (
    <div data-testid="payment-success-page">
      <Navbar />
      <main className="pt-28 pb-24 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {state.status === "polling" && (
            <div className="text-center py-24" data-testid="payment-polling">
              <Loader2 className="w-10 h-10 text-[#5B8CFF] animate-spin mx-auto mb-6" />
              <h1 className="font-display text-2xl font-bold tracking-tight text-white">Confirming your payment</h1>
              <p className="text-sm text-slate-400 mt-3">Talking to the payment provider...</p>
            </div>
          )}

          {state.status === "paid" && state.order && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
              <div className="text-center mb-10">
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-5" data-testid="payment-success-icon" />
                <div className="text-sm font-medium text-[#5B8CFF] mb-2">Payment confirmed</div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                  You're all set
                </h1>
                <p className="text-sm text-slate-400 mt-3 flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4 text-[#5B8CFF]" />
                  Keys emailed to <span className="text-slate-200">{state.order.email}</span>
                </p>
              </div>

              <div className="p-6 bg-[#0A1628] border border-[#2E6BFF]/30 rounded-xl shadow-[0_0_60px_rgba(46,107,255,0.1)]" data-testid="license-key-display">
                <div className="flex items-center justify-between mb-5 text-sm text-slate-400">
                  <span>Order {state.order.id.slice(0, 8).toUpperCase()}</span>
                  <span className="text-white font-mono font-semibold">{eur(state.order.total)}</span>
                </div>
                <div className="space-y-3">
                  {state.order.items.map((item) => (
                    <KeyRow key={`${item.product_id}-${item.duration}`} item={item} />
                  ))}
                </div>
                <div className="mt-6 p-4 border border-dashed border-[#2E6BFF]/30 rounded-lg text-sm text-slate-400 leading-relaxed">
                  <span className="text-white font-semibold block mb-2">Setup in 60 seconds</span>
                  1. Download the loader from the Discord #downloads channel.
                  2. Run as Administrator and paste your key.
                  3. Launch your game and press INSERT to open the menu.
                </div>
              </div>

              <div className="mt-8 text-center">
                <Link
                  to="/orders"
                  data-testid="success-view-orders-link"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#8FB8E8] hover:text-white transition-colors"
                >
                  View in My Orders <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          )}

          {(state.status === "error" || state.status === "timeout") && (
            <div className="text-center py-24" data-testid="payment-error-state">
              <h1 className="font-display text-2xl font-bold tracking-tight text-white">Still processing</h1>
              <p className="text-sm text-slate-400 mt-4 max-w-md mx-auto">
                We couldn't confirm your payment yet. If you completed checkout, your keys will appear under
                My Orders within a few minutes — and in your email inbox.
              </p>
              <Link to="/orders" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#8FB8E8] hover:text-white transition-colors">
                Check My Orders <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
