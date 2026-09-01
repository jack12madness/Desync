import { useEffect } from "react";
import Lenis from "lenis";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";
import Home from "@/pages/Home";
import StatusPage from "@/pages/StatusPage";
import OrderLookup from "@/pages/OrderLookup";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";

function App() {
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

  return (
    <CartProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[#06070B] text-slate-100 font-body relative">
          <div className="noise-overlay" aria-hidden="true" />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/orders" element={<OrderLookup />} />
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
