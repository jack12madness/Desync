import { Star } from "lucide-react";

const REVIEWS = [
  { name: "Kaz", game: "FiveM", text: "Key in my inbox before I even alt-tabbed. Executor is clean, zero bans in 3 months." },
  { name: "retro.gg", game: "Rust", text: "Support walked me through the whole injection at 2am. Actual humans." },
  { name: "Milano", game: "Warzone", text: "Switched from another provider. Night and day — status page is always honest." },
  { name: "vqx", game: "FiveM", text: "Menu updated same day as the FiveM patch. These guys don't sleep." },
  { name: "Tamsin", game: "Apex", text: "Smoothing looks completely legit on stream. Worth every cent." },
  { name: "dono", game: "Universal", text: "HWID spoofer saved my ban. One click, back on officials." },
];

function ReviewCard({ r }) {
  return (
    <div className="w-80 shrink-0 mx-3 p-5 bg-[#0F1422]/80 border border-cyan-900/40 rounded-lg backdrop-blur-sm">
      <div className="flex gap-1 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-cyan-400 text-cyan-400" />
        ))}
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">"{r.text}"</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-widest text-slate-400">{r.name}</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-500">{r.game}</span>
      </div>
    </div>
  );
}

export default function ReviewsMarquee() {
  const doubled = [...REVIEWS, ...REVIEWS];
  return (
    <section className="py-16 border-y border-cyan-500/10 bg-[#080A10] overflow-hidden" data-testid="reviews-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 flex items-end justify-between">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-400 mb-2">// Verified Buyers</div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            Word on the Street
          </h2>
        </div>
        <div className="hidden sm:block font-mono text-sm text-slate-500">4.9 / 5 — 2,300+ reviews</div>
      </div>
      <div className="marquee-hover-pause relative">
        <div className="flex w-max animate-marquee">
          {doubled.map((r, i) => (
            <ReviewCard key={`${r.name}-${i}`} r={r} />
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#06070B] to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#06070B] to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
