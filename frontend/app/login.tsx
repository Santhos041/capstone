import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length !== 10) return;
    setLoading(true);

    // ── In production: call your SMS OTP API here ──────────────────────────
    // e.g. await api.post("/auth/send-otp", { phone })
    // For now we just simulate a short delay
    // ───────────────────────────────────────────────────────────────────────

    try {
      await new Promise((res) => setTimeout(res, 800)); // simulated delay
      // Pass phone to OTP screen via query param
      router.push({ pathname: "/otp", params: { phone } });
    } catch (e) {
      Alert.alert("Error", "Could not send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={s.logoArea}>
            <View style={s.logoBox}>
              <Text style={s.logoEmoji}>⚡</Text>
            </View>
            <Text style={s.logoTitle}>blinkit</Text>
            <Text style={s.logoSub}>Grocery in 10 minutes</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Login</Text>
            <Text style={s.cardSub}>
              Enter your mobile number to get an OTP
            </Text>

            <Text style={s.label}>MOBILE NUMBER</Text>
            <View style={s.phoneRow}>
              <View style={s.countryCode}>
                <Text style={s.countryText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={s.phoneInput}
                placeholder="10-digit number"
                placeholderTextColor="#bbb"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[s.ctaBtn, (phone.length !== 10 || loading) && s.ctaDisabled]}
              onPress={handleSendOtp}
              disabled={phone.length !== 10 || loading}
              activeOpacity={0.85}
            >
              <Text style={s.ctaText}>
                {loading ? "Sending OTP..." : "Send OTP →"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={s.terms}>
            By continuing, you agree to our{" "}
            <Text style={s.termsLink}>Terms of Service</Text>
            {" & "}
            <Text style={s.termsLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F6FFF7" },
  scroll:      { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  logoArea:    { alignItems: "center", marginBottom: 40 },
  logoBox:     { width: 76, height: 76, backgroundColor: "#0C831F", borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 14, elevation: 8, shadowColor: "#0C831F", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
  logoEmoji:   { fontSize: 38 },
  logoTitle:   { fontSize: 36, fontWeight: "900", color: "#0C831F", letterSpacing: -1 },
  logoSub:     { fontSize: 14, color: "#888", marginTop: 4 },
  card:        { backgroundColor: "#fff", borderRadius: 20, padding: 24, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, marginBottom: 24 },
  cardTitle:   { fontSize: 24, fontWeight: "800", color: "#1A1A1A", marginBottom: 6 },
  cardSub:     { fontSize: 13, color: "#888", marginBottom: 24, lineHeight: 18 },
  label:       { fontSize: 11, fontWeight: "700", color: "#999", marginBottom: 8, letterSpacing: 0.8 },
  phoneRow:    { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E5E5", borderRadius: 12, overflow: "hidden", marginBottom: 20 },
  countryCode: { backgroundColor: "#F5F5F5", paddingHorizontal: 14, paddingVertical: 15, borderRightWidth: 1.5, borderRightColor: "#E5E5E5" },
  countryText: { fontSize: 14, fontWeight: "600", color: "#333" },
  phoneInput:  { flex: 1, fontSize: 17, color: "#1A1A1A", paddingHorizontal: 14, paddingVertical: 15, fontWeight: "600" },
  ctaBtn:      { backgroundColor: "#0C831F", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  ctaDisabled: { backgroundColor: "#A5D6A7" },
  ctaText:     { color: "#fff", fontSize: 16, fontWeight: "800" },
  terms:       { textAlign: "center", fontSize: 12, color: "#bbb", lineHeight: 18 },
  termsLink:   { color: "#0C831F", fontWeight: "600" },
});