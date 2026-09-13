import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Bitcoin } from "lucide-react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatusBanner from "@/components/StatusBanner";
import ProductCard from "@/components/ProductCard";
import ProductModal from "@/components/ProductModal";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import { api, eur } from "@/lib/api";

const FALLBACK_IMG = "/images/og-banner.png";

function CollectionCard({ category, index, onSelect }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      onClick={() => onSelect(category.name)}
      data-testid={`collection-card-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      className="group relative overflow-hidden rounded-2xl border border-[#1E2D4A] bg-[#0A1628] text-left aspect-[16/9] sm:aspect-[2/1] w-full cursor-pointer"
    >
      <img
        src={category.image_url || FALLBACK_IMG}
        alt={category.name}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover opacity-70 saturate-[0.8] group-hover:opacity-90 group-hover:scale-105 transition-all duration-700"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050B18] via-[#050B18]/30 to-[#050B18]/10" />
      <div className="absolute top-4 left-4 z-10">
        <span className="px-2.5 py-1 rounded-md bg-[#050B18]/80 border border-[#2E6BFF]/40 text-[#8FB8E8] text-[10px] font-mono font-bold uppercase tracking-[0.25em] backdrop-blur">
          Collection
        </span>
      </div>
      <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 z-10 flex items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
            {category.name}
          </h3>
          {category.min_price != null && (
            <div className="font-mono text-sm text-[#8FB8E8]" data-testid={`collection-price-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              {eur(category.min_price)}{category.max_price !== category.min_price ? ` – ${eur(category.max_price)}` : ""}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 px-2.5 py-1 rounded-full border border-[#1E2D4A] bg-[#050B18]/70 backdrop-blur" data-testid={`collection-count-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            {category.product_count ?? 0} product{category.product_count === 1 ? "" : "s"}
          </span>
          <span className="w-9 h-9 rounded-full bg-[#2E6BFF] flex items-center justify-center group-hover:bg-[#1D55E0] group-hover:scale-110 transition-all duration-200">
            <ArrowRight className="w-4 h-4 text-white" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/products")
      .then(({ data }) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
    api.get("/categories").then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  const visible = activeCat ? products.filter((p) => p.game === activeCat) : [];

  const pickCategory = (name) => {
    setActiveCat(name);
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div data-testid="home-page">
      <Navbar />
      <Hero />
      <StatusBanner />

      <section id="shop" className="py-16 sm:py-24 scroll-mt-16" data-testid="shop-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10 flex items-end justify-between gap-4"
          >
            <div>
              <div className="text-sm font-medium text-[#5B8CFF] mb-2">Shop</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white" data-testid="shop-title">
                {activeCat ? activeCat : "Browse collections"}
              </h2>
              <div
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#F7931A]/40 bg-[#F7931A]/10 text-[#F5B45E] text-[10px] font-mono font-bold uppercase tracking-[0.2em]"
                data-testid="crypto-accepted-badge"
              >
                <Bitcoin className="w-3.5 h-3.5" /> Crypto accepted — BTC, USDT & more
              </div>
            </div>
            {activeCat && (
              <button
                onClick={() => setActiveCat(null)}
                data-testid="back-to-collections"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1E2D4A] text-sm text-slate-300 hover:border-[#2E6BFF]/50 hover:text-white transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> All collections
              </button>
            )}
          </motion.div>

          {loading ? (
            <div className="py-24 text-center text-sm text-slate-500" data-testid="shop-loading">
              Loading...
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {!activeCat ? (
                <motion.div
                  key="collections"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8"
                  data-testid="collections-grid"
                >
                  {categories.length === 0 && (
                    <div className="col-span-full py-24 text-center text-sm text-slate-500" data-testid="collections-empty">
                      Nothing here yet — check back soon.
                    </div>
                  )}
                  {categories.map((c, i) => (
                    <CollectionCard key={c.id} category={c} index={i} onSelect={pickCategory} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key={`products-${activeCat}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
                  data-testid="product-grid"
                >
                  {visible.length === 0 && (
                    <div className="col-span-full py-24 text-center text-sm text-slate-500" data-testid="category-empty">
                      No products in this collection yet.
                    </div>
                  )}
                  {visible.map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} onSelect={setSelected} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </section>

      <Faq />
      <Footer />

      <ProductModal product={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
