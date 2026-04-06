import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableWithoutFeedback, Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);

  // ─── If user already completed profile, skip this screen ──────────────────
  // (happens when existing user logs in again)
  // Check is done in _layout.tsx RouteGuard too, but this is a safety net

  const isReturningUser = !!(user?.name && user?.name.trim().length > 0);

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter your name to continue.");
      return;
    }
    if (email && !isValidEmail(email)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      // Save name + email to MongoDB via PATCH /users/{id}/profile
      await updateUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });
      // Go to address picker next
      router.replace("/address");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to save profile.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow skipping email — name is required, email is optional
    router.replace("/address");
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar backgroundColor="#0C831F" barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* Header */}
            <View style={s.header}>
              <View style={s.avatarBox}>
                <Text style={s.avatarEmoji}>
                  {name ? name[0].toUpperCase() : "👤"}
                </Text>
              </View>
              <Text style={s.headerTitle}>
                {isReturningUser ? "Update Profile" : "Complete your profile"}
              </Text>
              <Text style={s.headerSub}>
                {isReturningUser
                  ? "Edit your details below"
                  : "Just a few details and you're all set!"}
              </Text>
            </View>

            {/* Form */}
            <View style={s.form}>

              {/* Phone — read only */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>MOBILE NUMBER</Text>
                <View style={[s.inputBox, s.inputBoxDisabled]}>
                  <Text style={s.inputIcon}>📱</Text>
                  <Text style={s.disabledText}>+91 {user?.phone}</Text>
                  <View style={s.verifiedBadge}>
                    <Text style={s.verifiedText}>✓ Verified</Text>
                  </View>
                </View>
              </View>

              {/* Full Name — required */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>
                  FULL NAME <Text style={s.required}>*</Text>
                </Text>
                <View style={[s.inputBox, name.trim() && s.inputBoxActive]}>
                  <Text style={s.inputIcon}>👤</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Enter your full name"
                    placeholderTextColor="#bbb"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Email — optional */}
              <View style={s.fieldGroup}>
                <View style={s.labelRow}>
                  <Text style={s.fieldLabel}>EMAIL ADDRESS</Text>
                  <Text style={s.optionalTag}>Optional</Text>
                </View>
                <View style={[s.inputBox, email.trim() && s.inputBoxActive]}>
                  <Text style={s.inputIcon}>✉️</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#bbb"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleContinue}
                    editable={!loading}
                  />
                </View>
                <Text style={s.fieldHint}>
                  We'll send order updates and offers to this email
                </Text>
              </View>

              {/* What we use this for */}
              <View style={s.infoCard}>
                <Text style={s.infoTitle}>Why we need this</Text>
                <View style={s.infoRow}>
                  <Text style={s.infoDot}>•</Text>
                  <Text style={s.infoText}>Your name appears on delivery receipts</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoDot}>•</Text>
                  <Text style={s.infoText}>Email is used for order confirmations</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoDot}>•</Text>
                  <Text style={s.infoText}>We never share your data with third parties</Text>
                </View>
              </View>

              {/* Continue button */}
              <TouchableOpacity
                style={[s.ctaBtn, (!name.trim() || loading) && s.ctaDisabled]}
                onPress={handleContinue}
                disabled={!name.trim() || loading}
                activeOpacity={0.85}
              >
                <Text style={s.ctaText}>
                  {loading ? "Saving..." : "Continue →"}
                </Text>
              </TouchableOpacity>

              {/* Skip (only show if email not filled, name is required) */}
              {!isReturningUser && (
                <TouchableOpacity style={s.skipBtn} onPress={handleSkip} disabled={loading}>
                  <Text style={s.skipText}>Skip for now</Text>
                </TouchableOpacity>
              )}

            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#F8F8F8" },
  scroll:           { flexGrow: 1 },

  // Header
  header:           { backgroundColor: "#0C831F", paddingTop: 30, paddingBottom: 36, alignItems: "center", paddingHorizontal: 24 },
  avatarBox:        { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 2.5, borderColor: "rgba(255,255,255,0.5)" },
  avatarEmoji:      { fontSize: 34, color: "#fff", fontWeight: "800" },
  headerTitle:      { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 6 },
  headerSub:        { fontSize: 13, color: "#C8F5D0", textAlign: "center", lineHeight: 19 },

  // Form
  form:             { padding: 20 },
  fieldGroup:       { marginBottom: 20 },
  fieldLabel:       { fontSize: 11, fontWeight: "700", color: "#888", letterSpacing: 0.8, marginBottom: 8 },
  required:         { color: "#E53935" },
  labelRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  optionalTag:      { fontSize: 11, color: "#aaa", fontWeight: "600", backgroundColor: "#F0F0F0", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },

  // Input boxes
  inputBox:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E5E5E5", borderRadius: 12, paddingHorizontal: 14, height: 54 },
  inputBoxActive:   { borderColor: "#0C831F" },
  inputBoxDisabled: { backgroundColor: "#F9F9F9" },
  inputIcon:        { fontSize: 18, marginRight: 10 },
  input:            { flex: 1, fontSize: 16, color: "#1A1A1A", fontWeight: "500" },
  disabledText:     { flex: 1, fontSize: 16, color: "#555", fontWeight: "600" },
  fieldHint:        { fontSize: 11, color: "#aaa", marginTop: 6, marginLeft: 2 },

  // Verified badge
  verifiedBadge:    { backgroundColor: "#E8F5E9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText:     { color: "#0C831F", fontSize: 11, fontWeight: "700" },

  // Info card
  infoCard:         { backgroundColor: "#F0FFF4", borderRadius: 12, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: "#C8F5D0" },
  infoTitle:        { fontSize: 13, fontWeight: "700", color: "#0C831F", marginBottom: 10 },
  infoRow:          { flexDirection: "row", marginBottom: 6 },
  infoDot:          { color: "#0C831F", marginRight: 8, fontWeight: "700" },
  infoText:         { fontSize: 12, color: "#555", flex: 1, lineHeight: 18 },

  // Buttons
  ctaBtn:           { backgroundColor: "#0C831F", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  ctaDisabled:      { backgroundColor: "#A5D6A7" },
  ctaText:          { color: "#fff", fontSize: 16, fontWeight: "800" },
  skipBtn:          { alignItems: "center", paddingVertical: 10 },
  skipText:         { color: "#aaa", fontSize: 14, fontWeight: "500" },
});