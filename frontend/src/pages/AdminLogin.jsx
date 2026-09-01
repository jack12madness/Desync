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
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="w-5 h-5 text-blue-400" />
          <span className="font-display font-extrabold uppercase tracking-tight">Void<span className="text-blue-400">ware</span> Staff</span>
        </div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-8">Restricted access // authorized only</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 block mb-2">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              data-testid="admin-login-input"
              className="bg-[#050B18] border-slate-700 focus-visible:ring-blue-400 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 block mb-2">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              data-testid="admin-password-input"
              className="bg-[#050B18] border-slate-700 focus-visible:ring-blue-400 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            data-testid="admin-login-submit"
            className="clip-tag w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-400 text-[#050B18] font-mono text-sm font-bold uppercase tracking-widest hover:bg-blue-300 disabled:opacity-40 transition-all"
          >
            <Lock className="w-4 h-4" /> {loading ? "Verifying..." : "Enter Console"}
          </button>
        </form>

        <Link to="/" className="block mt-6 text-center text-xs font-mono uppercase tracking-widest text-slate-600 hover:text-blue-300 transition-colors">
          ← Back to store
        </Link>
      </motion.div>
    </div>
  );
}
