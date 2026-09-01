const STATUS_STYLES = {
  undetected: { dot: "bg-emerald-400", text: "text-emerald-300", border: "border-emerald-400/30", bg: "bg-emerald-400/10", label: "Undetected" },
  updating: { dot: "bg-amber-400", text: "text-amber-300", border: "border-amber-400/30", bg: "bg-amber-400/10", label: "Updating" },
  detected: { dot: "bg-rose-500", text: "text-rose-300", border: "border-rose-500/30", bg: "bg-rose-500/10", label: "Detected" },
  testing: { dot: "bg-[#5B8CFF]", text: "text-[#8FB8E8]", border: "border-[#2E6BFF]/40", bg: "bg-[#2E6BFF]/10", label: "Testing" },
};

export default function StatusPill({ status, testid }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.testing;
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${s.border} ${s.bg} backdrop-blur-sm`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className={`status-dot relative inline-flex rounded-full h-1.5 w-1.5 ${s.dot}`} />
      </span>
      <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
    </span>
  );
}
