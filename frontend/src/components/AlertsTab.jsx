import { useEffect, useState } from "react";
import { Bell, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, apiError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const CHANNELS = [
  {
    kind: "orders",
    title: "New orders",
    desc: "Card checkout started, manual key sends",
    color: "text-indigo-300 border-indigo-400/40 bg-indigo-400/10",
  },
  {
    kind: "payments",
    title: "Payments received",
    desc: "Any order paid & fulfilled — Stripe, bank mark-paid, manual",
    color: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  },
  {
    kind: "bank",
    title: "Bank transfers (PayID / BSB)",
    desc: "New bank order, buyer clicked 'I have sent the payment', cancellations",
    color: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  },
  {
    kind: "low_stock",
    title: "Low stock",
    desc: "Pool drops to 4 left, and when it hits 0",
    color: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  },
  {
    kind: "restock",
    title: "Restock announcements",
    desc: "Posted to your community when you add keys and choose 'Announce this restock'",
    color: "text-violet-300 border-violet-400/40 bg-violet-400/10",
  },
];

export default function AlertsTab() {
  const [hooks, setHooks] = useState({ orders: "", payments: "", bank: "", low_stock: "", restock: "" });
  const [desktopUrl, setDesktopUrl] = useState("");
  const [discordInt, setDiscordInt] = useState({ client_id: "", client_secret: "", bot_token: "", guild_id: "", role_id: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  useEffect(() => {
    api.get("/admin/settings").then(({ data }) => {
      const existing = data.discord_webhooks || {};
      setHooks({
        orders: existing.orders || "", payments: existing.payments || "",
        bank: existing.bank || "", low_stock: existing.low_stock || "",
        restock: existing.restock || "",
      });
      setDesktopUrl(data.desktop_download_url || "");
      const di = data.discord_integration || {};
      setDiscordInt({
        client_id: di.client_id || "", client_secret: di.client_secret || "",
        bot_token: di.bot_token || "", guild_id: di.guild_id || "", role_id: di.role_id || "",
      });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const di = Object.fromEntries(Object.entries(discordInt).map(([k, v]) => [k, v.trim()]));
      const anySet = Object.values(di).some(Boolean);
      await api.put("/admin/settings", {
        discord_webhooks: hooks,
        desktop_download_url: desktopUrl.trim() || null,
        discord_integration: anySet ? di : null,
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const test = async (kind) => {
    setTesting(kind);
    try {
      await api.post("/admin/discord-test", { kind });
      toast.success("Test embed sent — check the channel");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setTesting(null);
    }
  };

  const fieldCls = "bg-[#050B18] border-slate-700 focus-visible:ring-blue-400 font-mono text-sm";

  return (
    <div data-testid="alerts-tab">
      <h2 className="font-display text-xl font-bold uppercase tracking-tight mb-6">Discord Alerts</h2>

      <div className="p-5 bg-[#0F1F38] border border-blue-900/40 rounded-lg mb-6 text-sm text-slate-400 leading-relaxed">
        <div className="text-white font-semibold mb-2 flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-400" /> How to set up
        </div>
        In your Discord server, for each channel you want alerts in:{" "}
        <span className="text-slate-200">Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL</span>.
        Paste each URL into the matching box below. Every alert type posts to its own channel as a rich embed
        with the order, items, total, buyer email and Discord username.
      </div>

      <div className="space-y-4">
        {CHANNELS.map((c) => (
          <div key={c.kind} className="p-4 bg-[#0F1F38] border border-blue-900/40 rounded-lg" data-testid={`alert-channel-${c.kind}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg border ${c.color}`}>
                {c.title}
              </span>
              <span className="text-xs text-slate-500">{c.desc}</span>
            </div>
            <div className="flex gap-3">
              <Input
                value={hooks[c.kind]}
                onChange={(e) => setHooks({ ...hooks, [c.kind]: e.target.value })}
                placeholder="https://discord.com/api/webhooks/…"
                data-testid={`webhook-input-${c.kind}`}
                className={fieldCls}
              />
              <button
                onClick={() => test(c.kind)}
                disabled={testing === c.kind || !hooks[c.kind].trim()}
                data-testid={`webhook-test-${c.kind}`}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-400/40 text-blue-300 text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-400/10 disabled:opacity-40 transition-all"
              >
                <Send className="w-3.5 h-3.5" /> {testing === c.kind ? "Sending..." : "Test"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 bg-[#0F1F38] border border-blue-900/40 rounded-lg mt-6" data-testid="desktop-app-setting">
        <div className="text-white font-semibold mb-2 text-sm">Windows app download link</div>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          After the GitHub build publishes a release, paste its direct download URL here — the storefront
          will show a "Get the Windows app" section. It looks like:{" "}
          <code className="text-slate-400 text-[10px]">https://github.com/&lt;you&gt;/&lt;repo&gt;/releases/latest/download/DesyncDesktop-Setup.exe</code>.
          Leave blank to hide the section.
        </p>
        <Input
          value={desktopUrl}
          onChange={(e) => setDesktopUrl(e.target.value)}
          placeholder="https://github.com/you/repo/releases/latest/download/DesyncDesktop-Setup.exe"
          data-testid="desktop-download-url-input"
          className={fieldCls}
        />
      </div>

      <div className="p-5 bg-[#0F1F38] border border-blue-900/40 rounded-lg mt-6" data-testid="discord-integration-setting">
        <div className="text-white font-semibold mb-2 text-sm">Discord customer role (auto-join + auto-role on payment)</div>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          Buyers link their Discord in the cart before paying; on payment the bot adds them to your server
          (if they aren't in it) and gives them the customer role. Setup: Discord Developer Portal → New Application →
          copy Client ID + Secret (OAuth2 tab) → add the redirect URL{" "}
          <code className="text-slate-400 text-[10px]">https://desync.website/api/discord/callback</code>{" "}
          (and the preview one while testing) → Bot tab → create bot, copy its token → invite the bot to your server with
          Manage Roles → enable Developer Mode in Discord, right-click your server for the Server ID and the customer role for the Role ID.
          The bot's role must sit ABOVE the customer role in Server Settings → Roles. Fill all five to switch it on; clear them to switch it off.
        </p>
        <div className="space-y-3">
          {[
            ["client_id", "Client ID", "e.g. 1234567890123456789"],
            ["client_secret", "Client Secret", "OAuth2 → Client Secret"],
            ["bot_token", "Bot Token", "Bot → Token (keep private)"],
            ["guild_id", "Server ID", "Right-click your server → Copy Server ID"],
            ["role_id", "Customer Role ID", "Server Settings → Roles → right-click role → Copy Role ID"],
          ].map(([k, label, ph]) => (
            <div key={k}>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">{label}</label>
              <Input
                type={k === "client_secret" || k === "bot_token" ? "password" : "text"}
                value={discordInt[k]}
                onChange={(e) => setDiscordInt({ ...discordInt, [k]: e.target.value })}
                placeholder={ph}
                data-testid={`discord-int-${k}`}
                className={fieldCls}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        data-testid="alerts-save"
        className="mt-6 px-6 py-2.5 rounded-lg bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 disabled:opacity-40 transition-all"
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </div>
  );
}
