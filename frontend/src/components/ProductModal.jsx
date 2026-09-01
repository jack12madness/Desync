import { useState } from "react";
import { Check, ShoppingCart, Zap, Cpu, Monitor, ShieldCheck } from "lucide-react";
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

  if (!product) return null;

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl bg-[#0A1628] border-blue-500/20 text-slate-100 p-0 overflow-hidden"
        data-testid="product-detail-modal"
      >
        <div className="grid md:grid-cols-2">
          <div className="relative h-56 md:h-full min-h-[220px]">
            <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover saturate-[0.8]" />
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0A1628] via-transparent to-transparent" />
            <div className="absolute top-4 left-4">
              <StatusPill status={product.status} testid="modal-status-badge" />
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <DialogHeader>
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-blue-500 mb-1">{product.game}</div>
              <DialogTitle className="font-display text-2xl font-bold tracking-tight text-slate-100">
                {product.name}
              </DialogTitle>
            </DialogHeader>

            <p className="mt-3 text-sm text-slate-400 leading-relaxed">{product.description}</p>

            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Target: <span className="text-slate-300">{product.anticheat || "Universal"}</span>
            </div>

            <div className="mt-5">
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-2">Duration</div>
              <div className="grid grid-cols-2 gap-2">
                {durations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    data-testid={`duration-option-${d}`}
                    className={`clip-tag-sm px-3 py-2.5 border text-left transition-all duration-200 ${
                      selected === d
                        ? "border-blue-400 bg-blue-400/10 shadow-[0_0_20px_rgba(46,107,255,0.15)]"
                        : "border-slate-700/60 hover:border-blue-500/40"
                    }`}
                  >
                    <div className="text-xs font-mono uppercase tracking-wider text-slate-400">{DURATION_LABELS[d]}</div>
                    <div className={`font-mono font-bold ${selected === d ? "text-blue-300" : "text-slate-200"}`}>
                      {eur(product.prices[d])}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {(product.features || []).map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-slate-300">
                  <Check className="w-3 h-3 text-blue-400 shrink-0" /> {f}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider text-slate-600">
              <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Win 10/11</span>
              <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> Intel / AMD</span>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => addItem(product, selected)}
                data-testid="add-to-cart-button"
                className="clip-tag flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 border border-blue-400/40 text-blue-300 text-xs font-mono uppercase tracking-widest hover:bg-blue-400/10 transition-all duration-200"
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
                className="clip-tag flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 hover:shadow-[0_0_30px_rgba(46,107,255,0.35)] transition-all duration-200"
              >
                <Zap className="w-4 h-4" /> Buy Now
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
