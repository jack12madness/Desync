import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function WaitlistTab() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get("/admin/waitlist").then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, []);

  if (rows === null) {
    return <div className="py-16 text-center font-mono text-sm text-slate-500 uppercase tracking-[0.25em]">Loading...</div>;
  }

  return (
    <div>
      <h2 className="font-display text-xl font-bold uppercase tracking-tight mb-6">
        {rows.length} on the Drop List
      </h2>
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
