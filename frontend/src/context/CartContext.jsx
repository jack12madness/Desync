import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";

const CartContext = createContext(null);

export const DURATION_LABELS = {
  day: "1 Day",
  "3d": "3 Days",
  week: "1 Week",
  month: "1 Month",
  lifetime: "Lifetime",
};

// Label for a price key: staff custom label -> known duration -> raw key
export const durLabel = (product, d) =>
  (product && product.duration_labels && product.duration_labels[d]) || DURATION_LABELS[d] || d;

const DURATION_DAYS = { day: 1, "3d": 3, week: 7, month: 30, lifetime: 999999 };
const BOOST_TYPE_ORDER = ["followers", "likes", "views"];

// Approximate length in days for any price key, parsing custom labels like "2 Weeks" / "2w"
export const durationDays = (product, key) => {
  if (DURATION_DAYS[key] != null) return DURATION_DAYS[key];
  const label = (((product && product.duration_labels) || {})[key] || key).toLowerCase();
  const m = label.match(/(\d+(?:\.\d+)?)\s*(days?|d|weeks?|w|months?|mo|m)\b/);
  if (!m) return 999998; // unparseable customs: after known durations, before lifetime
  const n = parseFloat(m[1]);
  const unit = m[2][0];
  return n * (unit === "d" ? 1 : unit === "w" ? 7 : 30);
};

// Price keys in display order: cheats/accounts by duration length (custom slots in naturally),
// boost products keep followers/likes/views order
export const orderedPriceKeys = (product) => {
  const keys = Object.keys((product && product.prices) || {});
  if (product && product.kind === "boost") {
    return [
      ...BOOST_TYPE_ORDER.filter((k) => keys.includes(k)),
      ...keys.filter((k) => !BOOST_TYPE_ORDER.includes(k)),
    ];
  }
  return keys.sort((a, b) => durationDays(product, a) - durationDays(product, b) || a.localeCompare(b));
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("void_cart") || "[]");
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("void_cart", JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product, duration, qty) => {
    setItems((prev) => {
      if (prev.some((i) => i.product.id === product.id && i.duration === duration)) {
        toast.error("Already in your cart");
        return prev;
      }
      const isBoost = product.kind === "boost";
      const minBuy = Math.max(1, product.min_buy || 1);
      const unit = Number(product.prices[duration]) || 0;
      const minSpend = Number(product.min_spend) || 0;
      const spendUnits = unit > 0 && minSpend > 0 ? Math.ceil(minSpend / unit) : 1;
      const minUnits = isBoost ? Math.max(spendUnits, parseInt(product.min_qty) || 1) : minBuy;
      const finalQty = isBoost ? Math.max(minUnits, parseInt(qty) || 0) : minBuy;
      const label = durLabel(product, duration);
      toast.success(isBoost
        ? `${finalQty.toLocaleString()} ${label.toLowerCase()} added to cart`
        : minBuy > 1
          ? `${product.name} (${label}) ×${minBuy} pack added to cart`
          : `${product.name} (${label}) added to cart`);
      return [
        ...prev,
        {
          product: {
            id: product.id,
            name: product.name,
            game: product.game,
            image_url: product.image_url,
            min_buy: minBuy,
            kind: product.kind || "cheat",
            platform: product.platform || null,
            bulk_tiers: product.bulk_tiers || null,
          },
          duration,
          duration_label: label,
          qty: finalQty,
          min_units: isBoost ? minUnits : null,
          price: product.prices[duration],
        },
      ];
    });
  }, []);

  const setQty = useCallback((idx, qty) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const isBoost = it.product.kind === "boost";
      const min = it.min_units || Math.max(1, it.product.min_buy || 1);
      const max = isBoost ? 10000000 : 100;
      return { ...it, qty: Math.max(min, Math.min(max, parseInt(qty) || min)) };
    }));
  }, []);

  const removeItem = useCallback((idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((s, i) => s + i.price * (i.qty || 1), 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        setQty,
        removeItem,
        clearCart,
        total,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
