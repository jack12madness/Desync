import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

export default function WaitlistTab() {
  const [rows, setRows] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get("/admin/waitlist").then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await api.get("/admin/waitlist/export", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "desync-waitlist.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Waitlist downloaded");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setExporting(false);
    }
  };

  if (rows === null) {
    return <div className="py-16 text-center font-mono text-sm text-slate-500 uppercase tracking-[0.25em]">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight">
          {rows.length} on the Drop List
        </h2>
        <button
          onClick={exportCsv}
          disabled={exporting || rows.length === 0}
          data-testid="waitlist-export-button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2E6BFF]/40 text-[#8FB8E8] text-sm font-medium hover:bg-[#2E6BFF]/10 disabled:opacity-40 transition-all duration-200"
        >
          <Download className="w-4 h-4" /> {exporting ? "Downloading..." : "Export CSV"}
        </button>
      </div>
      <div className="space-y-2" data-testid="admin-waitlist-list">
        {rows.length === 0 && (
          <div className="text-center py-16 font-mono text-sm text-slate-500 uppercase tracking-[0.25em]">
            Nobody waiting yet — share the /drop page
          </div>
        )}
        {rows.map((w) => (
          <div
            key={w.id}
            className="flex items-center gap-4 p-3 bg-[#0F1F38] border border-[#1E2D4A] rounded-lg"
            data-testid={`waitlist-row-${w.id}`}
          >
            <span className="font-mono text-sm text-slate-100 flex-1">{w.email}</span>
            <span className="text-[10px] font-mono text-slate-600">{new Date(w.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
