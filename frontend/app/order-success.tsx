import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function OrderSuccess() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>

        <View style={s.iconCircle}>
          <Text style={s.icon}>✓</Text>
        </View>

        <Text style={s.title}>Order Placed!</Text>
        <Text style={s.sub}>Your order has been confirmed and{"\n"}will be delivered soon.</Text>

        {orderId && (
          <View style={s.orderIdBox}>
            <Text style={s.orderIdLabel}>Order ID</Text>
            <Text style={s.orderIdText}>{orderId.slice(0, 8).toUpperCase()}</Text>
          </View>
        )}

        <TouchableOpacity style={s.btn} onPress={() => router.replace("/(tabs)")}>
          <Text style={s.btnText}>Continue Shopping</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#fff" },
  inner:        { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  iconCircle:   { width: 88, height: 88, borderRadius: 44, backgroundColor: "#0C831F", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  icon:         { fontSize: 40, color: "#fff", fontWeight: "800" },
  title:        { fontSize: 28, fontWeight: "900", color: "#1A1A1A", marginBottom: 10 },
  sub:          { fontSize: 15, color: "#888", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  orderIdBox:   { backgroundColor: "#F0FFF4", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 32, width: "100%" },
  orderIdLabel: { fontSize: 12, color: "#0C831F", fontWeight: "600", marginBottom: 4 },
  orderIdText:  { fontSize: 18, fontWeight: "900", color: "#0C831F", letterSpacing: 2 },
  btn:          { backgroundColor: "#0C831F", borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48 },
  btnText:      { color: "#fff", fontSize: 16, fontWeight: "800" },
});