import { motion } from "framer-motion";

const D_PATH =
  "M18 12 H33 C43 12 50 20 50 32 C50 44 43 52 33 52 H18 Z M25 19 V45 H32.5 C39.5 45 43.5 39.5 43.5 32 C43.5 24.5 39.5 19 32.5 19 Z";

export default function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-[#050B18] flex flex-col items-center justify-center"
      data-testid="splash-screen"
      exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(46,107,255,0.18), transparent 70%)",
        }}
      />
      <div className="absolute inset-0 grid-overlay opacity-40" />

      <div className="relative">
        <svg viewBox="0 0 64 64" className="w-24 h-24" data-testid="splash-logo">
          <defs>
            <linearGradient id="splashGrad" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0" stopColor="#8FB8F0" />
              <stop offset="1" stopColor="#2E6BFF" />
            </linearGradient>
            <clipPath id="splashTop"><rect x="0" y="0" width="64" height="30" /></clipPath>
            <clipPath id="splashBot"><rect x="0" y="34" width="64" height="30" /></clipPath>
          </defs>
          <motion.g
            clipPath="url(#splashTop)"
            initial={{ x: 14, opacity: 0 }}
            animate={{ x: [14, 0, 3.5, 5.5, 3.5], opacity: 1 }}
            transition={{
              duration: 1.6,
              times: [0, 0.35, 0.5, 0.75, 1],
              ease: "easeOut",
            }}
          >
            <path d={D_PATH} fill="url(#splashGrad)" />
          </motion.g>
          <motion.g
            clipPath="url(#splashBot)"
            initial={{ x: -14, opacity: 0 }}
            animate={{ x: [-14, 0, -3.5, -5.5, -3.5], opacity: 1 }}
            transition={{
              duration: 1.6,
              times: [0, 0.35, 0.5, 0.75, 1],
              ease: "easeOut",
            }}
          >
            <path d={D_PATH} fill="url(#splashGrad)" />
          </motion.g>
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-5 font-display font-extrabold tracking-tight text-3xl"
      >
        <span className="text-white">De</span>
        <span className="text-[#2E6BFF] text-glow-blue">sync</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="relative mt-6 w-44 h-[3px] rounded-full bg-[#1E2D4A] overflow-hidden"
        data-testid="splash-progress"
      >
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.5, duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-[#8FB8F0] to-[#2E6BFF] shadow-[0_0_16px_rgba(46,107,255,0.8)]"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="relative mt-4 text-[11px] tracking-[0.35em] text-slate-500 uppercase"
      >
        Undetected. Unmatched.
      </motion.div>
    </motion.div>
  );
}
