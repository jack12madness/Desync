import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, MessageCircle, Clock, Users, Gamepad2, Percent } from "lucide-react";

const HERO_IMG = "/images/hero-gta.png";

const stats = [
  { icon: Clock, value: "24/7", label: "Support" },
  { icon: Users, value: "Instant", label: "Delivery" },
  { icon: Gamepad2, value: "7", label: "Games" },
];

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  return (
    <section ref={ref} className="relative min-h-screen overflow-hidden" data-testid="hero-section">
      {/* base atmosphere */}
      <div className="absolute inset-0 bg-[#050B18]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 35% 0%, rgba(46,107,255,0.28), transparent 60%), linear-gradient(180deg, #10275A 0%, #0A1B38 32%, #050B18 78%)",
        }}
      />

      {/* character art bleeding off the right edge */}
      <motion.div style={{ y: imgY }} className="absolute inset-0">
        <motion.img
          src={HERO_IMG}
          alt="Desync crew"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-0 top-0 h-full w-full object-cover object-right"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 8%, rgba(0,0,0,0.55) 38%, black 62%), linear-gradient(to top, transparent 2%, black 34%)",
            maskComposite: "intersect",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 8%, rgba(0,0,0,0.55) 38%, black 62%), linear-gradient(to top, transparent 2%, black 34%)",
            WebkitMaskComposite: "source-in",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A1B38]/80 via-[#0A1B38]/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#050B18] to-transparent" />
      </motion.div>

      {/* content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="pt-44 pb-40 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="flex items-center gap-3 mb-7"
          >
            <span className="relative flex h-2 w-2">
              <span className="status-dot relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#8FB8E8]" data-testid="hero-badge">
              FiveM // Rust // Warzone // More
            </span>
          </motion.div>

          <h1 className="font-display font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
            <span className="block overflow-hidden pb-1">
              <motion.span
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.25, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="block text-white"
                data-testid="hero-line-0"
              >
                Get the Upper Hand
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 1.0, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="block h-[3px] w-4/5 bg-[#2E6BFF] origin-left mt-1 rounded-full"
                />
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-1">
              <motion.span
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.42, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="block text-[#8FB8E8]"
                data-testid="hero-line-1"
              >
                with Desync
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-5 text-base sm:text-lg text-slate-400"
          >
            Undetected cheats for popular games.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.6 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <a
              href="#shop"
              data-testid="hero-cta-explore"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-[#7FA8E8] hover:bg-[#93BAF0] text-[#0A1628] font-semibold shadow-[0_8px_30px_rgba(46,107,255,0.35)] transition-all duration-200 active:scale-95"
            >
              Search Products <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="https://discord.gg/qh3aUNKcYc"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="hero-cta-discord"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-[#0A1628]/90 hover:bg-[#0F1F38] text-slate-100 border border-[#1E2D4A] hover:border-[#2E6BFF]/50 transition-all duration-200"
            >
              <MessageCircle className="w-4 h-4 text-[#8FB8E8]" /> Join Discord
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="mt-12 flex items-center divide-x divide-[#1E2D4A]"
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={i === 0 ? "pr-8" : "px-8"}
                data-testid={`hero-stat-${s.label.toLowerCase()}`}
              >
                <div className="flex items-center gap-2">
                  <s.icon className="w-4 h-4 text-[#8FB8E8]" />
                  <span className="font-mono text-lg font-bold text-white">{s.value}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 ml-6">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* 5% off chip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="absolute bottom-6 left-4 sm:left-8 z-20 flex items-center gap-2 px-3 py-2 rounded-md bg-[#0A1628]/85 border border-[#1E2D4A] backdrop-blur-md"
        data-testid="hero-discount-chip"
      >
        <Percent className="w-3.5 h-3.5 text-[#8FB8E8]" />
        <span className="text-xs font-mono text-slate-300">5% off first order — Discord</span>
      </motion.div>
    </section>
  );
}
