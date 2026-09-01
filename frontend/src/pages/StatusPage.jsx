import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatusPill from "@/components/StatusPill";
import { api } from "@/lib/api";

export default function StatusPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/status")
      .then(({ data }) => setRows(data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="status-page">
      <Navbar />
      <main className="pt-28 pb-24 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="text-sm font-medium text-[#5B8CFF] mb-2">Live feed</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              Cheat status
            </h1>
            <p className="text-sm text-slate-400 mb-10 max-w-xl">
              Honest, live status for every product. Never inject anything that isn't showing Undetected.
            </p>
          </motion.div>

          {loading ? (
            <div className="py-20 text-center text-sm text-slate-500">Checking status...</div>
          ) : (
            <div className="space-y-3" data-testid="status-matrix">
              {rows.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  data-testid={`status-row-${r.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-4 bg-[#0A1628] border border-[#1E2D4A] rounded-xl hover:border-[#2E6BFF]/40 transition-colors duration-200"
                >
                  <StatusPill status={r.status} testid={`status-pill-${r.id}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{r.name}</div>
                    <div className="text-xs text-slate-500">
                      {r.game} · Anti-cheat: {r.anticheat || "—"}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">
                    Updated {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
