import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { maskPhone } from "@agromarket/shared-utils";
import { apiJson, getUserServiceBase, newRequestId } from "../lib/api";
import { hrefAuthOtp, hrefTabs } from "../lib/paths";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

type SendOtpResponse = { success: boolean; message: string; expiresInSeconds?: number; debugOtp?: string };
const authServiceBase = getUserServiceBase();

async function postSendOtp(phoneNumber: string): Promise<SendOtpResponse> {
  try {
    return await apiJson<SendOtpResponse>("/api/v1/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phoneNumber })
    });
  } catch {
    const res = await fetch(`${authServiceBase}/api/v1/auth/send-otp`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-request-id": newRequestId()
      },
      body: JSON.stringify({ phoneNumber })
    });
    if (!res.ok) throw new Error("OTP servisine erişilemedi");
    return (await res.json()) as SendOtpResponse;
  }
}

export default function PhoneInputScreen() {
  const insets = useSafeAreaInsets();
  const setPhone = useAuthStore((s) => s.setPhone);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUserId = useAuthStore((s) => s.setUserId);
  const setProfileComplete = useAuthStore((s) => s.setProfileComplete);
  const [phone, setPhoneLocal] = useState("+90");
  const [loading, setLoading] = useState(false);
  const normalizedPhone = phone.trim();
  const isValidPhone = /^\+[1-9]\d{7,14}$/.test(normalizedPhone);

  const send = async () => {
    if (loading) return;
    if (!isValidPhone) {
      Toast.show({ type: "error", text1: "Geçersiz numara", text2: "E.164 formatında girin (+90...)" });
      return;
    }
    setLoading(true);
    try {
      const response = await postSendOtp(normalizedPhone);
      setPhone(normalizedPhone);
      Toast.show({
        type: "success",
        text1: "Kod gönderildi",
        text2: response.debugOtp ? `Geliştirme kodu: ${response.debugOtp}` : undefined
      });
      router.push(hrefAuthOtp(normalizedPhone));
    } catch (e) {
      Toast.show({ type: "error", text1: "Gönderilemedi", text2: e instanceof Error ? e.message : "Hata" });
    } finally {
      setLoading(false);
    }
  };

  const continueAsDev = () => {
    const phoneForDev = isValidPhone ? normalizedPhone : "+905551234567";
    setPhone(phoneForDev);
    setTokens("dev-access-token", "dev-refresh-token");
    setUserId(phoneForDev);
    setProfileComplete(true);
    appendDemoLog("Giris", `Dev atlama (telefon) — ${maskPhone(phoneForDev)}`);
    Toast.show({ type: "success", text1: "Geliştirici oturumu açıldı" });
    router.replace(hrefTabs);
  };

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
        <Text style={T.display}>Telefon numaranız</Text>
        <Text style={[T.caption, { marginTop: U.space(1) }]}>Size SMS ile doğrulama kodu göndereceğiz.</Text>
        <TextInput
          testID="e2e-phone-input"
          value={phone}
          onChangeText={setPhoneLocal}
          keyboardType="phone-pad"
          autoComplete="tel"
          returnKeyType="done"
          editable={!loading}
          autoCorrect={false}
          maxLength={16}
          onSubmitEditing={() => void send()}
          placeholder="+905551234567"
          placeholderTextColor={U.textMuted}
          style={{
            marginTop: U.space(3),
            borderWidth: 0,
            borderRadius: U.radiusLg,
            paddingHorizontal: U.space(2),
            paddingVertical: U.space(1.75),
            fontSize: 18,
            color: U.text,
            backgroundColor: U.surfaceContainerHigh
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="SMS doğrulama kodu gönder"
          onPress={() => void send()}
          disabled={loading || !isValidPhone}
          style={{
            marginTop: U.space(3),
            backgroundColor: loading || !isValidPhone ? U.textMuted : U.primary,
            paddingVertical: U.space(2),
            borderRadius: 999,
            alignItems: "center"
          }}
        >
          <Text style={[T.body, { color: U.onPrimary, fontWeight: "700" }]}>{loading ? "Gönderiliyor..." : "Kod gönder"}</Text>
        </Pressable>
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geliştirici olarak giriş yap"
            onPress={continueAsDev}
            style={{
              marginTop: U.space(1.5),
              borderWidth: 0,
              backgroundColor: U.secondaryContainer,
              paddingVertical: U.space(1.75),
              borderRadius: 999,
              alignItems: "center"
            }}
          >
            <Text style={[T.body, { color: U.onSecondaryContainer, fontWeight: "700" }]}>Geliştirici olarak devam et</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
