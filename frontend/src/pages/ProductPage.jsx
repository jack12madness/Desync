import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductModal from "@/components/ProductModal";
import { api } from "@/lib/api";

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get("/products")
      .then(({ data }) => {
        const p = data.find((x) => x.id === id);
        if (p) setProduct(p);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  return (
    <div className="min-h-screen bg-[#050B18]" data-testid="product-page">
      <Navbar />
      {notFound && (
        <main className="max-w-3xl mx-auto px-4 pt-40 pb-24 text-center" data-testid="product-not-found">
          <h1 className="font-display text-2xl font-bold text-white mb-3">Product not found</h1>
          <p className="text-sm text-slate-400 mb-6">This product may have been removed or the link is wrong.</p>
          <Link
            to="/"
            data-testid="back-to-store"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold transition-colors"
          >
            Back to store
          </Link>
        </main>
      )}
      <ProductModal product={product} onClose={() => navigate("/")} />
      <Footer />
    </div>
  );
}
