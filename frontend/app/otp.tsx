import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Alert, KeyboardAvoidingView,
  Platform, NativeSyntheticEvent, TextInputKeyPressEventData,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../context/AuthContext";

// Fixed OTP for demo — any 6-digit entry works
// Replace with real SMS OTP verification when you have an SMS provider
const DEMO_OTP = "123456";

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { login } = useAuth();

  // 6 individual OTP boxes
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
 const inputRefs = useRef<Array<TextInput | null>>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendTimer((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Auto-focus first box on mount
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  // ─── Handle digit entry ──────────────────────────────────────────────────

  const handleChange = (val: string, idx: number) => {
    // Only accept digits
    if (!/^\d*$/.test(val)) return;

    const updated = [...otp];
    updated[idx] = val.slice(-1); // take only last char (handles paste)
    setOtp(updated);

    // Auto-advance to next box
    if (val && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (idx === 5 && val) {
      const full = updated.join("");
      if (full.length === 6) verifyOtp(full);
    }
  };

  // ─── Handle backspace ────────────────────────────────────────────────────

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    idx: number
  ) => {
    if (e.nativeEvent.key === "Backspace" && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  // ─── Verify OTP ──────────────────────────────────────────────────────────
const verifyOtp = async (code?: string) => {
  const entered = code ?? otp.join("");
  if (entered.length < 6) return;

  if (entered !== "123456") {
    Alert.alert("Invalid OTP");
    return;
  }

  if (!phone) {
    Alert.alert("Phone missing");
    return;
  }

  setLoading(true);

  try {
    await login(phone);
    router.replace("/(tabs)");
  } catch (err) {
    Alert.alert("Login failed");
  } finally {
    setLoading(false);
  }
};
  const handleResend = () => {
    setOtp(["", "", "", "", "", ""]);
    setResendTimer(30);
    setCanResend(false);
    inputRefs.current[0]?.focus();
    // In production: re-call your SMS API here
  };

  const otpFilled = otp.every((d) => d !== "");

  return (
    <SafeAreaView style={s.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.inner}>

          {/* Back */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={s.logoArea}>
            <View style={s.logoBox}>
              <Text style={s.logoEmoji}>⚡</Text>
            </View>
            <Text style={s.logoTitle}>blinkit</Text>
          </View>

          <Text style={s.title}>Verify your number</Text>
          <Text style={s.sub}>
            Enter the 6-digit OTP sent to{"\n"}
            <Text style={s.phone}>+91 {phone}</Text>
          </Text>

          {/* 6 OTP Boxes */}
          <View style={s.otpRow}>
  {otp.map((digit, idx) => (
    <TextInput
      key={idx}
      ref={(ref: TextInput | null) => {
        inputRefs.current[idx] = ref;
      }}
      style={[s.otpBox, digit && s.otpBoxFilled]}
      value={digit}
      onChangeText={(val) => handleChange(val, idx)}
      onKeyPress={(e) => handleKeyPress(e, idx)}
      keyboardType="number-pad"
      maxLength={1}
      selectTextOnFocus
      editable={!loading}
    />
  ))}
</View>

          {/* Demo hint */}
          <View style={s.demoHint}>
            <Text style={s.demoText}>
              💡 Demo mode — enter any 6 digits
            </Text>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[s.ctaBtn, (!otpFilled || loading) && s.ctaDisabled]}
            onPress={() => verifyOtp()}
            disabled={!otpFilled || loading}
            activeOpacity={0.85}
          >
            <Text style={s.ctaText}>
              {loading ? "Verifying..." : "Verify & Continue →"}
            </Text>
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity
            style={s.resendBtn}
            onPress={handleResend}
            disabled={!canResend}
          >
            {canResend ? (
              <Text style={s.resendActive}>Resend OTP</Text>
            ) : (
              <Text style={s.resendWait}>
                Resend OTP in{" "}
                <Text style={s.resendCountdown}>{resendTimer}s</Text>
              </Text>
            )}
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#fff" },
  inner:           { flex: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32 },
  backBtn:         { marginBottom: 20 },
  backText:        { fontSize: 15, color: "#0C831F", fontWeight: "600" },
  logoArea:        { alignItems: "center", marginBottom: 28 },
  logoBox:         { width: 64, height: 64, backgroundColor: "#0C831F", borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 10, elevation: 6, shadowColor: "#0C831F", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  logoEmoji:       { fontSize: 30 },
  logoTitle:       { fontSize: 28, fontWeight: "900", color: "#0C831F", letterSpacing: -0.5 },
  title:           { fontSize: 24, fontWeight: "800", color: "#1A1A1A", marginBottom: 10 },
  sub:             { fontSize: 14, color: "#888", marginBottom: 32, lineHeight: 22 },
  phone:           { color: "#0C831F", fontWeight: "700" },
  otpRow:          { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  otpBox:          { width: 48, height: 56, borderWidth: 1.5, borderColor: "#E0E0E0", borderRadius: 12, fontSize: 22, fontWeight: "800", color: "#1A1A1A", textAlign: "center", backgroundColor: "#F9F9F9" },
  otpBoxFilled:    { borderColor: "#0C831F", backgroundColor: "#F0FFF4" },
  demoHint:        { backgroundColor: "#FFF8E1", borderRadius: 10, padding: 10, marginBottom: 24, alignItems: "center" },
  demoText:        { fontSize: 12, color: "#F57C00", fontWeight: "600" },
  ctaBtn:          { backgroundColor: "#0C831F", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 16 },
  ctaDisabled:     { backgroundColor: "#A5D6A7" },
  ctaText:         { color: "#fff", fontSize: 16, fontWeight: "800" },
  resendBtn:       { alignItems: "center", paddingVertical: 10 },
  resendActive:    { color: "#0C831F", fontWeight: "700", fontSize: 14 },
  resendWait:      { fontSize: 13, color: "#aaa" },
  resendCountdown: { color: "#0C831F", fontWeight: "700" },
});