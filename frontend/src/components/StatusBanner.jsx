import { Zap, Activity, Headphones, ShieldCheck } from "lucide-react";

const ITEMS = [
  { icon: Zap, label: "Instant key delivery" },
  { icon: Activity, label: "Live status updates" },
  { icon: Headphones, label: "24/7 Discord support" },
  { icon: ShieldCheck, label: "Honest detection status" },
];

export default function StatusBanner() {
  return (
    <div className="border-y border-[#1E2D4A] bg-[#0A1628]/50" data-testid="status-banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center gap-x-10 gap-y-3 justify-center">
        {ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <item.icon className="w-4 h-4 text-[#5B8CFF]" />
            <span className="text-sm text-slate-300">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
