import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
function RouteGuard() {
  const { isLoggedIn, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while restoring session from AsyncStorage
    if (loading) return;

    const currentScreen = segments[0] as string;

    // ── Not logged in ─────────────────────────────────────────────────────
    if (!isLoggedIn) {
      if (currentScreen !== "login" && currentScreen !== "otp") {
        router.replace("/login");
      }
      return;
    }

    // ── Logged in — check what's missing ──────────────────────────────────

    const hasName    = !!(user?.name && user.name.trim().length > 0);
    const hasAddress = !!(user?.selectedAddressId);

    // Step 1: Must complete profile (name) first
    if (!hasName) {
      if (currentScreen !== "profile-setup") {
        router.replace("/profile-setup");
      }
      return;
    }

    // Step 2: Must select/add an address
    if (!hasAddress) {
      if (currentScreen !== "address") {
        router.replace("/address");
      }
      return;
    }

    // Step 3: Everything done — go to app (don't send back to login/setup)
    if (
      currentScreen === "login" ||
      currentScreen === "otp" ||
      currentScreen === "profile-setup" ||
      currentScreen === "address"
    ) {
      router.replace("/(tabs)");
    }

  }, [isLoggedIn, user?.name, user?.selectedAddressId, loading, segments]);

  return null;
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
      <ActivityIndicator size="large" color="#0C831F" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>      {/* ← add this */}
        <_Inner />
      </CartProvider>
    </AuthProvider>
  );
}

// Separate inner component so it can read AuthContext
function _Inner() {
  const { loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <>
      <RouteGuard />
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="address" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="order-success" />
      </Stack>
    </>
  );
}