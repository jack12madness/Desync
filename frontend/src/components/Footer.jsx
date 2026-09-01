import { Link } from "react-router-dom";
import { Terminal } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-blue-500/10 bg-[#07101F]" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-blue-400" />
            <span className="font-display font-extrabold tracking-tight text-lg uppercase">
              Void<span className="text-blue-400">ware</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
            Premium game software, honestly run. Live status on every product,
            instant key delivery, and support that shows up.
          </p>
          <p className="mt-6 text-[10px] font-mono text-slate-700 leading-relaxed max-w-md uppercase tracking-wider">
            All software is sold for educational purposes. Use at your own risk.
            Not affiliated with Rockstar Games, Cfx.re, Facepunch, Activision, Riot Games or EA.
          </p>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-blue-500 mb-4">Shop</div>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><a href="/#shop" data-testid="footer-link-shop" className="hover:text-blue-300 transition-colors">All Products</a></li>
            <li><Link to="/status" data-testid="footer-link-status" className="hover:text-blue-300 transition-colors">Cheat Status</Link></li>
            <li><Link to="/orders" data-testid="footer-link-orders" className="hover:text-blue-300 transition-colors">My Orders</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-blue-500 mb-4">Support</div>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><a href="https://discord.gg/voidware" target="_blank" rel="noopener noreferrer" data-testid="footer-link-discord" className="hover:text-blue-300 transition-colors">Discord Server</a></li>
            <li><Link to="/admin" data-testid="footer-link-staff" className="hover:text-blue-300 transition-colors">Staff Login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-blue-500/10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-slate-600">
          <span>© 2026 VOIDWARE</span>
          <span>Undetected. Unmatched.</span>
        </div>
      </div>
    </footer>
  );
}
