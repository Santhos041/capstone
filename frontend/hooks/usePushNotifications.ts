import { useState, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import api from "../services/api";

// How notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export function usePushNotifications(userId: string | undefined) {
  const [expoPushToken, setExpoPushToken] = useState<string>("");
  const [notification, setNotification]   = useState<any>(null);
  const notificationListener = useRef<any>();
  const responseListener     = useRef<any>();

  useEffect(() => {
    if (!userId) return;
    registerForPushNotifications(userId);

    // Fires when notification is received while app is open
    notificationListener.current =
      Notifications.addNotificationReceivedListener(n => {
        setNotification(n);
        console.log("📬 Notification received:", n.request.content);
      });

    // Fires when user taps the notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        console.log("👆 Notification tapped:", data);
        // You can navigate to product screen here later
      });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [userId]);

  const registerForPushNotifications = async (userId: string) => {
    if (!Device.isDevice) {
      console.log("Push notifications only work on physical devices");
      return;
    }

    // Ask permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission denied");
      return;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "your-expo-project-id", // from app.json → expo.extra.eas.projectId
    });

    const token = tokenData.data;
    setExpoPushToken(token);
    console.log("📱 Expo push token:", token);

    // Save token to backend
    try {
      await api.patch(`/users/${userId}/push-token`, { token });
      console.log("✅ Push token saved to backend");
    } catch (e) {
      console.log("❌ Failed to save push token:", e);
    }

    // Android needs a notification channel
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name:       "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0C831F",
      });
    }
  };

  return { expoPushToken, notification };
}