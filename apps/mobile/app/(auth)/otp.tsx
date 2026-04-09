import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { maskPhone } from "@agromarket/shared-utils";
import { apiJson, getUserServiceBase, newRequestId } from "../lib/api";
import { hrefProfileSetup, hrefTabs } from "../lib/paths";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

type VerifyResponse = { accessToken: string; refreshToken: string; tokenType: string };
const authServiceBase = getUserServiceBase();

async function postVerifyOtp(phoneNumber: string, otp: string): Promise<VerifyResponse> {
  try {
    return await apiJson<VerifyResponse>("/api/v1/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phoneNumber, otp })
    });
  } catch {
    const res = await fetch(`${authServiceBase}/api/v1/auth/verify-otp`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-request-id": newRequestId()
      },
      body: JSON.stringify({ phoneNumber, otp })
    });
    if (!res.ok) throw new Error("OTP doğrulama servisine erişilemedi");
    return (await res.json()) as VerifyResponse;
  }
}

export default function OTPVerifyScreen() {
  const insets = useSafeAreaInsets();
  const { phone: phoneParam } = useLocalSearchParams<{ phone: string }>();
  const phone =
    typeof phoneParam === "string" ? phoneParam : Array.isArray(phoneParam) ? phoneParam[0] ?? "" : "";
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUserId = useAuthStore((s) => s.setUserId);
  const setProfileComplete = useAuthStore((s) => s.setProfileComplete);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const normalizedOtp = otp.replace(/\D/g, "").slice(0, 6);
  const canVerify = phone.trim().length > 0 && normalizedOtp.length === 6;

  const verify = async () => {
    if (loading) return;
    if (!canVerify) {
      Toast.show({ type: "error", text1: "6 haneli kodu girin" });
      return;
    }
    setLoading(true);
    try {
      // Non-prod API ile dogrulama: 123456; tamamen cevrimdisi atlama (__DEV__): 999999
      if (__DEV__ && normalizedOtp === "999999") {
        setTokens("dev-access-token", "dev-refresh-token");
        setUserId(phone.trim());
        setProfileComplete(true);
        appendDemoLog("Giris", `Dev OTP 999999 — ${maskPhone(phone.trim())}`);
        Toast.show({ type: "success", text1: "Geliştirici girişi aktif" });
        router.replace(hrefTabs);
        return;
      }
      const res = await postVerifyOtp(phone.trim(), normalizedOtp);
      setTokens(res.accessToken, res.refreshToken);
      setUserId(phone);
      appendDemoLog("Giris", `OTP dogrulandi — ${maskPhone(phone.trim())}`);
      Toast.show({ type: "success", text1: "Giriş başarılı" });
      router.replace(hrefProfileSetup);
    } catch (e) {
      Toast.show({ type: "error", text1: "Doğrulama başarısız", text2: e instanceof Error ? e.message : "Hata" });
    } finally {
      setLoading(false);
    }
  };

  if (!phone) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { textAlign: "center", color: U.textSecondary }]}>
          Oturum bilgisi eksik. Önce telefon adımına dönün.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: U.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + U.space(3),
          paddingHorizontal: U.space(3),
          paddingBottom: insets.bottom + U.space(3),
          flexGrow: 1
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={T.display}>SMS kodu</Text>
        <Text style={[T.caption, { marginTop: U.space(1) }]}>{phone}</Text>
        {__DEV__ ? (
          <Text style={[T.caption, { marginTop: U.space(0.75), fontSize: 12 }]}>
            Yerel atlama (API yok): 999999. Sunucu dev/staging sabit OTP: 123456
          </Text>
        ) : null}
        <TextInput
          testID="e2e-otp-input"
          value={otp}
          onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          editable={!loading}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          returnKeyType="done"
          onSubmitEditing={() => void verify()}
          placeholder="••••••"
          placeholderTextColor={U.textMuted}
          style={{
            marginTop: U.space(3),
            borderWidth: 0,
            borderRadius: U.radiusLg,
            paddingHorizontal: U.space(2),
            paddingVertical: U.space(1.75),
            fontSize: 24,
            letterSpacing: U.space(1),
            textAlign: "center",
            color: U.text,
            backgroundColor: U.surfaceContainerHigh
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="SMS kodunu doğrula ve devam et"
          onPress={() => void verify()}
          disabled={loading || !canVerify}
          style={{
            marginTop: U.space(3),
            backgroundColor: loading || !canVerify ? U.textMuted : U.primary,
            paddingVertical: U.space(2),
            borderRadius: 999,
            alignItems: "center"
          }}
        >
          <Text style={[T.body, { color: U.onPrimary, fontWeight: "700" }]}>{loading ? "Kontrol..." : "Devam et"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
