import { useState } from "react";
import { Link2, Send } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const BOOST_STATUS_STYLE = {
  pending: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  processing: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  completed: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
};

export function BoostStatusBadge({ status, testid }) {
  return (
    <span data-testid={testid} className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border rounded-lg ${BOOST_STATUS_STYLE[status] || BOOST_STATUS_STYLE.pending}`}>
      {status || "pending"}
    </span>
  );
}

export default function BoostIntake({ orderId, item, detail, onSaved }) {
  const [link, setLink] = useState(detail?.link || "");
  const [saving, setSaving] = useState(false);
  const platform = item.platform === "tiktok" ? "TikTok" : "Instagram";
  const ask = item.boost_type === "followers"
    ? `Link to your ${platform} page`
    : `Link to the ${platform} video/post you want ${item.boost_type || "boosted"}`;

  const submit = async () => {
    if (!link.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/orders/by-id/${orderId}/boost-details`, {
        details: [{ product_id: item.product_id, duration: item.duration, link: link.trim() }],
      });
      toast.success("Link received — our team will start your boost");
      onSaved?.(data.boost_details);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-[#050B18] border border-pink-400/30 rounded-lg" data-testid={`boost-intake-${item.product_id}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-100">{item.name}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-pink-300/80 mt-0.5">
            {platform} {item.boost_type} · {(item.qty || 1).toLocaleString()} {item.duration_label}
          </div>
        </div>
        {detail && <BoostStatusBadge status={detail.status} testid={`boost-status-${item.product_id}`} />}
      </div>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={`${ask} — https://...`}
            data-testid={`boost-link-input-${item.product_id}`}
            className="w-full bg-[#0A1628] border border-[#1E2D4A] rounded-md pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-pink-400/60"
          />
        </div>
        <button
          onClick={submit}
          disabled={saving || !link.trim()}
          data-testid={`boost-submit-${item.product_id}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-pink-500 hover:bg-pink-400 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
        >
          <Send className="w-3.5 h-3.5" /> {saving ? "Sending..." : detail ? "Update link" : "Submit link"}
        </button>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        {detail
          ? "Link received — our team fulfils boosts manually. Status updates here and in your Customer Portal."
          : `${ask}. We start the boost as soon as your link is in.`}
      </div>
    </div>
  );
}
