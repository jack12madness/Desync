import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Landmark, Copy, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, eur } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

function CopyRow({ label, value, testid }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[#1E2D4A] last:border-0" data-testid={testid}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm text-slate-100">{value}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success(`${label} copied`);
          }}
          data-testid={`${testid}-copy`}
          className="text-slate-600 hover:text-[#8FB8E8] transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </span>
    </div>
  );
}

export default function BankPending() {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setFailed(true);
      return;
    }
    api.get(`/payments/bank-transfer/${orderId}`)
      .then(({ data }) => setData(data))
      .catch(() => setFailed(true));
  }, [orderId]);

  return (
    <div className="min-h-screen bg-[#050B18]" data-testid="bank-pending-page">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 pt-32 pb-24">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 text-sm font-medium text-[#5B8CFF]">Bank Transfer</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white mb-3" data-testid="bank-pending-title">
            Complete your transfer
          </h1>

          {failed && (
            <div className="p-5 rounded-xl bg-[#0A1628] border border-[#1E2D4A] text-sm text-slate-400" data-testid="bank-pending-error">
              This order wasn't found or is no longer awaiting payment. If you already paid, check
              the <Link to="/orders" className="text-[#7FB0FF] hover:text-white">My Orders</Link> page — your keys appear there once we confirm the transfer.
            </div>
          )}

          {data && (
            <>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Your order is reserved. Send the exact amount by PayID or bank transfer using the
                reference below. <span className="text-amber-300 font-medium">BSB and account transfers are not
                instant delivery</span> — we manually confirm each payment, and the moment it's confirmed
                your license key and loader download are emailed to you automatically.
              </p>

              <div className="p-5 rounded-xl bg-[#0A1628] border border-[#2E6BFF]/30 mb-4" data-testid="bank-reference-box">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-1">
                  Payment reference — include this
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-[#8FB8E8]" data-testid="bank-reference">{data.reference}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(data.reference);
                      toast.success("Reference copied");
                    }}
                    data-testid="bank-reference-copy"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E6BFF]/10 border border-[#2E6BFF]/40 text-[#8FB8E8] text-xs font-medium hover:bg-[#2E6BFF]/20 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#0A1628] border border-[#1E2D4A] mb-6" data-testid="bank-details-box">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-2">
                  Transfer to
                </div>
                <CopyRow label="Amount" value={eur(data.total)} testid="bank-amount" />
                <CopyRow label="PayID" value={data.bank?.payid} testid="bank-payid" />
                <CopyRow label="BSB" value={data.bank?.bank_bsb} testid="bank-bsb" />
                <CopyRow label="Account number" value={data.bank?.bank_account_number} testid="bank-account-number" />
                <CopyRow label="Account name" value={data.bank?.bank_account_name} testid="bank-account-name" />
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg border border-dashed border-[#2E6BFF]/30 text-sm text-slate-400 mb-8">
                <Clock className="w-4 h-4 mt-0.5 text-[#5B8CFF] shrink-0" />
                <span>
                  This reservation expires 48 hours after creation — if no payment arrives, the order
                  is cancelled automatically and nothing is charged. We've also emailed these details to you.
                </span>
              </div>

              <div className="flex gap-3">
                <Link
                  to="/orders"
                  data-testid="bank-pending-my-orders"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold transition-colors"
                >
                  <Landmark className="w-4 h-4" /> Go to My Orders
                </Link>
                <Link
                  to="/"
                  data-testid="bank-pending-home"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-[#1E2D4A] text-slate-300 text-sm font-semibold hover:bg-[#0A1628] transition-colors"
                >
                  Back to store
                </Link>
              </div>
            </>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
