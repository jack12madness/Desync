const STATUS_STYLES = {
  undetected: { dot: "bg-emerald-400", text: "text-emerald-400", border: "border-emerald-400/40", bg: "bg-emerald-400/10", label: "Undetected" },
  updating: { dot: "bg-amber-400", text: "text-amber-400", border: "border-amber-400/40", bg: "bg-amber-400/10", label: "Updating" },
  detected: { dot: "bg-rose-500", text: "text-rose-400", border: "border-rose-500/40", bg: "bg-rose-500/10", label: "Detected" },
  testing: { dot: "bg-cyan-400", text: "text-cyan-300", border: "border-cyan-400/40", bg: "bg-cyan-400/10", label: "Testing" },
};

export default function StatusPill({ status, testid }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.testing;
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-2 px-3 py-1 border ${s.border} ${s.bg} clip-tag-sm`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className={`status-dot relative inline-flex rounded-full h-1.5 w-1.5 ${s.dot}`} />
      </span>
      <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${s.text}`}>{s.label}</span>
    </span>
  );
}
