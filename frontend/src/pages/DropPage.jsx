import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Bell, Flame } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const DEFAULT_DROP_DATE = new Date("2026-09-22T17:00:00Z");
const DEFAULT_TEASER =
  "Our next release is locked and in final testing. Join the drop list and be first through the door — early list gets first-key priority.";
const TEASER_IMG = "/images/product-fivem-menu.png";

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const pad = (n) => String(n).padStart(2, "0");

export default function DropPage() {
  const [dropDate, setDropDate] = useState(DEFAULT_DROP_DATE);
  const [teaser, setTeaser] = useState(DEFAULT_TEASER);
  const { days, hours, minutes, seconds } = useCountdown(dropDate);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/drop-config").then(({ data }) => {
      if (data.drop_date) setDropDate(new Date(data.drop_date));
      if (data.drop_teaser) setTeaser(data.drop_teaser);
    }).catch(() => {});
    api.get("/waitlist/count").then(({ data }) => setCount(data.count)).catch(() => {});
  }, []);

  const join = async () => {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/waitlist", { email });
      setJoined(true);
      setCount(data.count);
      toast.success("You're on the drop list");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const units = [
    { v: pad(days), label: "Days", testid: "countdown-days" },
    { v: pad(hours), label: "Hours", testid: "countdown-hours" },
    { v: pad(minutes), label: "Minutes", testid: "countdown-minutes" },
    { v: pad(seconds), label: "Seconds", testid: "countdown-seconds" },
  ];

  return (
    <div data-testid="drop-page">
      <Navbar />
      <main className="relative min-h-screen flex items-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <img src={TEASER_IMG} alt="" className="w-full h-full object-cover blur-md scale-110 opacity-30 saturate-[0.6]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050B18]/80 via-[#050B18]/60 to-[#050B18]" />
          <div className="absolute inset-0 grid-overlay opacity-60" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-[#2E6BFF]/15 blur-[140px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center py-20 w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2E6BFF]/40 bg-[#2E6BFF]/10 mb-8">
              <Flame className="w-3.5 h-3.5 text-[#5B8CFF]" />
              <span className="text-xs font-medium text-[#8FB8E8]" data-testid="drop-badge">
                Next Drop
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-display font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.02]"
          >
            Something big
            <span className="block text-[#2E6BFF] text-glow-blue">is loading.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-5 text-base sm:text-lg text-slate-400 max-w-xl mx-auto"
            data-testid="drop-teaser-text"
          >
            {teaser}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="mt-12 grid grid-cols-4 gap-3 sm:gap-4 max-w-xl mx-auto"
            data-testid="countdown-timer"
          >
            {units.map((u) => (
              <div
                key={u.label}
                data-testid={u.testid}
                className="glass-panel rounded-xl py-5 sm:py-7"
              >
                <div className="font-mono text-3xl sm:text-5xl font-bold text-slate-100 tabular-nums text-glow-blue">
                  {u.v}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mt-2">{u.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.7 }}
            className="mt-12 max-w-md mx-auto"
          >
            {joined ? (
              <div className="glass-panel rounded-xl p-6" data-testid="drop-success">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <div className="font-display font-bold text-lg">You're in. Watch your inbox.</div>
                <p className="text-sm text-slate-400 mt-2">
                  Confirmation sent — we'll email you the moment the drop goes live.
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && join()}
                  placeholder="you@example.com"
                  data-testid="hype-drop-email-input"
                  className="bg-[#0A1628] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] font-mono text-sm h-12"
                />
                <button
                  onClick={join}
                  disabled={loading}
                  data-testid="hype-drop-join-button"
                  className="shrink-0 inline-flex items-center gap-2 px-6 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_0_24px_rgba(46,107,255,0.4)] disabled:opacity-40 transition-all duration-200 active:scale-95"
                >
                  <Bell className="w-4 h-4" /> {loading ? "..." : "Notify Me"}
                </button>
              </div>
            )}
            {count !== null && (
              <div className="mt-4 text-xs font-mono uppercase tracking-[0.2em] text-slate-500" data-testid="drop-count">
                <span className="text-[#7FB0FF]">{count}</span> operator{count === 1 ? "" : "s"} already waiting
              </div>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
