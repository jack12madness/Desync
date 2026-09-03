import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import StatusPill from "@/components/StatusPill";
import { eur } from "@/lib/api";

export default function ProductCard({ product, index, onSelect }) {
  const prices = Object.values(product.prices || {});
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const durations = Object.keys(product.prices || {});
  const soldOut = durations.length > 0 && durations.every((d) => !(product.stock?.[d] > 0));

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onSelect(product)}
      data-testid={`product-card-${product.id}`}
      className="group relative rounded-xl overflow-hidden bg-[#0A1628] border border-[#1E2D4A] hover:border-[#2E6BFF]/60 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_12px_30px_rgba(46,107,255,0.2)] cursor-pointer"
    >
      <div className="relative aspect-[3/4]">
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover saturate-[0.75] group-hover:saturate-100 group-hover:scale-105 transition-all duration-700 ${soldOut ? "opacity-40 grayscale-[0.4]" : ""}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050B18] via-[#050B18]/25 to-transparent" />
        <div className="absolute top-4 left-4 z-10">
          {product.kind === "account" ? (
            <span
              data-testid={`product-stock-badge-${product.id}`}
              className="px-2.5 py-1 rounded-md bg-violet-400/15 border border-violet-400/40 text-violet-300 text-[10px] font-mono font-bold uppercase tracking-[0.2em]"
            >
              {soldOut ? "Discord Accounts" : `${durations.reduce((s, d) => s + (product.stock?.[d] || 0), 0)} in stock`}
            </span>
          ) : (
            <StatusPill status={product.status} testid={`product-status-badge-${product.id}`} />
          )}
        </div>
        {soldOut && (
          <div className="absolute top-4 right-4 z-10" data-testid={`product-soldout-badge-${product.id}`}>
            <span className="px-2.5 py-1 rounded-md bg-rose-500/90 text-white text-[10px] font-mono font-bold uppercase tracking-[0.2em] shadow-lg">
              Sold Out
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5 z-10">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#5B8CFF] mb-1.5">
            {product.game}
          </div>
          <h3 className="font-display text-lg font-bold tracking-tight text-slate-100 leading-snug group-hover:text-white transition-colors">
            {product.name}
          </h3>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">From</span>
              <span className="ml-2 font-mono text-lg font-bold text-[#7FB0FF]">{eur(minPrice)}</span>
            </div>
            <button
              data-testid={`product-buy-button-${product.id}`}
              aria-label={`Configure ${product.name}`}
              className="w-10 h-10 rounded-full bg-[#2E6BFF] hover:bg-[#1D55E0] text-white flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-[0_0_20px_rgba(46,107,255,0.45)]"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
