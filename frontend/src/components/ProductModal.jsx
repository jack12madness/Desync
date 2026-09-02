import { useState } from "react";
import { Check, ShoppingCart, Zap, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusPill from "@/components/StatusPill";
import { useCart, DURATION_LABELS } from "@/context/CartContext";
import { eur } from "@/lib/api";

const DURATION_ORDER = ["day", "week", "month", "lifetime"];

export default function ProductModal({ product, onClose }) {
  const { addItem, openCart } = useCart();
  const durations = product
    ? DURATION_ORDER.filter((d) => product.prices && product.prices[d] != null)
    : [];
  const [duration, setDuration] = useState(null);
  const selected = duration && durations.includes(duration) ? duration : durations[0];
  const soldOut = product
    ? durations.length > 0 && durations.every((d) => !(product.stock?.[d] > 0))
    : false;

  if (!product) return null;

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl bg-[#0A1628] border-[#1E2D4A] text-slate-100 p-0 overflow-hidden rounded-xl"
        data-testid="product-detail-modal"
      >
        <div className="grid md:grid-cols-2">
          <div className="relative h-56 md:h-full min-h-[220px]">
            <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0A1628] via-transparent to-transparent" />
            <div className="absolute top-4 left-4">
              <StatusPill status={product.status} testid="modal-status-badge" />
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <DialogHeader>
              <div className="text-sm font-medium text-[#5B8CFF] mb-1">{product.game}</div>
              <DialogTitle className="font-display text-2xl font-bold tracking-tight text-white">
                {product.name}
              </DialogTitle>
            </DialogHeader>

            <p className="mt-3 text-sm text-slate-400 leading-relaxed">{product.description}</p>

            <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <ShieldCheck className="w-4 h-4 text-[#5B8CFF]" />
              Works against <span className="text-slate-200">{product.anticheat || "Universal"}</span>
            </div>

            <div className="mt-6">
              <div className="text-sm font-medium text-slate-300 mb-2.5">Choose duration</div>
              <div className="grid grid-cols-2 gap-2.5">
                {durations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    data-testid={`duration-option-${d}`}
                    className={`rounded-lg px-4 py-3 border text-left transition-all duration-200 ${
                      selected === d
                        ? "border-[#2E6BFF] bg-[#2E6BFF]/10 shadow-[0_0_24px_rgba(46,107,255,0.2)]"
                        : "border-[#1E2D4A] bg-[#050B18] hover:border-[#2E6BFF]/40"
                    }`}
                  >
                    <div className="text-xs text-slate-400">{DURATION_LABELS[d]}</div>
                    <div className={`font-mono font-bold mt-0.5 ${selected === d ? "text-[#8FB8E8]" : "text-slate-100"}`}>
                      {eur(product.prices[d])}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2">
              {(product.features || []).map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-3.5 h-3.5 text-[#5B8CFF] shrink-0" /> {f}
                </div>
              ))}
            </div>

            <div className="mt-7 flex gap-3">
              {soldOut ? (
                <div
                  data-testid="modal-soldout-notice"
                  className="flex-1 px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-sm font-semibold text-center"
                >
                  Sold out — restock coming soon. Join the Discord for drop alerts.
                </div>
              ) : (
                <>
                  <button
                    onClick={() => addItem(product, selected)}
                    data-testid="add-to-cart-button"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[#2E6BFF]/40 text-[#8FB8E8] text-sm font-semibold hover:bg-[#2E6BFF]/10 transition-all duration-200"
                  >
                    <ShoppingCart className="w-4 h-4" /> Add to Cart
                  </button>
                  <button
                    onClick={() => {
                      addItem(product, selected);
                      onClose();
                      openCart();
                    }}
                    data-testid="instant-checkout-button"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] transition-all duration-200 active:scale-95"
                  >
                    <Zap className="w-4 h-4" /> Buy Now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
