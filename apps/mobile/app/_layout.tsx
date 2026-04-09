import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useLastNotificationResponse } from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { apiJsonWithAuth } from "./lib/api";
import { stackHeaderTheme } from "./lib/navigation";
import { pastoralToastConfig } from "./lib/toastConfig";
import { useAuthStore } from "./store/auth";
import { U } from "./theme/tokens";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

/*** Bildirim payload: listingId / conversationId ile ilgili ekrana gider. */
function NotificationDeepLinkHandler() {
  const router = useRouter();
  const lastResponse = useLastNotificationResponse();
  const lastNavAt = useRef(0);

  const openFromNotification = useCallback(
    (notification: Notifications.Notification) => {
      const now = Date.now();
      if (now - lastNavAt.current < 600) return;
      const data = notification.request.content.data as Record<string, unknown>;
      const listingId = typeof data?.listingId === "string" && data.listingId.trim() ? data.listingId.trim() : null;
      const conversationId =
        typeof data?.conversationId === "string" && data.conversationId.trim() ? data.conversationId.trim() : null;
      if (listingId) {
        lastNavAt.current = now;
        router.push(`/listing/${listingId}`);
        return;
      }
      if (conversationId) {
        lastNavAt.current = now;
        router.push(`/conversation/${conversationId}`);
      }
    },
    [router]
  );

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    openFromNotification(lastResponse.notification);
  }, [lastResponse, openFromNotification]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotification(response.notification);
    });
    return () => sub.remove();
  }, [openFromNotification]);

  return null;
}

function RootToast() {
  const insets = useSafeAreaInsets();
  return (
    <Toast
      config={pastoralToastConfig}
      position="top"
      topOffset={insets.top + 10}
      visibilityTime={2800}
    />
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 60_000, gcTime: 10 * 60_000 },
    mutations: { retry: 0 }
  }
});

const stackDetailHeader = { ...stackHeaderTheme, headerShown: true as const };

function PushRegistrationEffect() {
  const { accessToken, userId } = useAuthStore();
  useEffect(() => {
    const run = async () => {
      try {
        if (!accessToken || !userId) return;
        const perm = await Notifications.getPermissionsAsync();
        let finalStatus = perm.status;
        if (finalStatus !== "granted") {
          const req = await Notifications.requestPermissionsAsync();
          finalStatus = req.status;
        }
        if (finalStatus !== "granted") return;
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        if (!projectId) return;
        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!token.data) return;
        await apiJsonWithAuth("/api/v1/notifications/register-token", {
          method: "POST",
          body: JSON.stringify({ user_id: userId, expo_push_token: token.data })
        });
      } catch {
        // Push kaydi kritik degil; hatada uygulama akisina devam eder.
      }
    };
    void run();
  }, [accessToken, userId]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: U.bg }}>
      <StatusBar style="dark" backgroundColor={U.bg} />
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PushRegistrationEffect />
          <NotificationDeepLinkHandler />
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="listing/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="conversation/[id]" options={{ ...stackDetailHeader, title: "Mesajlar" }} />
            <Stack.Screen name="user/[userId]" options={{ ...stackDetailHeader, title: "Kullanıcı" }} />
            <Stack.Screen name="offer/[listingId]" options={{ ...stackDetailHeader, title: "Teklif" }} />
            <Stack.Screen name="offers" options={{ ...stackDetailHeader, title: "Tekliflerim" }} />
            <Stack.Screen name="review/[userId]" options={{ ...stackDetailHeader, title: "Değerlendirme" }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
          <RootToast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
