import { useState } from "react";
import { X, Lock, ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useCart, DURATION_LABELS } from "@/context/CartContext";
import { api, apiError, eur } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

export default function CartDrawer() {
  const { items, removeItem, total, isOpen, closeCart } = useCart();
  const [email, setEmail] = useState(() => localStorage.getItem("void_email") || "");
  const [loading, setLoading] = useState(false);

  const checkout = async () => {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Enter a valid email — your keys are delivered there");
      return;
    }
    if (items.length === 0) return;
    setLoading(true);
    try {
      localStorage.setItem("void_email", email);
      const { data } = await api.post("/payments/checkout", {
        email,
        items: items.map((i) => ({ product_id: i.product.id, duration: i.duration })),
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(apiError(e));
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-[#0A1628] border-l border-[#1E2D4A] text-slate-100 flex flex-col"
        data-testid="cart-drawer"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-xl font-bold tracking-tight text-white">
            Your Cart
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-6 space-y-3 pr-1">
          {items.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-16" data-testid="cart-empty-state">
              Your cart is empty
            </div>
          )}
          {items.map((item, idx) => (
            <div
              key={`${item.product.id}-${item.duration}`}
              data-testid={`cart-item-${item.product.id}`}
              className="flex items-center gap-3 p-3 bg-[#050B18] border border-[#1E2D4A] rounded-lg"
            >
              <img src={item.product.image_url} alt="" className="w-14 h-14 object-cover rounded-md" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate text-white">{item.product.name}</div>
                <div className="text-xs text-slate-500">
                  {item.product.game} · {DURATION_LABELS[item.duration]}
                </div>
              </div>
              <div className="font-mono text-sm font-bold text-[#8FB8E8]">{eur(item.price)}</div>
              <button
                onClick={() => removeItem(idx)}
                data-testid={`cart-remove-${item.product.id}`}
                className="text-slate-600 hover:text-rose-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-[#1E2D4A] pt-4 mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Subtotal</span>
            <span className="font-mono text-xl font-bold text-white" data-testid="cart-subtotal">{eur(total)}</span>
          </div>
          <div>
            <label className="text-sm text-slate-300 block mb-2">
              Delivery email — your keys land here
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              data-testid="cart-email-input"
              className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] text-sm h-11"
            />
          </div>
          <button
            onClick={checkout}
            disabled={loading || items.length === 0}
            data-testid="cart-checkout-button"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 active:scale-95"
          >
            <Lock className="w-4 h-4" />
            {loading ? "Redirecting to Stripe..." : "Checkout securely"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
          <p className="text-xs text-slate-600 text-center">
            Keys are emailed to you instantly after payment
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
