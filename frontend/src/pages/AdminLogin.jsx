import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("void_admin_token", data.token);
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(apiError(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="admin-login-page">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <img
          src="/images/hero-gta.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050B18]/60 to-[#050B18]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050B18] via-transparent to-[#050B18]/40" />

        <div className="relative flex items-center gap-2.5">
          <img src="/images/logo.svg" alt="Desync logo" className="w-9 h-9" />
          <span className="font-display font-extrabold tracking-tight text-xl">
            De<span className="text-[#2E6BFF]">sync</span>
          </span>
        </div>

        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-display font-extrabold tracking-tight text-4xl xl:text-5xl leading-tight text-white"
          >
            Run the whole
            <span className="block text-[#2E6BFF] text-glow-blue">operation.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-4 text-slate-400 max-w-sm"
          >
            Products, key stock, orders, waitlist and staff — one console, zero noise.
          </motion.p>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="status-dot relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          Systems nominal
        </div>
      </div>

      {/* Right form panel */}
      <div className="relative flex items-center justify-center p-6">
        <div className="absolute inset-0 grid-overlay opacity-40 lg:hidden" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-sm"
        >
          <div className="flex lg:hidden items-center gap-2.5 mb-10 justify-center">
            <img src="/images/logo.svg" alt="Desync logo" className="w-9 h-9" />
            <span className="font-display font-extrabold tracking-tight text-xl">
              De<span className="text-[#2E6BFF]">sync</span>
            </span>
          </div>

          <div className="p-8 rounded-2xl bg-[#0A1628] border border-[#1E2D4A] shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">Staff sign in</h2>
            <p className="text-sm text-slate-500 mt-1 mb-8">Use the account your owner created for you</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 block mb-2">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  data-testid="admin-login-input"
                  className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] h-11"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 block mb-2">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  data-testid="admin-password-input"
                  className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] h-11"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                data-testid="admin-login-submit"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] disabled:opacity-40 transition-all duration-200 active:scale-95"
              >
                <Lock className="w-4 h-4" /> {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>

          <Link
            to="/"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to store
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
