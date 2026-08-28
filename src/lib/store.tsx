import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { promoCodes } from "@/lib/products";

export type CartItem = { productId: string; quantity: number };

type StoreState = {
  cart: CartItem[];
  wishlist: string[];
  promo: string | null;
  addToCart: (productId: string, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  setQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  inWishlist: (productId: string) => boolean;
  applyPromo: (code: string) => boolean;
  clearPromo: () => void;
  itemCount: number;
};

const StoreCtx = createContext<StoreState | null>(null);
const STORAGE_KEY = "glowlux:store:v1";

function loadInitial() {
  if (typeof window === "undefined") return { cart: [], wishlist: [], promo: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cart: [], wishlist: [], promo: null };
    return JSON.parse(raw);
  } catch {
    return { cart: [], wishlist: [], promo: null };
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [promo, setPromo] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = loadInitial();
    setCart(s.cart ?? []);
    setWishlist(s.wishlist ?? []);
    setPromo(s.promo ?? null);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart, wishlist, promo }));
  }, [cart, wishlist, promo, hydrated]);

  const value = useMemo<StoreState>(() => ({
    cart, wishlist, promo,
    addToCart: (productId, qty = 1) =>
      setCart(prev => {
        const existing = prev.find(i => i.productId === productId);
        if (existing) return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + qty } : i);
        return [...prev, { productId, quantity: qty }];
      }),
    removeFromCart: (productId) => setCart(prev => prev.filter(i => i.productId !== productId)),
    setQuantity: (productId, qty) => setCart(prev =>
      qty <= 0 ? prev.filter(i => i.productId !== productId)
              : prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i)),
    clearCart: () => { setCart([]); setPromo(null); },
    toggleWishlist: (productId) => setWishlist(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]),
    inWishlist: (productId) => wishlist.includes(productId),
    applyPromo: (code) => {
      const c = code.trim().toUpperCase();
      if (promoCodes[c]) { setPromo(c); return true; }
      return false;
    },
    clearPromo: () => setPromo(null),
    itemCount: cart.reduce((sum, i) => sum + i.quantity, 0),
  }), [cart, wishlist, promo]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
