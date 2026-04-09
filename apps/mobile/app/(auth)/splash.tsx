import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ImageBackground, StatusBar, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { apiJsonWithAuth } from "../lib/api";
import { hrefOnboarding, hrefProfileSetup, hrefTabs } from "../lib/paths";
import { pastoralSplashBg } from "../lib/pastoralAssets";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const pulse = useSharedValue(1);

  useEffect(() => {
    let alive = true;
    void Promise.resolve(useAuthStore.persist.rehydrate()).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1,
      false
    );
  }, [pulse]);

  useEffect(() => {
    StatusBar.setBarStyle("light-content");
    return () => {
      StatusBar.setBarStyle("dark-content");
    };
  }, []);

  const brandStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const navigate = () => {
      if (cancelled) return;
      const { accessToken, profileComplete } = useAuthStore.getState();
      if (accessToken && profileComplete) router.replace(hrefTabs);
      else if (accessToken && !profileComplete) router.replace(hrefProfileSetup);
      else router.replace(hrefOnboarding);
    };

    void (async () => {
      const { accessToken } = useAuthStore.getState();
      if (accessToken) {
        const deadline = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 2500));
        try {
          const me = await Promise.race([
            apiJsonWithAuth<{ persisted?: boolean; fullName?: string }>("/api/v1/users/me"),
            deadline
          ]);
          if (!cancelled && me?.persisted) {
            const fn = me.fullName?.trim() ?? "";
            if (fn.length >= 2 && fn !== "Üye") {
              useAuthStore.getState().setProfileComplete(true);
            } else {
              useAuthStore.getState().setProfileComplete(false);
            }
          }
        } catch {
          /* ağ veya zaman aşımı: yerel profileComplete korunur */
        }
      }
      if (!cancelled) setTimeout(navigate, 520);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return (
    <ImageBackground source={pastoralSplashBg} style={{ flex: 1 }} resizeMode="cover">
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: U.space(2.5),
          justifyContent: "space-between",
          backgroundColor: "rgba(26, 43, 72, 0.72)"
        }}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={[T.overline, { color: U.onPrimaryMuted, letterSpacing: 4, marginBottom: U.space(1.5) }]}>
            THE PASTORAL
          </Text>
          <Animated.Text
            style={[
              {
                color: U.surface,
                fontSize: 36,
                fontWeight: "800",
                letterSpacing: -0.5,
                textAlign: "center"
              },
              brandStyle
            ]}
          >
            Pastoral
          </Animated.Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.88)",
              marginTop: U.space(1.5),
              fontSize: 16,
              lineHeight: 24,
              textAlign: "center",
              maxWidth: 300,
              fontWeight: "500"
            }}
          >
            Türkiye’nin tarım ve hayvancılık pazaryeri. Güvenli alım satım, tek dokunuşta iletişim.
          </Text>
          <View
            style={{
              marginTop: U.space(4),
              height: 4,
              width: 56,
              borderRadius: 2,
              backgroundColor: U.limeCta,
              opacity: 0.95
            }}
          />
        </View>

        <View style={{ alignItems: "center", paddingBottom: U.space(2) }}>
          <ActivityIndicator color={U.limeCta} size="large" />
          <Text style={[T.caption, { color: U.onPrimaryMuted, marginTop: U.space(1.5) }]}>Hazırlanıyor…</Text>
        </View>
      </View>
    </ImageBackground>
  );
}
