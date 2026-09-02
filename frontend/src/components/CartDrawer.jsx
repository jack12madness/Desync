import { useState } from "react";
import { X, Lock, ArrowRight, Tag } from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useCart, DURATION_LABELS } from "@/context/CartContext";
import { api, apiError, eur } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID;
const SHOW_PAYPAL = false; // PayPal hidden for now — set true to re-enable

export default function CartDrawer() {
  const { items, removeItem, total, isOpen, closeCart } = useCart();
  const [email, setEmail] = useState(() => localStorage.getItem("void_email") || "");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  const discount = coupon ? (total * coupon.percent) / 100 : 0;
  const payable = Math.max(0, total - discount);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const cartPayload = () => ({
    email,
    items: items.map((i) => ({ product_id: i.product.id, duration: i.duration })),
    coupon: coupon ? coupon.code : null,
  });

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setChecking(true);
    try {
      const { data } = await api.post("/coupons/validate", { code: couponInput.trim() });
      setCoupon(data);
      toast.success(`${data.code} applied — ${data.percent}% off`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setChecking(false);
    }
  };

  const checkout = async () => {
    if (!validEmail) {
      toast.error("Enter a valid email — your keys are delivered there");
      return;
    }
    if (!agreed) {
      toast.error("Please agree to the Terms of Service first");
      return;
    }
    if (items.length === 0) return;
    setLoading(true);
    try {
      localStorage.setItem("void_email", email);
      const { data } = await api.post("/payments/checkout", {
        ...cartPayload(),
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
          <div>
            <label className="text-sm text-slate-300 block mb-2">Discount code</label>
            {coupon ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/30" data-testid="cart-coupon-applied">
                <span className="flex items-center gap-2 text-sm text-emerald-300">
                  <Tag className="w-4 h-4" /> {coupon.code} — {coupon.percent}% off
                </span>
                <button onClick={() => setCoupon(null)} data-testid="cart-coupon-remove" className="text-slate-500 hover:text-rose-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                  placeholder="DESYNC10"
                  data-testid="cart-coupon-input"
                  className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] text-sm h-10 font-mono uppercase"
                />
                <button
                  onClick={applyCoupon}
                  disabled={checking || !couponInput.trim()}
                  data-testid="cart-coupon-apply"
                  className="shrink-0 px-4 rounded-lg border border-[#2E6BFF]/40 text-[#8FB8E8] text-sm font-medium hover:bg-[#2E6BFF]/10 disabled:opacity-40 transition-all"
                >
                  {checking ? "..." : "Apply"}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Subtotal</span>
              <span className="font-mono text-sm text-slate-300" data-testid="cart-subtotal">{eur(total)}</span>
            </div>
            {coupon && (
              <div className="flex items-center justify-between" data-testid="cart-discount-line">
                <span className="text-sm text-emerald-300">Discount ({coupon.code})</span>
                <span className="font-mono text-sm text-emerald-300">-{eur(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-[#1E2D4A]">
              <span className="text-sm font-semibold text-white">Total</span>
              <span className="font-mono text-xl font-bold text-white" data-testid="cart-total">{eur(payable)}</span>
            </div>
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

          <label className="flex items-start gap-3 cursor-pointer select-none" data-testid="terms-agree-label">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              data-testid="terms-agree-checkbox"
              className="mt-0.5 w-4 h-4 shrink-0 accent-[#2E6BFF]"
            />
            <span className="text-xs text-slate-400 leading-relaxed">
              I have read and agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" data-testid="terms-agree-link" className="text-[#7FB0FF] hover:text-white underline underline-offset-2 transition-colors">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" data-testid="privacy-agree-link" className="text-[#7FB0FF] hover:text-white underline underline-offset-2 transition-colors">
                Privacy Policy
              </a>
              . All sales are final except where required by law.
            </span>
          </label>

          <button
            onClick={checkout}
            disabled={loading || items.length === 0 || !agreed}
            data-testid="cart-checkout-button"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 active:scale-95"
          >
            <Lock className="w-4 h-4" />
            {loading ? "Redirecting to Stripe..." : "Pay with card"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          {SHOW_PAYPAL && PAYPAL_CLIENT_ID && (
            <div data-testid="paypal-section">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <div className="flex-1 h-px bg-[#1E2D4A]" />
                <span>or</span>
                <div className="flex-1 h-px bg-[#1E2D4A]" />
              </div>
              <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "EUR" }}>
                <div data-testid="paypal-buttons" className="min-h-[45px]">
                  <PayPalButtons
                    style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 45 }}
                    disabled={items.length === 0}
                    forceReRender={[payable, email]}
                    createOrder={async () => {
                      if (!validEmail) {
                        toast.error("Enter your email first — keys are delivered there");
                        throw new Error("email required");
                      }
                      localStorage.setItem("void_email", email);
                      const { data } = await api.post("/paypal/create", cartPayload());
                      return data.paypal_order_id;
                    }}
                    onApprove={async (data) => {
                      try {
                        const res = await api.post("/paypal/capture", { paypal_order_id: data.orderID });
                        window.location.href = `/payment/success?order=${res.data.order_id}`;
                      } catch (e) {
                        toast.error(apiError(e));
                      }
                    }}
                    onError={() => toast.error("PayPal hit an error — try again or pay by card")}
                    onCancel={() => toast.info("PayPal checkout cancelled")}
                  />
                </div>
              </PayPalScriptProvider>
            </div>
          )}

          <p className="text-xs text-slate-600 text-center">
            Keys are emailed to you instantly after payment
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
