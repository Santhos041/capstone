import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, Animated
} from "react-native";
import * as Notifications from "expo-notifications";

export default function NotificationBanner() {
  const [visible, setVisible]         = useState(false);
  const [notifData, setNotifData]     = useState<any>(null);
  const slideAnim                     = new Animated.Value(-100);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(n => {
      setNotifData(n.request.content);
      showBanner();
    });
    return () => Notifications.removeNotificationSubscription(sub);
  }, []);

  const showBanner = () => {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();

    // Auto hide after 4 seconds
    setTimeout(() => hideBanner(), 4000);
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  if (!visible || !notifData) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{notifData.title}</Text>
        <Text style={styles.body}  numberOfLines={2}>{notifData.body}</Text>
      </View>
      <TouchableOpacity onPress={hideBanner} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    zIndex:          999,
    backgroundColor: "#0C831F",
    flexDirection:   "row",
    alignItems:      "center",
    paddingHorizontal: 16,
    paddingVertical:   14,
    paddingTop:        50,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.25,
    shadowRadius:    4,
    elevation:       10,
  },
  content: { flex: 1 },
  title:   { color: "#fff", fontWeight: "800", fontSize: 14, marginBottom: 2 },
  body:    { color: "#C8F5D0", fontSize: 12 },
  close:   { padding: 6 },
  closeText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});