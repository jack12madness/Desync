import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, KeyRound, Copy, Check, Download, MessageSquare, Eye, EyeOff, Star, Zap } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, apiError, aud, BASE_URL } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

function CopyButton({ text, small }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      data-testid="copy-button"
      className={`shrink-0 ${small ? "p-1" : "p-1.5"} rounded border border-[#1E2D4A] text-slate-400 hover:text-white hover:border-[#2E6BFF]/50 transition-colors`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function FieldRow({ label, value, testid }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</span>
      <span className="flex items-center gap-2 min-w-0">
        <code className="font-mono text-xs text-[#8FB8E8] truncate max-w-[220px]" data-testid={testid}>{value}</code>
        <CopyButton text={value} small />
      </span>
    </div>
  );
}

export function KeyRow({ item }) {
  const deliverables = item.deliverables && item.deliverables.length
    ? item.deliverables
    : item.license_key
      ? [{ license_key: item.license_key, account: item.account }]
      : [];
  return (
    <div className="p-4 bg-[#050B18] border border-[#1E2D4A] rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-100">{item.name}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-0.5">
            {item.game} · {item.duration_label}{(item.qty || 1) > 1 ? ` · ×${item.qty}` : ""}
          </div>
        </div>
        {item.ticket_url ? (
          <a
            href={item.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`ticket-claim-${item.product_id}-${item.duration}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Open a Discord ticket to claim
          </a>
        ) : deliverables.length > 0 ? (
          <div className="space-y-2 min-w-0">
            {deliverables.map((d, i) => (
              <div key={i} data-testid={`license-row-${item.product_id}-${item.duration}-${i}`}>
                {d.account ? (
                  <div className="w-full sm:w-[340px] rounded-md bg-[#0A1628] border border-[#1E2D4A] px-3 py-2" data-testid={`account-row-${item.product_id}-${item.duration}-${i}`}>
                    {d.account.raw ? (
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs text-[#8FB8E8] whitespace-pre-wrap break-all flex-1" data-testid={`raw-account-${i}`}>{d.account.raw}</code>
                        <CopyButton text={d.account.raw} small />
                      </div>
                    ) : (
                      <>
                        <FieldRow label="Email" value={d.account.email} />
                        {d.account.discord_token ? (
                          <>
                            <FieldRow label="Email password" value={d.account.email_password} />
                            <FieldRow label="Discord password" value={d.account.discord_password} />
                            <FieldRow label="Discord token" value={d.account.discord_token} testid={`discord-token-${i}`} />
                          </>
                        ) : d.account.steam_username || d.account.webmail ? (
                          <>
                            {d.account.steam_username && <FieldRow label="Steam username" value={d.account.steam_username} />}
                            {d.account.steam_password && <FieldRow label="Steam password" value={d.account.steam_password} />}
                            <FieldRow label="Email password" value={d.account.password} />
                            {d.account.webmail && <FieldRow label="Webmail" value={d.account.webmail} testid={`webmail-${i}`} />}
                          </>
                        ) : d.account.twofa_key || d.account.twofa_redeem ? (
                          <>
                            <FieldRow label="Password" value={d.account.password} />
                            {d.account.twofa_key && <FieldRow label="2FA key" value={d.account.twofa_key} testid={`twofa-key-${i}`} />}
                            {d.account.twofa_redeem && <FieldRow label="2FA redeem" value={d.account.twofa_redeem} testid={`twofa-redeem-${i}`} />}
                          </>
                        ) : (
                          <FieldRow label="Password" value={d.account.password} testid={`account-password-${i}`} />
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm text-[#8FB8E8] bg-[#0A1628] border border-[#1E2D4A] px-3 py-2 rounded-md tracking-wider">
                      {d.license_key}
                    </code>
                    <CopyButton text={d.license_key} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span data-testid={`key-pending-${item.product_id}-${item.duration}`} className="text-xs font-mono text-amber-400 animate-pulse">
            Key being assigned — check back shortly
          </span>
        )}
      </div>
      {item.download_url && (
        <a
          href={`${BASE_URL}${item.download_url}`}
          data-testid={`download-loader-${item.product_id}`}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-xs font-semibold transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download Loader ({item.loader_filename})
        </a>
      )}
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

function Countdown({ iso }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!iso) return;
    const tick = () => {
      const ms = new Date(iso) - Date.now();
      if (ms <= 0) {
        setLeft("now");
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  return <span className="font-mono text-emerald-300" data-testid="gen-reset-countdown">{left}</span>;
}

const GEN_LABELS = { steam: "Steam", discord: "Discord", rockstar: "Rockstar" };

export default function CustomerPortal() {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState("email"); // email | code | done
  const [code, setCode] = useState("");
  const [token, setToken] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [reviewFor, setReviewFor] = useState(null); // order
  const [review, setReview] = useState({ rating: 5, text: "", name: "", product_id: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [genBusy, setGenBusy] = useState(null); // type currently generating
  const [genResult, setGenResult] = useState(null); // {type, raw}

  const redeemKey = async () => {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      await api.post("/portal/gen/redeem", { code: redeemCode.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Generator activated — lifetime access, 3 of each type per hour");
      setRedeemCode("");
      await loadPortal(token);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRedeeming(false);
    }
  };

  const generateNow = async (type) => {
    setGenBusy(type);
    setGenResult(null);
    try {
      const { data: r } = await api.post("/portal/gen/generate", { type }, { headers: { Authorization: `Bearer ${token}` } });
      setGenResult({ type, raw: r.raw });
      toast.success(`${type[0].toUpperCase() + type.slice(1)} account generated`);
      await loadPortal(token);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setGenBusy(null);
    }
  };

  const loadPortal = async (tok) => {
    const { data: d } = await api.get("/portal/me", { headers: { Authorization: `Bearer ${tok}` } });
    setData(d);
  };

  const lookupWithToken = async (em, tok, { saved = false, retried = false } = {}) => {
    setLoading(true);
    try {
      await loadPortal(tok);
      setToken(tok);
      setStage("done");
    } catch (e) {
      if (e?.response?.status === 401) {
        sessionStorage.removeItem(`desync_lookup_${em}`);
        if (saved) {
          // stale saved session — automatically send a fresh code instead of dead-ending
          await requestCode(em);
        } else if (!retried) {
          // fresh token rejected (e.g. server mid-restart) — retry once before giving up
          await new Promise((r) => setTimeout(r, 1500));
          await lookupWithToken(em, tok, { retried: true });
        } else {
          setStage("code");
          setCode("");
          toast.error("Your code was accepted but the session couldn't start — please enter it again");
        }
      } else {
        toast.error(apiError(e));
      }
    } finally {
      setLoading(false);
    }
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

  const submitEmail = async () => {
    const em = email.trim().toLowerCase();
    if (!em) return;
    const saved = sessionStorage.getItem(`desync_lookup_${em}`);
    if (saved) {
      await lookupWithToken(em, saved, { saved: true });
      return;
    }
    await requestCode(em);
  };

  const verify = async () => {
    const em = email.trim().toLowerCase();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data: v } = await api.post("/orders/lookup/verify", { email: em, code: code.trim() });
      sessionStorage.setItem(`desync_lookup_${em}`, v.token);
      await lookupWithToken(em, v.token);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async () => {
    setSubmittingReview(true);
    try {
      await api.post("/portal/reviews", {
        order_id: reviewFor.id, rating: review.rating, text: review.text,
        product_id: review.product_id || null, name: review.name || null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Review submitted — it appears once our team approves it");
      setReviewFor(null);
      setReview({ rating: 5, text: "", name: "", product_id: "" });
      await loadPortal(token);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmittingReview(false);
    }
  };

  const gen = data?.generator;
  const totalSpent = (data?.orders || []).reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div data-testid="order-lookup-page">
      <Navbar />
      <main className="pt-28 pb-24 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="text-sm font-medium text-[#5B8CFF] mb-2">Customer Portal</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              Your account
            </h1>
            <p className="text-sm text-slate-400 mb-8">
              {stage === "done"
                ? "Verified. Your orders, licenses and Generator access are below."
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
                We emailed a 6-digit code to <span className="text-slate-200">{email.trim().toLowerCase()}</span>. It expires in 15 minutes.
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
                <button onClick={() => requestCode(email.trim().toLowerCase())} disabled={loading} data-testid="otp-resend-button" className="text-xs text-[#8FB8E8] hover:text-white transition-colors disabled:opacity-40">
                  Resend code
                </button>
                <button onClick={() => { setStage("email"); setCode(""); }} data-testid="lookup-change-email" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  Use a different email
                </button>
              </div>
            </div>
          )}

          {stage === "done" && data && (
            <div className="mt-6" data-testid="portal-dashboard">
              <Tabs defaultValue="overview">
                <TabsList className="flex flex-wrap h-auto gap-1 bg-[#0A1628] border border-[#1E2D4A] rounded-lg p-1 mb-6">
                  {["overview", "orders", "products", "generator", "account"].map((t) => (
                    <TabsTrigger
                      key={t}
                      value={t}
                      data-testid={`portal-tab-${t}`}
                      className="rounded px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-slate-400 data-[state=active]:bg-[#2E6BFF] data-[state=active]:text-white transition-colors"
                    >
                      {t}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" data-testid="portal-overview">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Email</div>
                      <div className="text-sm text-white font-medium break-all" data-testid="portal-email">{data.email}</div>
                      <div className="text-xs text-slate-500 mt-2">
                        Customer since {data.customer_since ? new Date(data.customer_since).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <div className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Orders</div>
                      <div className="text-2xl font-display font-bold text-white" data-testid="portal-order-count">{data.orders.length}</div>
                      <div className="text-xs text-slate-500 mt-1">{aud(totalSpent)} lifetime</div>
                    </div>
                    <div className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Generator</div>
                      <div className={`text-sm font-semibold ${gen.access || gen.entitled ? "text-emerald-300" : "text-slate-500"}`} data-testid="portal-gen-status">
                        {gen.access && gen.tier3 ? "Active — full access" : gen.access ? "Active — lifetime key" : gen.entitled ? "Standard allowance" : "Not active"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {gen.entitled ? `${gen.limits.steam} of each type / hour` : "Unlocks with a Generator key or any order over A$10"}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="orders" data-testid="portal-orders">
                  {data.orders.length === 0 && (
                    <div className="text-center py-16" data-testid="lookup-empty">
                      <div className="text-sm text-slate-400">No purchases made with this email yet</div>
                    </div>
                  )}
                  <div className="space-y-6">
                    {data.orders.map((o) => (
                      <div key={o.id} className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl" data-testid={`order-${o.id}`}>
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <KeyRound className="w-4 h-4 text-[#5B8CFF]" />
                            Order {o.id.slice(0, 8).toUpperCase()}
                          </div>
                          <div className="text-sm text-slate-500">
                            {new Date(o.created_at).toLocaleDateString()} · <span className="text-white font-mono font-semibold">{aud(o.total)}</span>
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
                </TabsContent>

                <TabsContent value="products" data-testid="portal-products">
                  <div className="space-y-3">
                    {data.orders.flatMap((o) => o.items).filter((i) => i.download_url || i.instructions).length === 0 && (
                      <div className="text-sm text-slate-500 py-10 text-center" data-testid="portal-products-empty">
                        No downloadable products yet — loaders and setup instructions appear here
                      </div>
                    )}
                    {data.orders.flatMap((o) => o.items).filter((i) => i.download_url || i.instructions).map((item, idx) => (
                      <div key={idx} className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl" data-testid={`portal-product-${idx}`}>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{item.name}</div>
                            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{item.duration_label}</div>
                          </div>
                          {item.download_url && (
                            <a href={`${BASE_URL}${item.download_url}`} data-testid={`portal-download-${idx}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-xs font-semibold transition-colors">
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          )}
                        </div>
                        {item.instructions && (
                          <div className="mt-3 text-xs text-slate-300 whitespace-pre-line leading-relaxed border-t border-[#1E2D4A] pt-3">{item.instructions}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="generator" data-testid="portal-generator">
                  {!gen.access && (
                    <div className="p-5 bg-[#0A1628] border border-violet-400/30 rounded-xl mb-4" data-testid="gen-redeem-card">
                      <div className="text-sm font-semibold text-white mb-1">Have a Generator key?</div>
                      <div className="text-xs text-slate-500 mb-3">Redeem a DSYNC key for lifetime Generator access — 3 of each type per hour.</div>
                      <div className="flex gap-2">
                        <Input
                          value={redeemCode}
                          onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === "Enter" && redeemKey()}
                          placeholder="DSYNC-XXXX-XXXX-XXXX"
                          data-testid="gen-redeem-input"
                          className="bg-[#050B18] border-[#1E2D4A] font-mono text-sm h-11"
                        />
                        <button
                          onClick={redeemKey}
                          disabled={redeeming || !redeemCode.trim()}
                          data-testid="gen-redeem-button"
                          className="shrink-0 inline-flex items-center gap-2 px-5 rounded-lg bg-violet-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-violet-300 disabled:opacity-40 transition-all"
                        >
                          {redeeming ? "..." : "Redeem"}
                        </button>
                      </div>
                    </div>
                  )}
                  {!gen.entitled ? (
                    <div className="p-6 bg-[#0A1628] border border-[#1E2D4A] rounded-xl text-center" data-testid="gen-locked">
                      <Zap className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                      <div className="text-sm text-slate-300 font-semibold mb-1">Generator not active</div>
                      <div className="text-xs text-slate-500 max-w-md mx-auto">
                        Get the FiveM Account Generator or redeem a key above for full lifetime access (3 of each type per hour), or place any order over A$10 for the standard allowance (1 of each per hour).
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">Your Generator key</div>
                        {gen.key ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="font-mono text-sm text-[#8FB8E8] bg-[#050B18] border border-[#1E2D4A] px-3 py-2 rounded-md tracking-wider" data-testid="gen-key-display">
                              {showKey ? gen.key : "DSYNC-••••-••••-••••"}
                            </code>
                            <button onClick={() => setShowKey(!showKey)} data-testid="gen-key-reveal" className="p-2 rounded-md border border-[#1E2D4A] text-slate-400 hover:text-white transition-colors">
                              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <CopyButton text={gen.key} />
                            {!gen.key_active && <span className="text-xs text-rose-400 font-mono">REVOKED</span>}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">Key is issued automatically — refresh in a moment</div>
                        )}
                        <div className="text-[11px] text-slate-500 mt-2">Paste this into the Generator app, or generate right here — never share it</div>
                      </div>
                      {genResult && (
                        <div className="p-5 bg-[#050B18] border border-emerald-400/40 rounded-xl" data-testid="gen-result">
                          <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 mb-2">
                            Fresh {genResult.type} account — just generated for you
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-xs text-[#8FB8E8] whitespace-pre-wrap break-all flex-1" data-testid="gen-result-raw">{genResult.raw}</code>
                            <CopyButton text={genResult.raw} />
                          </div>
                        </div>
                      )}
                      <div className="grid sm:grid-cols-3 gap-4">
                        {Object.entries(GEN_LABELS).map(([t, label]) => {
                          const limit = gen.limits[t] || 0;
                          const used = gen.used[t] || 0;
                          const left = Math.max(0, limit - used);
                          return (
                            <div key={t} className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl" data-testid={`gen-allowance-${t}`}>
                              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</div>
                              <div className="text-2xl font-display font-bold text-white mt-1">
                                {left} <span className="text-sm text-slate-500 font-normal">/ {limit} remaining</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                {used > 0 && gen.resets[t] ? <>Next refill in <Countdown iso={gen.resets[t]} /></> : "Rolling hourly allowance"}
                              </div>
                              <button
                                onClick={() => generateNow(t)}
                                disabled={genBusy !== null || left === 0}
                                data-testid={`gen-generate-${t}`}
                                className="mt-3 w-full px-3 py-2 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-xs font-semibold disabled:opacity-40 transition-all duration-200 active:scale-95"
                              >
                                {genBusy === t ? "Generating..." : "Generate now"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Recent generations</div>
                        {data.gen_history.length === 0 ? (
                          <div className="text-xs text-slate-500" data-testid="gen-history-empty">Nothing generated yet</div>
                        ) : (
                          <div className="space-y-1.5" data-testid="gen-history">
                            {data.gen_history.map((h, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full ${h.success ? "bg-emerald-400" : "bg-rose-400"}`} />
                                <span className="text-slate-300 capitalize w-16">{h.type}</span>
                                <span className="text-slate-500 font-mono">{new Date(h.ts).toLocaleString()}</span>
                                {!h.success && <span className="text-rose-400/70 font-mono">{h.reason}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="account" data-testid="portal-account">
                  <div className="space-y-4">
                    <div className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Signed in as</div>
                      <div className="text-sm text-white">{data.email}</div>
                      <div className="text-xs text-slate-500 mt-1">Member since {data.customer_since ? new Date(data.customer_since).toLocaleDateString() : "—"}</div>
                    </div>
                    {data.orders.length > 0 && (
                      <div className="p-5 bg-[#0A1628] border border-[#1E2D4A] rounded-xl" data-testid="review-prompt">
                        <div className="text-sm font-semibold text-white mb-1">Enjoying your purchase?</div>
                        <div className="text-xs text-slate-500 mb-4">Leave a review — it goes live once our team approves it.</div>
                        {data.reviews.length > 0 && (
                          <div className="mb-4 space-y-2" data-testid="my-reviews">
                            {data.reviews.map((r) => (
                              <div key={r.id} className="flex items-center gap-3 text-xs">
                                <span className="text-amber-300">{"★".repeat(r.rating)}</span>
                                <span className="text-slate-400 truncate flex-1">{r.text}</span>
                                <span className={`font-mono text-[10px] uppercase ${r.status === "approved" ? "text-emerald-400" : r.status === "hidden" ? "text-slate-600" : "text-amber-400"}`}>{r.status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!reviewFor ? (
                          <div className="space-y-2">
                            {data.orders.map((o) => (
                              <button
                                key={o.id}
                                onClick={() => setReviewFor(o)}
                                data-testid={`review-order-${o.id}`}
                                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-[#1E2D4A] text-xs text-slate-300 hover:border-[#2E6BFF]/50 hover:text-white transition-all"
                              >
                                <span>Order {o.id.slice(0, 8).toUpperCase()} — {o.items.map((i) => i.name).join(", ")}</span>
                                <Star className="w-3.5 h-3.5 text-amber-300" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-3 p-4 rounded-lg bg-[#050B18] border border-[#1E2D4A]" data-testid="review-form">
                            <div className="flex items-center gap-1" data-testid="review-stars">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button key={n} onClick={() => setReview((r) => ({ ...r, rating: n }))} data-testid={`review-star-${n}`} className="p-1">
                                  <Star className={`w-6 h-6 ${n <= review.rating ? "text-amber-300 fill-amber-300" : "text-slate-600"}`} />
                                </button>
                              ))}
                            </div>
                            <select
                              value={review.product_id}
                              onChange={(e) => setReview((r) => ({ ...r, product_id: e.target.value }))}
                              data-testid="review-product-select"
                              className="w-full h-10 rounded-lg bg-[#0A1628] border border-[#1E2D4A] text-sm px-3 text-slate-100"
                            >
                              <option value="">Whole store (no product)</option>
                              {reviewFor.items.map((i) => (
                                <option key={i.product_id} value={i.product_id}>{i.name}</option>
                              ))}
                            </select>
                            <Input
                              value={review.name}
                              onChange={(e) => setReview((r) => ({ ...r, name: e.target.value }))}
                              placeholder="Display name (optional — never your email)"
                              data-testid="review-name-input"
                              className="bg-[#0A1628] border-[#1E2D4A] text-sm"
                            />
                            <Textarea
                              value={review.text}
                              onChange={(e) => setReview((r) => ({ ...r, text: e.target.value }))}
                              placeholder="How was it? Delivery speed, quality, support..."
                              rows={3}
                              data-testid="review-text-input"
                              className="bg-[#0A1628] border-[#1E2D4A] text-sm resize-y"
                            />
                            <div className="flex gap-2">
                              <button onClick={submitReview} disabled={submittingReview || review.text.trim().length < 3} data-testid="review-submit" className="flex-1 px-4 py-2 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                                {submittingReview ? "Submitting..." : "Submit review"}
                              </button>
                              <button onClick={() => setReviewFor(null)} data-testid="review-cancel" className="px-4 py-2 rounded-lg border border-[#1E2D4A] text-sm text-slate-400 hover:text-white transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
