import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatusBanner from "@/components/StatusBanner";
import ProductCard from "@/components/ProductCard";
import ProductModal from "@/components/ProductModal";
import ReviewsMarquee from "@/components/ReviewsMarquee";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/products")
      .then(({ data }) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const games = useMemo(() => ["All", ...new Set(products.map((p) => p.game))], [products]);
  const visible = filter === "All" ? products : products.filter((p) => p.game === filter);

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
            className="mb-10"
          >
            <div className="text-xs font-mono uppercase tracking-[0.25em] text-blue-400 mb-2">// The Armoury</div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight">
              Choose Your Weapon
            </h2>
          </motion.div>

          <div className="flex flex-wrap gap-2 mb-10" data-testid="game-filter-tabs">
            {games.map((g) => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                data-testid={`filter-tab-${g.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={`clip-tag-sm px-4 py-2 text-xs font-mono uppercase tracking-[0.15em] border transition-all duration-200 ${
                  filter === g
                    ? "bg-blue-400 text-[#050B18] border-blue-400 font-bold"
                    : "border-slate-700/60 text-slate-400 hover:border-blue-500/40 hover:text-blue-300"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-24 text-center font-mono text-sm text-slate-500 uppercase tracking-[0.25em]" data-testid="shop-loading">
              Loading armoury...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8" data-testid="product-grid">
              {visible.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} onSelect={setSelected} />
              ))}
            </div>
          )}
        </div>
      </section>

      <ReviewsMarquee />
      <Faq />
      <Footer />

      <ProductModal product={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
