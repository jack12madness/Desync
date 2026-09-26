import { useState } from "react";
import { Check, ShoppingCart, Zap, ShieldCheck, Share2, ChevronDown, Cpu, Wrench } from "lucide-react";
import ScrollModal from "@/components/ScrollModal";
import StatusPill from "@/components/StatusPill";
import { useCart, DURATION_LABELS } from "@/context/CartContext";
import { aud, BASE_URL } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const DURATION_ORDER = ["day", "3d", "week", "month", "lifetime"];

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

export function RichDescription({ text }) {
  const lines = (text || "").split("\n");
  return (
    <div data-testid="rich-description">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-2.5" />;
        if (t.startsWith("## ")) {
          return (
            <h4 key={i} className="font-display text-base font-bold tracking-tight text-white mt-4 mb-1.5 first:mt-0">
              {renderInline(t.slice(3))}
            </h4>
          );
        }
        if (t.startsWith("- ") || t.startsWith("• ")) {
          return (
            <div key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
              <Check className="w-3.5 h-3.5 text-[#5B8CFF] shrink-0 mt-1" />
              <span>{renderInline(t.slice(2))}</span>
            </div>
          );
        }
        if (t.endsWith(":") && t.length < 60) {
          return (
            <div key={i} className="text-xs font-mono uppercase tracking-[0.2em] text-[#5B8CFF] mt-4 mb-1 first:mt-0">
              {renderInline(t.slice(0, -1))}
            </div>
          );
        }
        return <p key={i} className="text-sm text-slate-400 leading-relaxed">{renderInline(t)}</p>;
      })}
    </div>
  );
}

function CollapsibleSection({ icon: Icon, title, testid, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-lg border border-[#1E2D4A] bg-[#050B18] overflow-hidden" data-testid={testid}>
      <button
        onClick={() => setOpen(!open)}
        data-testid={`${testid}-toggle`}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-[#0A1628] transition-colors"
      >
        <Icon className="w-4 h-4 text-[#5B8CFF] shrink-0" />
        <span className="text-sm font-semibold text-slate-200 flex-1">{title}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`grid transition-all duration-200 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        data-testid={`${testid}-body`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function TroubleItem({ issue, fix, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-[#1E2D4A] overflow-hidden" data-testid={`trouble-item-${index}`}>
      <button
        onClick={() => setOpen(!open)}
        data-testid={`trouble-item-toggle-${index}`}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#0A1628] transition-colors"
      >
        <span className="text-xs font-semibold text-slate-200 flex-1">{issue}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-all duration-200 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="px-3 pb-3 text-xs text-slate-400 leading-relaxed" data-testid={`trouble-item-fix-${index}`}>{fix}</p>
        </div>
      </div>
    </div>
  );
}

export default function ProductModal({ product, onClose }) {
  const { addItem, openCart } = useCart();
  const durations = product
    ? DURATION_ORDER.filter((d) => product.prices && product.prices[d] != null)
    : [];
  const [duration, setDuration] = useState(null);
  const selected = duration && durations.includes(duration) ? duration : durations[0];
  const soldOut = product
    ? product.delivery !== "ticket" && durations.length > 0 && durations.every((d) => !(product.stock?.[d] > 0))
    : false;

  if (!product) return null;

  const requirements = (product.system_requirements || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const troubles = Array.isArray(product.troubleshooting) ? product.troubleshooting.filter((t) => t.issue && t.fix) : [];

  return (
    <ScrollModal onClose={onClose} testid="product-detail-modal" className="max-w-3xl !p-0 overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div>
            <div className="relative h-64 md:h-80 overflow-hidden bg-[#050B18]">
              <img src={product.image_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40 saturate-[0.6]" />
              <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-contain" data-testid="modal-product-image" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628] via-transparent to-transparent" />
              <div className="absolute top-4 left-4">
                {product.kind === "account" ? (
                  <span
                    data-testid="modal-status-badge"
                    className="px-2.5 py-1 rounded-md bg-violet-400/15 border border-violet-400/40 text-violet-300 text-[10px] font-mono font-bold uppercase tracking-[0.2em]"
                  >
                    Discord Account
                  </span>
                ) : (
                  <StatusPill status={product.status} testid="modal-status-badge" />
                )}
              </div>
            </div>
            {product.description && (
              <div className="p-6 sm:p-8 md:pr-4" data-testid="modal-description">
                <RichDescription text={product.description} />
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[#5B8CFF] mb-1">{product.game}</div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                  {product.name}
                </h2>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${BASE_URL}/api/share/product/${product.id}`);
                  toast.success("Share link copied — paste it in Discord");
                }}
                data-testid="share-product-button"
                title="Copy share link"
                className="shrink-0 mt-1 p-2 rounded-lg border border-[#2E6BFF]/40 text-[#8FB8E8] hover:bg-[#2E6BFF]/10 transition-all duration-200"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

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
                      {aud(product.prices[d])}
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

            {(product.min_buy || 1) > 1 && (
              <div className="mt-4 p-3 rounded-lg bg-[#2E6BFF]/10 border border-[#2E6BFF]/30 text-xs text-[#8FB8E8] leading-relaxed" data-testid="modal-min-buy-note">
                Sold in packs — minimum {product.min_buy} per purchase. Price shown is per unit; you can raise the quantity in the cart.
              </div>
            )}

            {requirements.length > 0 && (
              <CollapsibleSection icon={Cpu} title="System Requirements" testid="modal-sysreq">
                <ul className="space-y-1.5">
                  {requirements.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                      <Check className="w-3.5 h-3.5 text-[#5B8CFF] shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {troubles.length > 0 && (
              <CollapsibleSection icon={Wrench} title="Troubleshooting" testid="modal-troubleshooting">
                <div className="space-y-2">
                  {troubles.map((t, i) => (
                    <TroubleItem key={i} issue={t.issue} fix={t.fix} index={i} />
                  ))}
                </div>
              </CollapsibleSection>
            )}

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
    </ScrollModal>
  );
}
