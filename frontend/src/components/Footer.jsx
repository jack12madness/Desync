import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-[#1E2D4A] bg-[#07101F]" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <img src="/images/logo.svg" alt="Desync logo" className="w-8 h-8 rounded-lg" />
            <span className="font-display font-extrabold tracking-tight text-lg">
              De<span className="text-[#2E6BFF]">sync</span>
            </span>
          </div>
          <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
            Premium game software, honestly run. Live status on every product,
            instant key delivery, and support that shows up.
          </p>
          <p className="mt-6 text-xs text-slate-600 leading-relaxed max-w-md">
            All software is sold for educational purposes. Use at your own risk.
            Not affiliated with Rockstar Games, Cfx.re, Facepunch, Activision, Riot Games or EA.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold text-white mb-4">Shop</div>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li><a href="/#shop" data-testid="footer-link-shop" className="hover:text-white transition-colors">All Products</a></li>
            <li><Link to="/status" data-testid="footer-link-status" className="hover:text-white transition-colors">Cheat Status</Link></li>
            <li><Link to="/orders" data-testid="footer-link-orders" className="hover:text-white transition-colors">My Orders</Link></li>
            <li><Link to="/drop" data-testid="footer-link-drop" className="hover:text-white transition-colors">Next Drop</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white mb-4">Support</div>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li><a href="https://discord.gg/GapTZMAY7v" target="_blank" rel="noopener noreferrer" data-testid="footer-link-discord" className="hover:text-white transition-colors">Discord Server</a></li>
            <li><Link to="/admin" data-testid="footer-link-staff" className="hover:text-white transition-colors">Staff Login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#1E2D4A] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-slate-600">
          <span>© 2026 Desync</span>
          <span>Undetected. Unmatched.</span>
        </div>
      </div>
    </footer>
  );
}
