import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { syncCart, checkout as apiCheckout } from "../services/api";
import { useAuth } from "./AuthContext";
import { trackCartEvent, trackOrder } from "../services/api";
// ─── Types ────────────────────────────────────────────────────────────────────

export type CartItem = {
  product_id: string;
  product_name: string;
  qty: number;
  price: number;
  image?: string;
};

type CartCtx = {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, "qty">) => void;
  removeFromCart: (product_id: string) => void;
  updateQty: (product_id: string, qty: number) => void;
  clearCart: () => void;
  placeOrder: () => Promise<{ order_id: string } | null>;
  totalAmount: number;
  totalItems: number;
  isCheckingOut: boolean;
};

const CartContext = createContext<CartCtx>({
  cartItems: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQty: () => {},
  clearCart: () => {},
  placeOrder: async () => null,
  totalAmount: 0,
  totalItems: 0,
  isCheckingOut: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems]       = useState<CartItem[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [cartLoaded, setCartLoaded]     = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const sessionId = useRef(
    Date.now().toString(36) + Math.random().toString(36).substring(2)
  ).current;
  // ── KEY FIX: wait for auth to finish loading, THEN load cart from DB ──────
  // This runs when:
  //   1. App opens fresh  → authLoading goes false → user is set → load cart
  //   2. User logs in     → user.id changes        → load cart
  //   3. User logs out    → user becomes null       → clear cart
  useEffect(() => {
    if (authLoading) return;   // auth still restoring session, wait

    if (user?.id) {
      loadCartFromUser();
    } else {
      // Logged out — clear everything
      setCartItems([]);
      setCartLoaded(false);
    }
  }, [authLoading, user?.id]);

  // ── Load cart from user.cart[] which AuthContext already fetched from DB ───
  // No extra API call needed — AuthContext's getUser() already returns cart[]
  const loadCartFromUser = () => {
    try {
      const dbCart: CartItem[] = (user?.cart ?? []).map((item: any) => ({
        product_id:   item.product_id,
        product_name: item.product_name,
        qty:          item.qty,
        price:        item.price,
      }));
      setCartItems(dbCart);
      console.log("Cart loaded from DB:", dbCart.length, "items");
    } catch (e) {
      console.log("Failed to load cart:", e);
    } finally {
      setCartLoaded(true);
    }
  };

  // ── Sync cart to DB whenever it changes (DEBOUNCED 800ms) ─────────────────
  useEffect(() => {
    if (!cartLoaded) {
      console.log("🔴 Sync skipped: cartLoaded =", cartLoaded);
      return;
    }
    if (!user?.id) {
      console.log("🔴 Sync skipped: user?.id =", user?.id);
      return;
    }

    // Clear any pending sync timer
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }

    console.log("⏱️  800ms debounce timer started. Current cart:", cartItems.length, "items");

    // Set new debounced sync
    syncTimer.current = setTimeout(async () => {
      try {
        console.log("🟢 SYNC TIMER FIRED! About to sync:", cartItems.length, "items");
        console.log("   Items to sync:", cartItems);

        const itemsToSend = cartItems.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          qty: i.qty,
          price: i.price,
        }));

        console.log("📦 Sending to backend:", itemsToSend);

        await syncCart(user.id, itemsToSend);

        console.log("✅ Cart synced successfully to DB");
      } catch (e) {
        console.error("❌ Cart sync failed:", e);
      }
    }, 800); // Wait 800ms after last change before syncing

    // Cleanup on unmount
    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
      }
    };
  }, [cartItems, user?.id, cartLoaded]);


  // ── Cart operations ───────────────────────────────────────────────────────

  const addToCart = (item: Omit<CartItem, "qty">) => {
  console.log("➕ addToCart called:", item.product_name);

  setCartItems(prev => {
    const existing = prev.find(i => i.product_id === item.product_id);
    const newQty = existing ? existing.qty + 1 : 1;

    // Fire Kafka cart event — non blocking
    if (user?.id) {
      trackCartEvent(
        user.id,
        sessionId,
        item.product_id,
        item.product_name,
        item.price,
        newQty,
        "add"
      );
    }

    if (existing) {
      return prev.map(i =>
        i.product_id === item.product_id ? { ...i, qty: i.qty + 1 } : i
      );
    }
    return [...prev, { ...item, qty: 1 }];
  });
};

  const removeFromCart = (product_id: string) => {
  const item = cartItems.find(i => i.product_id === product_id);

  // Fire Kafka remove event
  if (user?.id && item) {
    trackCartEvent(
      user.id,
      sessionId,
      product_id,
      item.product_name,
      item.price,
      0,
      "remove"
    );
  }

  setCartItems(prev => prev.filter(i => i.product_id !== product_id));
};

  const updateQty = (product_id: string, qty: number) => {
    if (qty <= 0) { removeFromCart(product_id); return; }
    setCartItems(prev =>
      prev.map(i => i.product_id === product_id ? { ...i, qty } : i)
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  // ── Place order ───────────────────────────────────────────────────────────
  // Calls POST /users/{id}/checkout → saves to purchases[] → clears cart in DB

  const placeOrder = async (): Promise<{ order_id: string } | null> => {
  if (!user?.id || !user.selectedAddressId || cartItems.length === 0) return null;

  setIsCheckingOut(true);
  try {
    const items = cartItems.map(i => ({
      product_id:   i.product_id,
      product_name: i.product_name,
      qty:          i.qty,
      price:        i.price,
    }));

    const result = await apiCheckout(
      user.id,
      items,
      totalAmount,
      user.selectedAddressId
    );

    console.log("Order placed:", result.order_id);

    // Fire Kafka order event — after confirmed success
    trackOrder(
      user.id,
      sessionId,
      result.order_id,
      items,
      totalAmount,
      user.selectedAddressId
    );

    clearCart();
    return { order_id: result.order_id };

  } catch (err: any) {
    console.log("placeOrder error:", err?.response?.data ?? err?.message);
    throw err;
  } finally {
    setIsCheckingOut(false);
  }
};

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalAmount = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const totalItems  = cartItems.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQty,
      clearCart,
      placeOrder,
      totalAmount,
      totalItems,
      isCheckingOut,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);