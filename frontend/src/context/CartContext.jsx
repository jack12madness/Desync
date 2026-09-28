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

  const addItem = useCallback((product, duration) => {
    setItems((prev) => {
      if (prev.some((i) => i.product.id === product.id && i.duration === duration)) {
        toast.error("Already in your cart");
        return prev;
      }
      const minBuy = Math.max(1, product.min_buy || 1);
      const label = durLabel(product, duration);
      toast.success(minBuy > 1
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
            boost_type: product.boost_type || null,
          },
          duration,
          duration_label: label,
          qty: minBuy,
          price: product.prices[duration],
        },
      ];
    });
  }, []);

  const setQty = useCallback((idx, qty) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const min = Math.max(1, it.product.min_buy || 1);
      return { ...it, qty: Math.max(min, Math.min(100, qty)) };
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
