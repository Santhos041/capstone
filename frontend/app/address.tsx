import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  StatusBar, ScrollView, TextInput, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function AddressScreen() {
  const router = useRouter();
  const { user, selectAddress, addAddress } = useAuth();

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("Home");
  const [newFull, setNewFull] = useState("");
  const [selected, setSelected] = useState("");

  const handleConfirm = () => {
    if (!selected) return;
    selectAddress(selected);
    router.replace("/(tabs)");
  };

  const handleAddAddress = () => {
    if (!newFull.trim()) return;
    const icons: Record<string, string> = { Home: "🏠", Work: "🏢", Other: "📍" };
    addAddress({ label: newLabel, full: newFull.trim(), icon: icons[newLabel] ?? "📍" });
    setNewFull("");
    setShowAdd(false);
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar backgroundColor="#0C831F" barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Select Delivery Address</Text>
        <Text style={s.headerSub}>Where should we deliver your order?</Text>
      </View>

      <ScrollView style={s.body} showsVerticalScrollIndicator={false}>

        {/* Delivery info banner */}
        <View style={s.infoBanner}>
          <Text style={s.infoBannerText}>⚡ Delivery in 8–10 minutes to your address</Text>
        </View>

        {/* Saved Addresses */}
        {user?.addresses && user.addresses.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>SAVED ADDRESSES</Text>
            {user.addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={[s.addrCard, selected === addr.id && s.addrCardSelected]}
                onPress={() => setSelected(addr.id)}
                activeOpacity={0.85}
              >
                <View style={s.addrLeft}>
                  <View style={[s.addrIconBox, selected === addr.id && s.addrIconBoxSelected]}>
                    <Text style={s.addrIcon}>{addr.icon}</Text>
                  </View>
                  <View style={s.addrInfo}>
                    <Text style={[s.addrLabel, selected === addr.id && s.addrLabelSelected]}>
                      {addr.label}
                    </Text>
                    <Text style={s.addrFull} numberOfLines={2}>{addr.full}</Text>
                  </View>
                </View>
                <View style={[s.radioOuter, selected === addr.id && s.radioOuterSelected]}>
                  {selected === addr.id && <View style={s.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Add New Address */}
        <TouchableOpacity style={s.addNewBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Text style={s.addNewIcon}>＋</Text>
          <Text style={s.addNewText}>Add a new address</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Confirm Button */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.confirmBtn, !selected && s.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={s.confirmBtnText}>Deliver Here  →</Text>
        </TouchableOpacity>
      </View>

      {/* Add Address Modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBackdrop} onPress={() => setShowAdd(false)} activeOpacity={1} />
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Add New Address</Text>

            <Text style={s.inputLabel}>ADDRESS TYPE</Text>
            <View style={s.typeRow}>
              {["Home", "Work", "Other"].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeBtn, newLabel === t && s.typeBtnActive]}
                  onPress={() => setNewLabel(t)}
                >
                  <Text style={[s.typeBtnText, newLabel === t && s.typeBtnTextActive]}>
                    {t === "Home" ? "🏠 " : t === "Work" ? "🏢 " : "📍 "}{t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.inputLabel}>FULL ADDRESS</Text>
            <TextInput
              style={s.textArea}
              placeholder="House/Flat no., Street, Area, City"
              placeholderTextColor="#ccc"
              value={newFull}
              onChangeText={setNewFull}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[s.confirmBtn, !newFull.trim() && s.confirmBtnDisabled]}
              onPress={handleAddAddress}
              disabled={!newFull.trim()}
              activeOpacity={0.85}
            >
              <Text style={s.confirmBtnText}>Save Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F8" },
  header: { backgroundColor: "#0C831F", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4 },
  headerSub: { fontSize: 13, color: "#C8F5D0" },
  body: { flex: 1 },
  infoBanner: { backgroundColor: "#E8F5E9", margin: 14, borderRadius: 12, padding: 12 },
  infoBannerText: { color: "#0C831F", fontWeight: "600", fontSize: 13, textAlign: "center" },
  section: { paddingHorizontal: 14, marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#999", letterSpacing: 0.8, marginBottom: 12, marginTop: 4 },
  addrCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: "#F0F0F0", elevation: 1 },
  addrCardSelected: { borderColor: "#0C831F", backgroundColor: "#F6FFF7" },
  addrLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  addrIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center", marginRight: 12 },
  addrIconBoxSelected: { backgroundColor: "#E8F5E9" },
  addrIcon: { fontSize: 20 },
  addrInfo: { flex: 1 },
  addrLabel: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 3 },
  addrLabelSelected: { color: "#0C831F" },
  addrFull: { fontSize: 12, color: "#888", lineHeight: 17 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#ccc", alignItems: "center", justifyContent: "center", marginLeft: 10 },
  radioOuterSelected: { borderColor: "#0C831F" },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#0C831F" },
  addNewBtn: { flexDirection: "row", alignItems: "center", marginHorizontal: 14, marginTop: 6, backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: "#0C831F", borderStyle: "dashed" },
  addNewIcon: { fontSize: 20, color: "#0C831F", marginRight: 10, fontWeight: "700" },
  addNewText: { fontSize: 15, color: "#0C831F", fontWeight: "700" },
  footer: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F0F0F0", elevation: 8 },
  confirmBtn: { backgroundColor: "#0C831F", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  confirmBtnDisabled: { backgroundColor: "#A5D6A7" },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A1A", marginBottom: 20 },
  inputLabel: { fontSize: 11, fontWeight: "700", color: "#999", letterSpacing: 0.8, marginBottom: 10 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E5E5", alignItems: "center" },
  typeBtnActive: { borderColor: "#0C831F", backgroundColor: "#E8F5E9" },
  typeBtnText: { fontSize: 13, fontWeight: "600", color: "#555" },
  typeBtnTextActive: { color: "#0C831F" },
  textArea: { borderWidth: 1.5, borderColor: "#E5E5E5", borderRadius: 12, padding: 14, fontSize: 14, color: "#1A1A1A", minHeight: 80, textAlignVertical: "top", marginBottom: 20 },
});