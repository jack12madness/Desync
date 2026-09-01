import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Terminal, Lock } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center relative" data-testid="admin-login-page">
      <div className="absolute inset-0 grid-overlay opacity-60" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm mx-4 p-8 glass-panel rounded-lg"
      >
        <div className="flex items-center gap-2.5 mb-2">
          <span className="w-2.5 h-2.5 bg-[#2E6BFF] rounded-[2px] shadow-[0_0_14px_rgba(46,107,255,0.8)]" />
          <span className="font-display font-extrabold tracking-tight">Void<span className="text-[#2E6BFF]">ware</span> Staff</span>
        </div>
        <p className="text-sm text-slate-500 mb-8">Sign in to manage the store</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 block mb-2">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              data-testid="admin-login-input"
              className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF]"
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
              className="bg-[#050B18] border-[#1E2D4A] focus-visible:ring-[#2E6BFF]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            data-testid="admin-login-submit"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] disabled:opacity-40 transition-all duration-200"
          >
            <Lock className="w-4 h-4" /> {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <Link to="/" className="block mt-6 text-center text-xs font-mono uppercase tracking-widest text-slate-600 hover:text-blue-300 transition-colors">
          ← Back to store
        </Link>
      </motion.div>
    </div>
  );
}
