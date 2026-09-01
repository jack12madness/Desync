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
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Checkout cancelled</h1>
          <p className="text-sm text-slate-400 mt-4">
            No charge was made. Your cart is still saved — jump back in whenever you're ready.
          </p>
          <Link
            to="/"
            data-testid="cancel-back-link"
            className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-[#2E6BFF] hover:bg-[#1D55E0] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(46,107,255,0.35)] transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" /> Back to the shop
          </Link>
        </div>
      </main>
    </div>
  );
}
