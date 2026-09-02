import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/context/CartContext";

const links = [
  { label: "Home", to: "/", testid: "nav-link-home" },
  { label: "Shop", to: "/#shop", testid: "nav-link-shop", anchor: true },
  { label: "Status", to: "/status", testid: "nav-link-status" },
  { label: "My Orders", to: "/orders", testid: "nav-link-orders" },
];

export default function Navbar() {
  const { items, openCart } = useCart();

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 inset-x-0 z-50 border-b border-[#1E2D4A] bg-[#050B18]/80 backdrop-blur-xl"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2.5 group">
          <img src="/images/logo.svg" alt="Desync logo" className="w-8 h-8 rounded-lg group-hover:scale-105 transition-transform duration-300" />
          <span className="font-display font-extrabold tracking-tight text-lg">
            De<span className="text-[#2E6BFF]">sync</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) =>
            l.anchor ? (
              <a
                key={l.label}
                href={l.to}
                data-testid={l.testid}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                to={l.to}
                data-testid={l.testid}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200"
              >
                {l.label}
              </Link>
            )
          )}
          <a
            href="https://discord.gg/GapTZMAY7v"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="nav-link-discord"
            className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200"
          >
            Discord
          </a>
        </nav>

        <button
          onClick={openCart}
          data-testid="nav-cart-trigger"
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2E6BFF]/10 border border-[#2E6BFF]/40 text-[#7FB0FF] hover:bg-[#2E6BFF]/20 hover:shadow-[0_0_20px_rgba(46,107,255,0.3)] transition-all duration-200"
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="text-xs font-mono uppercase tracking-widest hidden sm:inline">Cart</span>
          {items.length > 0 && (
            <span
              data-testid="nav-cart-count"
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#2E6BFF] text-white text-[10px] font-bold flex items-center justify-center"
            >
              {items.length}
            </span>
          )}
        </button>
      </div>
    </motion.header>
  );
}
