import { useEffect, useState } from "react";
import { Star, Check, EyeOff, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const STATUS_STYLE = {
  pending: "bg-amber-400/10 border-amber-400/40 text-amber-300",
  approved: "bg-emerald-400/10 border-emerald-400/40 text-emerald-300",
  hidden: "bg-slate-500/10 border-slate-500/40 text-slate-400",
};

export default function ReviewsTab() {
  const [reviews, setReviews] = useState([]);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("all");
  const [productId, setProductId] = useState("all");

  const load = () => {
    const params = {};
    if (status !== "all") params.status = status;
    if (productId !== "all") params.product_id = productId;
    api.get("/admin/reviews", { params }).then(({ data }) => setReviews(data)).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [status, productId]);

  useEffect(() => {
    api.get("/admin/products").then(({ data }) => setProducts(data)).catch(() => {});
  }, []);

  const act = async (id, action) => {
    try {
      await api.post(`/admin/reviews/${id}/action`, { action });
      toast.success(action === "approve" ? "Review is now public" : "Review hidden");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this review permanently?")) return;
    try {
      await api.delete(`/admin/reviews/${id}`);
      toast.success("Review deleted");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div data-testid="reviews-tab">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight">{reviews.length} Reviews</h2>
        <div className="flex gap-1" data-testid="reviews-status-filter">
          {["all", "pending", "approved", "hidden"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              data-testid={`reviews-filter-${s}`}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-widest border transition-all ${
                status === s ? "bg-[#2E6BFF] border-[#2E6BFF] text-white" : "border-[#1E2D4A] text-slate-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger data-testid="reviews-product-filter" className="w-56 bg-[#050B18] border-slate-700 font-mono text-sm">
            <SelectValue placeholder="All products" />
          </SelectTrigger>
          <SelectContent className="bg-[#0A1628] border-slate-700 text-slate-100">
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3" data-testid="admin-reviews-list">
        {reviews.length === 0 && (
          <div className="text-center py-16 font-mono text-sm text-slate-500 uppercase tracking-[0.25em]" data-testid="reviews-empty">
            No reviews here — customer submissions land in Pending first
          </div>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="p-4 bg-[#0F1F38] border border-blue-900/40 rounded-lg" data-testid={`admin-review-${r.id}`}>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-amber-300 text-sm tracking-tight">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              <span className="text-sm font-medium text-slate-200">{r.name}</span>
              {r.product_name && (
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#5B8CFF]">{r.product_name}</span>
              )}
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`} data-testid={`review-status-${r.id}`}>
                {r.status}
              </span>
              <span className="text-[10px] font-mono text-slate-600 ml-auto">
                {r.email} · order {r.order_id.slice(0, 8)} · {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">{r.text}</p>
            <div className="flex gap-2">
              {r.status !== "approved" && (
                <button onClick={() => act(r.id, "approve")} data-testid={`review-approve-${r.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs hover:bg-emerald-500/10 transition-colors">
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
              )}
              {r.status !== "hidden" && (
                <button onClick={() => act(r.id, "hide")} data-testid={`review-hide-${r.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-300 text-xs hover:bg-amber-500/10 transition-colors">
                  <EyeOff className="w-3.5 h-3.5" /> Hide
                </button>
              )}
              <button onClick={() => remove(r.id)} data-testid={`review-delete-${r.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 text-xs hover:bg-rose-500/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
