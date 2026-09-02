import { useEffect, useState } from "react";
import Lenis from "lenis";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";
import SplashScreen from "@/components/SplashScreen";
import Home from "@/pages/Home";
import StatusPage from "@/pages/StatusPage";
import OrderLookup from "@/pages/OrderLookup";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import TermsPage from "@/pages/TermsPage";

function App() {
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09 });
    let frame;
    const raf = (time) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <CartProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[#050B18] text-slate-100 font-body relative">
          <div className="noise-overlay" aria-hidden="true" />
          <AnimatePresence>{splash && <SplashScreen key="splash" />}</AnimatePresence>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/orders" element={<OrderLookup />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Routes>
          <CartDrawer />
          <Toaster position="bottom-right" theme="dark" />
        </div>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
