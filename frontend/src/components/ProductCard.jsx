import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import StatusPill from "@/components/StatusPill";
import { eur } from "@/lib/api";

export default function ProductCard({ product, index, onSelect }) {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const prices = Object.values(product.prices || {});
  const minPrice = prices.length ? Math.min(...prices) : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: (index % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
      }}
      onClick={() => onSelect(product)}
      data-testid={`product-card-${product.id}`}
      className="group relative bg-[#0F1422] border border-cyan-900/40 hover:border-cyan-400/60 rounded-lg overflow-hidden cursor-pointer transition-colors duration-300"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10"
        style={{
          background: `radial-gradient(320px circle at ${pos.x}% ${pos.y}%, rgba(0,240,255,0.12), transparent 65%)`,
        }}
      />

      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover saturate-[0.7] group-hover:saturate-100 group-hover:scale-105 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1422] via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <StatusPill status={product.status} testid={`product-status-badge-${product.id}`} />
        </div>
      </div>

      <div className="relative z-20 p-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-500 mb-2">
          {product.game}
        </div>
        <h3 className="font-display text-xl font-bold tracking-tight text-slate-100 group-hover:text-cyan-200 transition-colors duration-300">
          {product.name}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(product.features || []).slice(0, 3).map((f) => (
            <span
              key={f}
              className="text-[10px] font-mono uppercase tracking-wider text-slate-500 border border-slate-700/60 px-2 py-0.5"
            >
              {f}
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">From</span>
            <span className="ml-2 font-mono text-lg font-bold text-cyan-300">{eur(minPrice)}</span>
          </div>
          <button
            data-testid={`product-buy-button-${product.id}`}
            className="clip-tag-sm inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-400/10 border border-cyan-400/40 text-cyan-300 text-xs font-mono uppercase tracking-widest group-hover:bg-cyan-400 group-hover:text-[#06070B] transition-all duration-300"
          >
            Configure <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
