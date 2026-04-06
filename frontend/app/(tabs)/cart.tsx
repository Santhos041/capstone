import React from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    cartItems, totalAmount, totalItems,
    updateQty, removeFromCart, placeOrder, isCheckingOut
  } = useCart();

  const handleCheckout = async () => {
    // ── Guards with visible feedback ────────────────────────────────────────
    if (!user) {
      Alert.alert("Not logged in", "Please log in first.");
      return;
    }
    if (!user.selectedAddressId) {
      Alert.alert("No address selected", "Please add and select a delivery address first.");
      return;
    }
    if (cartItems.length === 0) {
      Alert.alert("Cart is empty", "Add some items first.");
      return;
    }

    console.log("Checkout tapped — calling placeOrder()");

    try {
      const result = await placeOrder();

      console.log("placeOrder result:", result);

      if (result?.order_id) {
        router.replace({
          pathname: "/order-success",
          params: { orderId: result.order_id },
        });
      } else {
        Alert.alert("Something went wrong", "Order could not be placed. Please try again.");
      }

    } catch (err: any) {
      console.log("Checkout error in cart.tsx:", err);
      Alert.alert(
        "Order failed",
        err?.response?.data?.detail ?? err?.message ?? "Please check your connection and try again."
      );
    }
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>🛒</Text>
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptySub}>Add items to get started</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => router.replace("/(tabs)")}>
            <Text style={s.shopBtnText}>Shop Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Cart items ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>

      <View style={s.headerRow}>
        <Text style={s.header}>My Cart</Text>
        <Text style={s.itemCount}>{totalItems} item{totalItems !== 1 ? "s" : ""}</Text>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={item => item.product_id}
        contentContainerStyle={{ paddingBottom: 220 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardInfo}>
              <Text style={s.name} numberOfLines={2}>{item.product_name}</Text>
              <Text style={s.price}>₹{item.price} each</Text>
            </View>

            <View style={s.qtyRow}>
              <TouchableOpacity
                style={s.qtyBtn}
                onPress={() => updateQty(item.product_id, item.qty - 1)}
              >
                <Text style={s.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.qty}>{item.qty}</Text>
              <TouchableOpacity
                style={s.qtyBtn}
                onPress={() => updateQty(item.product_id, item.qty + 1)}
              >
                <Text style={s.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.subtotal}>₹{item.price * item.qty}</Text>

            <TouchableOpacity
              style={s.removeBtn}
              onPress={() => removeFromCart(item.product_id)}
            >
              <Text style={s.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Sticky footer */}
      <View style={s.footer}>

        <View style={s.addressRow}>
          <Text style={s.addressIcon}>📍</Text>
          <Text style={s.addressText} numberOfLines={1}>
            {user?.selectedAddressId
              ? user.addresses?.find(a => a.id === user.selectedAddressId)?.full ?? "Selected address"
              : "⚠️ No address selected — tap to add one"}
          </Text>
        </View>

        <View style={s.billRow}>
          <Text style={s.billLabel}>Item total</Text>
          <Text style={s.billValue}>₹{totalAmount}</Text>
        </View>
        <View style={s.billRow}>
          <Text style={s.billLabel}>Delivery fee</Text>
          <Text style={s.billFree}>FREE</Text>
        </View>
        <View style={[s.billRow, s.totalRow]}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalAmount}>₹{totalAmount}</Text>
        </View>

        <TouchableOpacity
          style={[
            s.checkoutBtn,
            (!user?.selectedAddressId || isCheckingOut) && s.checkoutDisabled
          ]}
          onPress={handleCheckout}
          disabled={isCheckingOut}
          activeOpacity={0.85}
        >
          {isCheckingOut ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.checkoutText}>Place Order →</Text>
          )}
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fff" },
  headerRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  header:           { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  itemCount:        { fontSize: 13, color: "#888", fontWeight: "600" },
  empty:            { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyEmoji:       { fontSize: 56, marginBottom: 16 },
  emptyTitle:       { fontSize: 20, fontWeight: "800", color: "#1A1A1A", marginBottom: 6 },
  emptySub:         { fontSize: 14, color: "#888", marginBottom: 24 },
  shopBtn:          { backgroundColor: "#0C831F", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  shopBtnText:      { color: "#fff", fontWeight: "700", fontSize: 15 },
  card:             { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  cardInfo:         { flex: 1, marginRight: 8 },
  name:             { fontSize: 14, fontWeight: "700", color: "#1A1A1A", marginBottom: 3 },
  price:            { fontSize: 12, color: "#888" },
  qtyRow:           { flexDirection: "row", alignItems: "center", marginHorizontal: 8 },
  qtyBtn:           { width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: "#0C831F", alignItems: "center", justifyContent: "center" },
  qtyBtnText:       { color: "#0C831F", fontSize: 16, fontWeight: "800", lineHeight: 20 },
  qty:              { marginHorizontal: 10, fontSize: 15, fontWeight: "700", color: "#1A1A1A", minWidth: 16, textAlign: "center" },
  subtotal:         { fontSize: 14, fontWeight: "800", color: "#1A1A1A", marginRight: 10, minWidth: 48, textAlign: "right" },
  removeBtn:        { padding: 6 },
  removeText:       { color: "#ccc", fontSize: 14 },
  footer:           { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: "#F0F0F0", elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  addressRow:       { flexDirection: "row", alignItems: "center", marginBottom: 10, backgroundColor: "#F9F9F9", padding: 8, borderRadius: 8 },
  addressIcon:      { fontSize: 13, marginRight: 6 },
  addressText:      { fontSize: 12, color: "#555", flex: 1 },
  billRow:          { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  billLabel:        { fontSize: 13, color: "#888" },
  billValue:        { fontSize: 13, color: "#1A1A1A", fontWeight: "600" },
  billFree:         { fontSize: 13, color: "#0C831F", fontWeight: "700" },
  totalRow:         { borderTopWidth: 1, borderTopColor: "#F0F0F0", marginTop: 6, paddingTop: 8, marginBottom: 12 },
  totalLabel:       { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  totalAmount:      { fontSize: 17, fontWeight: "900", color: "#0C831F" },
  checkoutBtn:      { backgroundColor: "#0C831F", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  checkoutDisabled: { backgroundColor: "#A5D6A7" },
  checkoutText:     { color: "#fff", fontSize: 16, fontWeight: "800" },
});