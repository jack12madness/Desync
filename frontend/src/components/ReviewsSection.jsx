import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";

function Stars({ n }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= n ? "text-amber-300 fill-amber-300" : "text-slate-700"}`} />
      ))}
    </span>
  );
}

export default function ReviewsSection() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/reviews").then(({ data }) => setData(data)).catch(() => setData({ reviews: [], count: 0 }));
  }, []);

  if (!data) return null;

  return (
    <section className="relative py-20 sm:py-24 border-t border-[#1E2D4A]" data-testid="reviews-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <div className="text-sm font-medium text-[#5B8CFF] mb-2">Reviews</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white" data-testid="reviews-title">
              What our customers say
            </h2>
            {data.count > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-400" data-testid="reviews-summary">
                <Stars n={Math.round(data.average)} />
                <span className="font-mono">{data.average}</span>
                <span>· {data.count} review{data.count === 1 ? "" : "s"}</span>
              </div>
            )}
          </div>
          <Link
            to="/portal"
            data-testid="leave-review-button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold transition-all duration-200 active:scale-95"
          >
            <MessageSquare className="w-4 h-4" /> Leave a Review
          </Link>
        </div>

        {data.count === 0 ? (
          <div className="text-center py-10 text-sm text-slate-500" data-testid="reviews-empty">
            No reviews yet — be the first after your purchase
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="reviews-grid">
            {data.reviews.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl"
                data-testid={`review-card-${r.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Stars n={r.rating} />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{r.text}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">{r.name}</span>
                  {r.product_name && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#5B8CFF]">{r.product_name}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
