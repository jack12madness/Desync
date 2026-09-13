import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Copy, KeyRound, Download } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { api, apiError, eur, BASE_URL } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

function CredentialRow({ label, value, testid }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 w-28 shrink-0">{label}</span>
      <code
        data-testid={testid}
        className="font-mono text-xs text-[#8FB8E8] bg-[#2E6BFF]/10 border border-[#2E6BFF]/30 px-2 py-1 rounded truncate flex-1"
      >
        {value}
      </code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success(`${label} copied`);
        }}
        data-testid={`copy-${testid}`}
        className="p-1.5 border border-[#2E6BFF]/30 text-[#8FB8E8] hover:bg-[#2E6BFF]/10 rounded-md transition-colors shrink-0"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const ACCOUNT_FIELDS = [
  ["steam_username", "Steam Username"],
  ["steam_password", "Steam Password"],
  ["email", "Email"],
  ["email_password", "Email Password"],
  ["password", "Email Password"],
  ["discord_password", "Discord Password"],
  ["discord_token", "Discord Token"],
  ["twofa_key", "2FA Key"],
  ["twofa_redeem", "2FA Redeem"],
  ["webmail", "Webmail"],
];

export function KeyRow({ item }) {
  const copy = (key) => {
    navigator.clipboard.writeText(key);
    toast.success("License key copied");
  };
  const deliverables = item.deliverables?.length
    ? item.deliverables
    : (item.license_key || item.account)
      ? [{ license_key: item.license_key, account: item.account }]
      : [];
  return (
    <div className="p-4 bg-[#050B18] border border-[#1E2D4A] rounded-lg">
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{item.name}</div>
        <div className="text-xs text-slate-500">
          {item.game} · {item.duration_label}{(item.qty || 1) > 1 ? ` × ${item.qty}` : ""}
        </div>
        {item.download_url && (
          <a
            href={`${BASE_URL}${item.download_url}`}
            data-testid={`download-loader-${item.product_id}-${item.duration}`}
            className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download loader{item.loader_filename ? ` — ${item.loader_filename}` : ""}
          </a>
        )}
      </div>
      {item.ticket_url ? (
        <div className="w-full sm:w-auto sm:min-w-80" data-testid={`ticket-claim-${item.product_id}-${item.duration}`}>
          <div className="p-3 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/40">
            <div className="text-xs text-slate-300 mb-2">Claimed via Discord ticket — our team sets you up right away</div>
            <a
              href={item.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`ticket-claim-link-${item.product_id}-${item.duration}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors"
            >
              Open a ticket in Discord
            </a>
          </div>
        </div>
      ) : deliverables.length > 0 ? (
        <div className="w-full sm:w-auto sm:min-w-80 space-y-2" data-testid={`deliverables-${item.product_id}-${item.duration}`}>
          {deliverables.map((d, di) => (
            <div key={di} className={deliverables.length > 1 ? "pt-2 border-t border-[#1E2D4A] first:border-0 first:pt-0" : ""}>
              {deliverables.length > 1 && (
                <div className="text-[10px] font-mono text-slate-600 mb-1">#{di + 1}</div>
              )}
              {d.account ? (
                d.account.raw ? (
                  <div className="flex items-center gap-2" data-testid={`account-raw-${item.product_id}-${item.duration}-${di}`}>
                    <code className="font-mono text-xs text-[#8FB8E8] bg-[#2E6BFF]/10 border border-[#2E6BFF]/30 px-2 py-1.5 rounded break-all flex-1">
                      {d.account.raw}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(d.account.raw);
                        toast.success("Account details copied");
                      }}
                      data-testid={`copy-raw-${item.product_id}-${item.duration}-${di}`}
                      className="p-1.5 border border-[#2E6BFF]/30 text-[#8FB8E8] hover:bg-[#2E6BFF]/10 rounded-md transition-colors shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                <div className="space-y-1.5" data-testid={`account-details-${item.product_id}-${item.duration}-${di}`}>
                  {ACCOUNT_FIELDS.filter(([f]) => d.account[f]).map(([f, label]) => (
                    <CredentialRow key={f} label={label} value={d.account[f]} testid={`account-${f.replace(/_/g, "-")}-${item.product_id}-${item.duration}-${di}`} />
                  ))}
                </div>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <code
                    data-testid={`license-key-${item.product_id}-${item.duration}-${di}`}
                    className="font-mono text-sm text-[#8FB8E8] bg-[#2E6BFF]/10 border border-[#2E6BFF]/30 px-3 py-1.5 rounded-md"
                  >
                    {d.license_key}
                  </code>
                  <button
                    onClick={() => copy(d.license_key)}
                    data-testid={`copy-key-${item.product_id}-${item.duration}-${di}`}
                    className="p-2 border border-[#2E6BFF]/30 text-[#8FB8E8] hover:bg-[#2E6BFF]/10 rounded-md transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <span
          data-testid={`key-pending-${item.product_id}-${item.duration}`}
          className="text-xs px-3 py-1.5 rounded-md bg-amber-400/10 border border-amber-400/30 text-amber-300"
        >
          Key being assigned — check back shortly
        </span>
      )}
    </div>
    {(item.instructions || (item.discord_url && !item.ticket_url)) && (
      <div className="mt-3 p-3 rounded-lg bg-[#0A1628] border border-[#1E2D4A]" data-testid={`instructions-${item.product_id}-${item.duration}`}>
        {item.instructions && (
          <>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">Setup instructions</div>
            <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{item.instructions}</div>
          </>
        )}
        {item.discord_url && !item.ticket_url && (
          <a
            href={item.discord_url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`product-discord-${item.product_id}-${item.duration}`}
            className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold transition-colors"
          >
            Join the Discord for this product
          </a>
        )}
      </div>
    )}
    </div>
  );
}

const tokenKey = (em) => `desync_lookup_${em}`;

export default function OrderLookup() {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState("email"); // email | code | done
  const [code, setCode] = useState("");
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);

  const lookupWithToken = async (em, token) => {
    setLoading(true);
    try {
      const { data } = await api.post("/orders/lookup", { email: em, token });
      setOrders(data);
      setStage("done");
    } catch (e) {
      if (e?.response?.status === 401) {
        sessionStorage.removeItem(tokenKey(em));
        setStage("code");
        toast.error("Verification expired — enter the latest code from your inbox");
      } else {
        toast.error(apiError(e));
      }
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = async () => {
    const em = email.trim().toLowerCase();
    if (!em) return;
    const saved = sessionStorage.getItem(tokenKey(em));
    if (saved) {
      await lookupWithToken(em, saved);
      return;
    }
    await requestCode(em);
  };

  const requestCode = async (em) => {
    setLoading(true);
    try {
      await api.post("/orders/lookup/request-code", { email: em });
      setStage("code");
      setCode("");
      toast.success("Code sent — check your inbox");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    const em = email.trim().toLowerCase();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/orders/lookup/verify", { email: em, code: code.trim() });
      sessionStorage.setItem(tokenKey(em), data.token);
      await lookupWithToken(em, data.token);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStage("email");
    setOrders(null);
    setCode("");
  };

  return (
    <div data-testid="order-lookup-page">
      <Navbar />
      <main className="pt-28 pb-24 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="text-sm font-medium text-[#5B8CFF] mb-2">My Orders</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              Find your keys
            </h1>
            <p className="text-sm text-slate-400 mb-8">
              {stage === "done"
                ? "Verified. Every paid order and its license keys are below."
                : "Enter the email you used at checkout — we'll send a one-time code to prove it's yours."}
            </p>
          </motion.div>

          {stage === "email" && (
            <div className="flex gap-3">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitEmail()}
                placeholder="you@example.com"
                data-testid="lookup-email-input"
                className="bg-[#0A1628] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] text-sm h-12"
              />
              <button
                onClick={submitEmail}
                disabled={loading}
                data-testid="lookup-submit-button"
                className="shrink-0 inline-flex items-center gap-2 px-6 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] disabled:opacity-40 transition-all duration-200 active:scale-95"
              >
                <Search className="w-4 h-4" /> {loading ? "..." : "Send code"}
              </button>
            </div>
          )}

          {stage === "code" && (
            <div data-testid="otp-code-step">
              <div className="text-xs text-slate-400 mb-3">
                We emailed a 6-digit code to <span className="text-slate-200">{email.trim().toLowerCase()}</span>. It expires in 10 minutes.
              </div>
              <div className="flex gap-3">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoFocus
                  data-testid="otp-code-input"
                  className="bg-[#0A1628] border-[#1E2D4A] focus-visible:ring-[#2E6BFF] text-sm h-12 font-mono tracking-[0.4em]"
                />
                <button
                  onClick={verify}
                  disabled={loading || code.length !== 6}
                  data-testid="otp-verify-button"
                  className="shrink-0 inline-flex items-center gap-2 px-6 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] disabled:opacity-40 transition-all duration-200 active:scale-95"
                >
                  <KeyRound className="w-4 h-4" /> {loading ? "..." : "Verify"}
                </button>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <button
                  onClick={() => requestCode(email.trim().toLowerCase())}
                  disabled={loading}
                  data-testid="otp-resend-button"
                  className="text-xs text-[#8FB8E8] hover:text-white transition-colors disabled:opacity-40"
                >
                  Resend code
                </button>
                <button
                  onClick={reset}
                  data-testid="lookup-change-email"
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}

          {stage === "done" && orders !== null && (
            <div className="mt-10 space-y-8" data-testid="lookup-results">
              <div className="flex justify-end">
                <button
                  onClick={reset}
                  data-testid="lookup-new-search"
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Look up a different email
                </button>
              </div>
              {orders.length === 0 && (
                <div className="text-center py-16" data-testid="lookup-empty">
                  <div className="text-sm text-slate-400">No purchases made with this email yet</div>
                  <div className="text-xs text-slate-600 mt-2">If you just paid, give it a minute — your order appears here as soon as payment confirms.</div>
                </div>
              )}
              {orders.map((o) => (
                <div key={o.id} className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl" data-testid={`order-${o.id}`}>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <KeyRound className="w-4 h-4 text-[#5B8CFF]" />
                      Order {o.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="text-sm text-slate-500">
                      {new Date(o.created_at).toLocaleDateString()} · <span className="text-white font-mono font-semibold">{eur(o.total)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {o.items.map((item) => (
                      <KeyRow key={`${item.product_id}-${item.duration}`} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
