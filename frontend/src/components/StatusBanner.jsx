const READOUTS = [
  { k: "SYSTEMS", v: "NOMINAL", tone: "text-emerald-400" },
  { k: "UPTIME 30D", v: "99.8%", tone: "text-cyan-300" },
  { k: "LAST STATUS SWEEP", v: "5 MIN AGO", tone: "text-cyan-300" },
  { k: "KEY DELIVERY", v: "INSTANT", tone: "text-emerald-400" },
  { k: "SUPPORT", v: "24/7 DISCORD", tone: "text-cyan-300" },
];

export default function StatusBanner() {
  return (
    <div className="border-y border-cyan-500/10 bg-[#0B0E17]/60" data-testid="status-banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center gap-x-10 gap-y-3 justify-center">
        {READOUTS.map((r) => (
          <div key={r.k} className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
            <span className="text-slate-600">{r.k}</span>
            <span className="text-slate-700">//</span>
            <span className={r.tone}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
