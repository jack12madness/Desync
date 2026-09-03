import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";

const CartContext = createContext(null);

export const DURATION_LABELS = {
  day: "1 Day",
  week: "1 Week",
  month: "1 Month",
  lifetime: "Lifetime",
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

  const addItem = useCallback((product, duration) => {
    setItems((prev) => {
      if (prev.some((i) => i.product.id === product.id && i.duration === duration)) {
        toast.error("Already in your cart");
        return prev;
      }
      const minBuy = Math.max(1, product.min_buy || 1);
      toast.success(minBuy > 1
        ? `${product.name} (${DURATION_LABELS[duration]}) ×${minBuy} pack added to cart`
        : `${product.name} (${DURATION_LABELS[duration]}) added to cart`);
      return [
        ...prev,
        {
          product: {
            id: product.id,
            name: product.name,
            game: product.game,
            image_url: product.image_url,
            min_buy: minBuy,
          },
          duration,
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
