import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatusBanner from "@/components/StatusBanner";
import ProductCard from "@/components/ProductCard";
import ProductModal from "@/components/ProductModal";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/products")
      .then(({ data }) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
    api.get("/categories").then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  const games = useMemo(() => ["All", ...categories.map((c) => c.name)], [categories]);
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
            <div className="text-sm font-medium text-[#5B8CFF] mb-2">Shop</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              All cheats & hacks
            </h2>
          </motion.div>

          <div className="flex flex-wrap gap-2 mb-10" data-testid="game-filter-tabs">
            {games.map((g) => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                data-testid={`filter-tab-${g.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={`rounded-full px-5 py-2 text-sm font-medium border transition-all duration-200 ${
                  filter === g
                    ? "bg-[#2E6BFF] text-white border-[#2E6BFF]"
                    : "border-[#1E2D4A] text-slate-400 hover:border-[#2E6BFF]/50 hover:text-white"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-24 text-center text-sm text-slate-500" data-testid="shop-loading">
              Loading products...
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

      <Faq />
      <Footer />

      <ProductModal product={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
