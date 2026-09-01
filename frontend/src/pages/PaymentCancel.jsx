import { Link } from "react-router-dom";
import { XCircle, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function PaymentCancel() {
  return (
    <div data-testid="payment-cancel-page">
      <Navbar />
      <main className="pt-28 pb-24 min-h-screen flex items-center">
        <div className="max-w-xl mx-auto px-4 text-center">
          <XCircle className="w-14 h-14 text-rose-400 mx-auto mb-6" />
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Checkout Cancelled</h1>
          <p className="text-sm text-slate-400 mt-4">
            No charge was made. Your cart is still saved — jump back in whenever you're ready.
          </p>
          <Link
            to="/"
            data-testid="cancel-back-link"
            className="clip-tag mt-8 inline-flex items-center gap-2 px-8 py-4 bg-cyan-400 text-[#06070B] font-mono text-sm font-bold uppercase tracking-widest hover:bg-cyan-300 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to the Armoury
          </Link>
        </div>
      </main>
    </div>
  );
}
