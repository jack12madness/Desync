import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MonitorDown, KeyRound, Zap, History } from "lucide-react";
import { api } from "@/lib/api";

// "Get the Windows app" — only renders once staff set the download URL
// (Admin → Alerts tab) after the first GitHub build.
export default function DesktopAppSection() {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    api.get("/config").then(({ data }) => setUrl(data.desktop_download_url || null)).catch(() => {});
  }, []);

  if (!url) return null;

  const perks = [
    { icon: KeyRound, text: "Log in once with your DSYNC key — it's remembered" },
    { icon: Zap, text: "Generate Steam, Discord & Rockstar accounts instantly" },
    { icon: History, text: "Your generated accounts stay saved on your PC" },
  ];

  return (
    <section className="py-16 sm:py-20 border-t border-[#1E2D4A]/60" data-testid="desktop-app-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-[#2E6BFF]/30 bg-gradient-to-br from-[#0A1628] to-[#050B18] p-8 sm:p-12"
        >
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#2E6BFF]/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#8FB8E8] mb-3">Windows app</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Get the Desync desktop app
              </h2>
              <p className="mt-3 text-sm text-slate-400 max-w-xl leading-relaxed">
                Generator customers: skip the website. The app sits on your desktop, remembers your key,
                and keeps every account you generate safe in its own history.
              </p>
              <ul className="mt-5 space-y-2.5">
                {perks.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                    <Icon className="w-4 h-4 text-[#5B8CFF] shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="shrink-0">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="desktop-download-button"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-[#2E6BFF] hover:bg-[#4a80ff] text-white font-semibold text-sm transition-all duration-200 shadow-[0_0_40px_rgba(46,107,255,0.35)] hover:shadow-[0_0_50px_rgba(46,107,255,0.5)]"
              >
                <MonitorDown className="w-5 h-5" />
                Download for Windows
              </a>
              <div className="mt-3 text-center text-[11px] text-slate-500">
                Free for Generator owners · one-time SmartScreen prompt
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
