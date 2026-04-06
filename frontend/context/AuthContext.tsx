import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loginUser,
  getUser,
  updateProfile,
  addAddress as apiAddAddress,
  selectAddress as apiSelectAddress,
  deleteAddress as apiDeleteAddress,
} from "../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Address = {
  id: string;
  label: string;
  full: string;
  icon: string;
  city?: string;
  area?: string;
};

export type User = {
  id: string;
  phone: string;
  name: string;
  email: string;
  addresses: Address[];
  selectedAddressId: string;
  cart: any[];        // raw cart from DB — CartContext will read this
  purchases: any[];
};

type AuthCtx = {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;           // true while restoring session
  login: (phone: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<Pick<User, "name" | "email">>) => Promise<void>;
  addAddress: (addr: Omit<Address, "id">) => Promise<void>;
  selectAddress: (id: string) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  selectedAddress: Address | null;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  isLoggedIn: false,
  loading: true,
  login: async () => {},
  logout: async () => {},
  updateUser: async () => {},
  addAddress: async () => {},
  selectAddress: async () => {},
  deleteAddress: async () => {},
  selectedAddress: null,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On app start — restore session from AsyncStorage
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedId = await AsyncStorage.getItem("userId");
      if (storedId) {
        // Fetch FULL user from DB including cart[] and purchases[]
        const freshUser = await getUser(storedId);
        setUser(freshUser);
      }
    } catch (e) {
      await AsyncStorage.removeItem("userId");
    } finally {
      setLoading(false);   // ← CartContext watches this to know when user is ready
    }
  };

  const login = async (phone: string) => {
    const userData = await loginUser(phone);
    setUser(userData);
    await AsyncStorage.setItem("userId", userData.id);
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem("userId");
  };

  const updateUser = async (data: Partial<Pick<User, "name" | "email">>) => {
    if (!user) return;
    const updated = await updateProfile(user.id, data);
    setUser(updated);
  };

  const addAddress = async (addr: Omit<Address, "id">) => {
    if (!user) return;
    const updated = await apiAddAddress(user.id, addr);
    setUser(updated);
  };

  const selectAddress = async (id: string) => {
    if (!user) return;
    const updated = await apiSelectAddress(user.id, id);
    setUser(updated);
  };

  const deleteAddress = async (id: string) => {
    if (!user) return;
    const updated = await apiDeleteAddress(user.id, id);
    setUser(updated);
  };

  const selectedAddress =
    user?.addresses.find((a) => a.id === user.selectedAddressId) ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        login,
        logout,
        updateUser,
        addAddress,
        selectAddress,
        deleteAddress,
        selectedAddress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);