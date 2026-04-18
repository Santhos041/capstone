import axios from "axios";

// ─── Replace with your machine's actual local IP ──────────────────────────────
// Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find it
// When you deploy to AWS, change this to your EC2 public IP
const BASE_URL = "http://3.235.251.5:8000";

const api = axios.create({ baseURL: BASE_URL });

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════════════════════════════════════

export const fetchProducts = async () => {
  const res = await api.get("/products");
  return res.data;
};

export const fetchProductById = async (productId: string) => {
  const res = await api.get(`/products/${productId}`);
  return res.data;
};

export const fetchCategories = async () => {
  const res = await api.get("/categories");
  return res.data;
};

export const searchProducts = async (query: string) => {
  const res = await api.get(`/products/search/${query}`);
  return res.data;
};

export const fetchProductsByCategory = async (categoryId: string) => {
  const res = await api.get(`/products/category/${categoryId}`);
  return res.data;
};

// ══════════════════════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════════════════════

// ─── Login / Register ─────────────────────────────────────────────────────────
// Called after OTP verified. Creates user if first time.
export const loginUser = async (phone: string, expoPushToken?: string) => {
  const res = await api.post("/users/login", {
    phone,
    expo_push_token: expoPushToken ?? "",
  });
  return res.data; // { id, phone, name, email, addresses, selectedAddressId, isNewUser }
};

// ─── Get User ─────────────────────────────────────────────────────────────────
// Called on app startup if userId stored locally
export const getUser = async (userId: string) => {
  const res = await api.get(`/users/${userId}`);
  return res.data;
};

// ─── Update Profile ───────────────────────────────────────────────────────────
// Called from AccountScreen when user edits name or email
export const updateProfile = async (
  userId: string,
  data: { name?: string; email?: string }
) => {
  const res = await api.patch(`/users/${userId}/profile`, data);
  return res.data;
};

// ─── Add Address ──────────────────────────────────────────────────────────────
// Called from address.tsx when user saves a new address
export const addAddress = async (
  userId: string,
  address: {
    label: string;
    full: string;
    icon?: string;
    city?: string;
    area?: string;
    location?: { latitude: number; longitude: number };
  }
) => {
  const res = await api.post(`/users/${userId}/addresses`, address);
  return res.data;
};

// ─── Select Address ───────────────────────────────────────────────────────────
// Called from address.tsx when user taps "Deliver Here"
export const selectAddress = async (userId: string, addressId: string) => {
  const res = await api.patch(`/users/${userId}/addresses/select`, {
    address_id: addressId,
  });
  return res.data;
};

// ─── Delete Address ───────────────────────────────────────────────────────────
export const deleteAddress = async (userId: string, addressId: string) => {
  const res = await api.delete(`/users/${userId}/addresses/${addressId}`);
  return res.data;
};

// ─── Sync Cart ────────────────────────────────────────────────────────────────
// Call this whenever cart changes — persists to DB for abandonment tracking
export const syncCart = async (
  userId: string,
  items: { product_id: string; product_name: string; qty: number; price: number }[]
) => {
  const res = await api.post(`/users/${userId}/cart/sync`, { items });
  return res.data;
};

// ─── Checkout ─────────────────────────────────────────────────────────────────
// Moves cart → purchase history, clears cart
export const checkout = async (
  userId: string,
  items: { product_id: string; product_name: string; qty: number; price: number }[],
  totalAmount: number,
  addressId: string
) => {
  const res = await api.post(`/users/${userId}/checkout`, {
    items,
    total_amount: totalAmount,
    address_id: addressId,
  });
  return res.data; // returns updated user + order_id
};

// ─── Get Purchase History ─────────────────────────────────────────────────────
export const getPurchases = async (userId: string) => {
  const res = await api.get(`/users/${userId}/purchases`);
  return res.data;
};

// ─── Update Push Token ────────────────────────────────────────────────────────
// Call after expo-notifications permission granted
export const updatePushToken = async (userId: string, token: string) => {
  const res = await api.patch(`/users/${userId}/push-token`, { token });
  return res.data;
};


// ─── Kafka event tracking ──────────────────────────────────────────────────

export const trackClick = async (
  userId: string,
  sessionId: string,
  productId: string,
  productName: string,
  price: number,
  categoryId: string = ""
) => {
  try {
    await api.post("/events/click", {
      user_id:      userId,
      session_id:   sessionId,
      product_id:   productId,
      product_name: productName,
      category_id:  categoryId,
      price,
      lat: 0,   // replace with real location later
      lon: 0,
    });
  } catch (e) {
    // always silent — never break UI for tracking
  }
};

export const trackCartEvent = async (
  userId: string,
  sessionId: string,
  productId: string,
  productName: string,
  price: number,
  qty: number,
  action: "add" | "remove"
) => {
  try {
    await api.post("/events/cart", {
      user_id:      userId,
      session_id:   sessionId,
      product_id:   productId,
      product_name: productName,
      price,
      qty,
      action,
      lat: 0,
      lon: 0,
    });
  } catch (e) {
    // silent
  }
};

export const trackOrder = async (
  userId: string,
  sessionId: string,
  orderId: string,
  items: { product_id: string; product_name: string; qty: number; price: number }[],
  totalAmount: number,
  addressId: string
) => {
  try {
    await api.post("/events/order", {
      user_id:      userId,
      session_id:   sessionId,
      order_id:     orderId,
      items,
      total_amount: totalAmount,
      address_id:   addressId,
      lat: 0,
      lon: 0,
    });
  } catch (e) {
    // silent
  }
};