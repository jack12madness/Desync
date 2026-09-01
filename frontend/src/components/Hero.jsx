import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1622023346627-b7d48c4484a9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHxjeWJlcnB1bmslMjBnYW1lJTIwY2hhcmFjdGVyJTIwZGFyayUyMGdsb3dpbmclMjBibHVlJTIwY3lhbnxlbnwwfHx8fDE3ODgyNjA1MTR8MA&ixlib=rb-4.1.0&q=85";

const lines = [
  { text: "UNDETECTED.", accent: false },
  { text: "UNMATCHED.", accent: true },
];

const stats = [
  { value: "99.8%", label: "Uptime" },
  { value: "12,400+", label: "Keys Delivered" },
  { value: "24/7", label: "Support" },
];

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.1]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden" data-testid="hero-section">
      <motion.div style={{ y, opacity }} className="absolute inset-0">
        <img
          src={HERO_IMG}
          alt=""
          className="w-full h-full object-cover object-center opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06070B] via-[#06070B]/70 to-[#06070B]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06070B] via-transparent to-[#06070B]/60" />
        <div className="absolute inset-0 grid-overlay" />
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex items-center gap-3 mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="status-dot relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-400" data-testid="hero-badge">
            FiveM // Rust // Warzone // More
          </span>
        </motion.div>

        <h1 className="font-display font-black uppercase tracking-tight text-5xl sm:text-7xl lg:text-8xl leading-[0.95]">
          {lines.map((line, i) => (
            <span key={line.text} className="block overflow-hidden pb-1">
              <motion.span
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.25 + i * 0.18, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className={`block ${line.accent ? "text-cyan-400 text-glow-cyan" : "text-slate-100"}`}
                data-testid={`hero-line-${i}`}
              >
                {line.text}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.6 }}
          className="mt-6 max-w-xl text-base sm:text-lg text-slate-400 leading-relaxed"
        >
          Premium software for FiveM and every major title. Instant key delivery,
          live status tracking, and a support crew that actually answers.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <a
            href="#shop"
            data-testid="hero-cta-shop"
            className="clip-tag inline-flex items-center gap-2 px-8 py-4 bg-cyan-400 text-[#06070B] font-mono text-sm font-bold uppercase tracking-[0.15em] hover:bg-cyan-300 hover:shadow-[0_0_40px_rgba(0,240,255,0.4)] transition-all duration-300"
          >
            Browse the Armoury <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="https://discord.gg/voidware"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="hero-cta-discord"
            className="clip-tag inline-flex items-center gap-2 px-8 py-4 border border-cyan-400/40 text-cyan-300 font-mono text-sm uppercase tracking-[0.15em] hover:bg-cyan-400/10 transition-all duration-300"
          >
            <ShieldCheck className="w-4 h-4" /> Join Discord
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.8 }}
          className="mt-16 flex items-center gap-8 sm:gap-12"
        >
          {stats.map((s) => (
            <div key={s.label} data-testid={`hero-stat-${s.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
              <div className="font-mono text-xl sm:text-2xl font-bold text-cyan-300">{s.value}</div>
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-600">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="w-px h-10 bg-gradient-to-b from-cyan-400 to-transparent"
        />
      </motion.div>
    </section>
  );
}
