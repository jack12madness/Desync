import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Lock, ArrowRight, Tag, Landmark, Minus, Plus, Bitcoin } from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useCart, DURATION_LABELS } from "@/context/CartContext";
import { api, apiError, aud } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID;
const SHOW_PAYPAL = false; // PayPal hidden for now — set true to re-enable

export default function CartDrawer() {
  const { items, removeItem, setQty, total, isOpen, closeCart } = useCart();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => localStorage.getItem("void_email") || "");
  const [discordUser, setDiscordUser] = useState(() => localStorage.getItem("void_discord") || "");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  // product-tied codes discount only that product's lines; store-wide codes discount everything
  const discountable = coupon?.product_id
    ? items.reduce((s, i) => (i.product.id === coupon.product_id ? s + i.price * (i.qty || 1) : s), 0)
    : total;
  const discount = coupon ? (discountable * coupon.percent) / 100 : 0;
  const payable = Math.max(0, total - discount);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const cartPayload = () => ({
    email,
    discord_username: discordUser.trim(),
    items: items.map((i) => ({ product_id: i.product.id, duration: i.duration, qty: i.qty || 1 })),
    coupon: coupon ? coupon.code : null,
  });

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setChecking(true);
    try {
      const { data } = await api.post("/coupons/validate", { code: couponInput.trim() });
      setCoupon(data);
      const targeted = data.product_id && !items.some((i) => i.product.id === data.product_id);
      toast.success(
        targeted
          ? `${data.code} applied — it discounts its product once it's in your cart`
          : `${data.code} applied — ${data.percent}% off`
      );
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
    if (!discordUser.trim()) {
      toast.error("Enter your Discord username");
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

  const bankCheckout = async () => {
    if (!validEmail) {
      toast.error("Enter a valid email — your keys are delivered there");
      return;
    }
    if (!discordUser.trim()) {
      toast.error("Enter your Discord username");
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
      const { data } = await api.post("/payments/bank-transfer", {
        ...cartPayload(),
        origin_url: window.location.origin,
      });
      navigate(`/payment/bank-pending?order=${data.order_id}`);
      closeCart();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const cryptoCheckout = async () => {
    if (!validEmail) {
      toast.error("Enter a valid email — your keys are delivered there");
      return;
    }
    if (!discordUser.trim()) {
      toast.error("Enter your Discord username");
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
      const { data } = await api.post("/payments/crypto", {
        ...cartPayload(),
        origin_url: window.location.origin,
      });
      window.location.href = data.invoice_url;
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
                  {item.product.game} · {item.duration_label || DURATION_LABELS[item.duration] || item.duration}
                  {(item.qty || 1) > 1 && <span className="text-[#8FB8E8]"> × {item.qty}</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5" data-testid={`qty-stepper-${item.product.id}`}>
                  <button
                    onClick={() => setQty(idx, (item.qty || 1) - 1)}
                    disabled={(item.qty || 1) <= Math.max(1, item.product.min_buy || 1)}
                    data-testid={`qty-minus-${item.product.id}`}
                    className="w-5 h-5 inline-flex items-center justify-center rounded border border-[#1E2D4A] text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono text-xs text-slate-300 w-6 text-center" data-testid={`qty-value-${item.product.id}`}>{item.qty || 1}</span>
                  <button
                    onClick={() => setQty(idx, (item.qty || 1) + 1)}
                    data-testid={`qty-plus-${item.product.id}`}
                    className="w-5 h-5 inline-flex items-center justify-center rounded border border-[#1E2D4A] text-slate-400 hover:text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="font-mono text-sm font-bold text-[#8FB8E8]">{aud(item.price * (item.qty || 1))}</div>
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
              <span className="font-mono text-sm text-slate-300" data-testid="cart-subtotal">{aud(total)}</span>
            </div>
            {coupon && (
              <div className="flex items-center justify-between" data-testid="cart-discount-line">
                <span className="text-sm text-emerald-300">Discount ({coupon.code})</span>
                <span className="font-mono text-sm text-emerald-300">-{aud(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-[#1E2D4A]">
              <span className="text-sm font-semibold text-white">Total</span>
              <span className="font-mono text-xl font-bold text-white" data-testid="cart-total">{aud(payable)}</span>
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

          <div>
            <label className="text-sm text-slate-300 block mb-2">
              Discord username — for support & delivery
            </label>
            <Input
              value={discordUser}
              onChange={(e) => {
                setDiscordUser(e.target.value);
                localStorage.setItem("void_discord", e.target.value);
              }}
              placeholder="e.g. desyncuser"
              data-testid="cart-discord-input"
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
            disabled={loading || items.length === 0 || !agreed || !discordUser.trim()}
            data-testid="cart-checkout-button"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 active:scale-95"
          >
            <Lock className="w-4 h-4" />
            {loading ? "Redirecting to Stripe..." : "Pay with card"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <button
            onClick={bankCheckout}
            disabled={loading || items.length === 0 || !agreed || !discordUser.trim()}
            data-testid="cart-bank-transfer-button"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-[#2E6BFF]/40 text-[#8FB8E8] text-sm font-semibold hover:bg-[#2E6BFF]/10 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
          >
            <Landmark className="w-4 h-4" />
            {loading ? "Reserving..." : "Bank Transfer (PayID / BSB)"}
          </button>
          <p className="text-center text-[11px] text-slate-500 -mt-1" data-testid="bank-transfer-note">
            Bank transfer is manually confirmed — not instant delivery
          </p>

          <button
            onClick={cryptoCheckout}
            disabled={loading || items.length === 0 || !agreed || !discordUser.trim()}
            data-testid="cart-crypto-button"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-[#F7931A]/40 text-[#F5B45E] text-sm font-semibold hover:bg-[#F7931A]/10 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
          >
            <Bitcoin className="w-4 h-4" />
            {loading ? "Redirecting..." : "Pay with Crypto (BTC, USDT & more)"}
          </button>
          <p className="text-center text-[11px] text-slate-500 -mt-1" data-testid="crypto-note">
            Crypto delivers automatically once the network confirms — usually a few minutes
          </p>

          {SHOW_PAYPAL && PAYPAL_CLIENT_ID && (
            <div data-testid="paypal-section">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <div className="flex-1 h-px bg-[#1E2D4A]" />
                <span>or</span>
                <div className="flex-1 h-px bg-[#1E2D4A]" />
              </div>
              <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "AUD" }}>
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
