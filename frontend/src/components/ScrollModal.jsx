import { useEffect } from "react";
import { X } from "lucide-react";

// Radix Dialog locks the mouse wheel via react-remove-scroll, so long content
// can't be scrolled. This plain modal scrolls naturally (outer container scrolls).
export default function ScrollModal({ onClose, children, className = "", testid }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" data-lenis-prevent data-testid={testid}>
      <div className="fixed inset-0 bg-black/80" onClick={onClose} />
      <div className="relative min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div className={`relative w-full bg-[#0A1628] border border-[#1E2D4A] text-slate-100 rounded-xl shadow-2xl my-4 sm:my-8 p-6 ${className}`}>
          <button
            onClick={onClose}
            data-testid={testid ? `${testid}-close` : undefined}
            className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
