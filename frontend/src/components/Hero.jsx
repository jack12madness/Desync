import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, PackageSearch } from "lucide-react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1636922861058-ac8d49cb5147?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwxfHxnYW1pbmclMjBjaGFyYWN0ZXIlMjByZW5kZXIlMjBjeWJlcnB1bmslMjBhY3Rpb24lMjBzaG9vdGVyJTIwY2hhcmFjdGVyfGVufDB8fHx8MTc4ODI2MjEwMnww&ixlib=rb-4.1.0&q=85";

const stats = [
  { value: "3+", label: "Years Active" },
  { value: "12,400+", label: "Keys Delivered" },
  { value: "7", label: "Live Products" },
];

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const charY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden pt-16" data-testid="hero-section">
      <div className="absolute inset-0 grid-overlay opacity-70" />
      <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-[#2E6BFF]/15 blur-[140px]" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050B18] to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full grid lg:grid-cols-2 gap-12 items-center py-16">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="flex items-center gap-3 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="status-dot relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#5B8CFF]" data-testid="hero-badge">
              FiveM // Rust // Warzone // More
            </span>
          </motion.div>

          <h1 className="font-display font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.02]">
            <span className="block overflow-hidden pb-1">
              <motion.span
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.25, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="block text-slate-100"
                data-testid="hero-line-0"
              >
                Get the Upper Hand
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-2">
              <motion.span
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.42, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="block"
                data-testid="hero-line-1"
              >
                <span className="relative inline-block">
                  <span className="relative z-10">with <span className="text-[#2E6BFF] text-glow-blue">VOIDWARE</span></span>
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1.0, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute left-0 bottom-1 h-[3px] w-full bg-[#2E6BFF] origin-left"
                  />
                </span>
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-6 max-w-lg text-base sm:text-lg text-slate-400 leading-relaxed"
          >
            Undetected software for popular games. Instant key delivery to your inbox,
            live status on every product, support that actually answers.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.6 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <a
              href="#shop"
              data-testid="hero-cta-explore"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white font-semibold shadow-[0_0_28px_rgba(46,107,255,0.4)] transition-all duration-200 active:scale-95"
            >
              Explore Cheats <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              to="/orders"
              data-testid="hero-cta-orders"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-[#0A1628] hover:bg-[#0F1F38] text-slate-200 border border-[#1E2D4A] hover:border-[#2E6BFF]/50 transition-all duration-200"
            >
              <PackageSearch className="w-4 h-4 text-[#5B8CFF]" /> Order Lookup
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="mt-14 flex items-center gap-8 sm:gap-10"
          >
            {stats.map((s) => (
              <div key={s.label} data-testid={`hero-stat-${s.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
                <div className="font-mono text-xl sm:text-2xl font-bold text-[#5B8CFF]">{s.value}</div>
                <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          style={{ y: charY }}
          className="relative hidden lg:flex items-center justify-center"
          data-testid="hero-character"
        >
          <div className="absolute w-[420px] h-[420px] rounded-full bg-[#2E6BFF]/25 blur-[110px]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <motion.img
              src={HERO_IMG}
              alt="VOIDWARE operative"
              animate={{ y: [0, -12, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="relative z-10 w-full max-w-md aspect-[3/4] object-cover rounded-2xl border border-[#1E2D4A] shadow-[0_30px_80px_rgba(46,107,255,0.25)]"
            />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-[#050B18]/70 via-transparent to-transparent z-20" />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              className="absolute -left-6 bottom-10 z-30 glass-panel rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="status-dot relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">All Systems Undetected</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1">Last sweep: 5 min ago</div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
