import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../components/ui/AppButton";
import { apiJsonWithAuth } from "../lib/api";
import { loadBusinessProfileDraft } from "../lib/businessProfileDraft";
import { isMockDataEnabled } from "../lib/mockData";
import { hrefSettingsBusinessProfile } from "../lib/paths";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

type MeResponse = {
  persisted: boolean;
  fullName?: string;
  bio?: string;
};

const fieldBase = {
  marginTop: U.space(1.5),
  borderWidth: 0,
  borderRadius: U.radius,
  paddingHorizontal: U.space(2),
  paddingVertical: U.space(1.5),
  fontSize: 16,
  color: U.text,
  backgroundColor: U.surfaceContainerHigh
} as const;

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken, userId } = useAuthStore();
  const mockEditable = isMockDataEnabled() && !accessToken;
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [businessSummary, setBusinessSummary] = useState("Henüz işletme profili yok");

  const q = useQuery({
    queryKey: ["users", "me", userId],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<MeResponse>("/api/v1/users/me")
  });

  useEffect(() => {
    if (q.data?.persisted) {
      setFullName(q.data.fullName ?? "");
      setBio(q.data.bio ?? "");
    }
    if (mockEditable && !q.data?.persisted) {
      setFullName((prev) => prev || "Ahmet Ciftci");
      setBio((prev) => prev || "Konya Selcuklu bolgesinde traktor ve tohum ticareti yapiyorum.");
    }
  }, [q.data?.persisted, q.data?.fullName, q.data?.bio, mockEditable]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const draft = await loadBusinessProfileDraft(userId);
      if (!mounted || !draft) return;
      const typeLabel = draft.providerKind === "services" ? "Hizmet" : "Mal";
      const location = [draft.city, draft.district].filter(Boolean).join(" / ");
      setBusinessSummary(
        [draft.businessName || "Isletme", `${typeLabel} saglayici`, location].filter(Boolean).join(" · ")
      );
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const save = useMutation({
    mutationFn: () => {
      if (mockEditable) return Promise.resolve({ persisted: true } as MeResponse);
      return apiJsonWithAuth<MeResponse>("/api/v1/users/me", {
        method: "PUT",
        body: JSON.stringify({
          fullName: fullName.trim() || undefined,
          bio: bio.trim() || undefined
        })
      });
    },
    onSuccess: () => {
      if (!mockEditable) void qc.invalidateQueries({ queryKey: ["users", "me", userId] });
      appendDemoLog("Profil", "Profil guncellendi (duzenleme)");
      Toast.show({ type: "success", text1: mockEditable ? "Ornek profil kaydedildi" : "Profil güncellendi" });
      router.back();
    },
    onError: (e) => {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Kaydedilemedi" });
    }
  });

  if (!accessToken && !mockEditable) {
    return (
      <View style={{ flex: 1, padding: U.space(3), justifyContent: "center", backgroundColor: U.bg }}>
        <Text style={[T.body, { color: U.textSecondary, textAlign: "center" }]}>Düzenlemek için giriş yapın.</Text>
      </View>
    );
  }

  if (!mockEditable && q.isPending) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: U.bg }}>
        <ActivityIndicator color={U.primary} />
      </View>
    );
  }

  if (!mockEditable && !q.data?.persisted) {
    return (
      <View style={{ flex: 1, padding: U.space(3), justifyContent: "center", backgroundColor: U.bg }}>
        <Text style={[T.body, { color: U.textSecondary, textAlign: "center" }]}>
          Sunucuda profil kaydı yok; önce kayıt akışını tamamlayın.
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
        contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(3), flexGrow: 1 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ backgroundColor: U.surfaceLow, borderRadius: U.radiusLg, padding: U.space(2), marginBottom: U.space(1) }}>
          <Text style={T.display}>Profil duzenle</Text>
          <Text style={[T.caption, { marginTop: U.space(0.75) }]}>Ad, tanitim ve isletme ozeti</Text>
        </View>
        <Text style={[T.body, { fontWeight: "700", marginTop: U.space(1) }]}>Ad soyad</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="En az 2 karakter"
          placeholderTextColor={U.textMuted}
          style={fieldBase}
          autoCapitalize="words"
        />
        <Text style={[T.body, { fontWeight: "700", marginTop: U.space(2) }]}>Hakkımda</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Kısa tanıtım (isteğe bağlı, en fazla 500 karakter)"
          placeholderTextColor={U.textMuted}
          style={[fieldBase, { minHeight: U.space(12.5) }]}
          multiline
          maxLength={500}
        />
        <View style={{ marginTop: U.space(2), backgroundColor: U.surfaceLow, borderRadius: U.radiusLg, padding: U.space(2) }}>
          <Text style={[T.body, { fontWeight: "700" }]}>Isletme / Saglayici Profili</Text>
          <Text style={[T.caption, { marginTop: U.space(0.75) }]}>{businessSummary}</Text>
          <AppButton
            label="Isletme profilini duzenle"
            variant="secondary"
            onPress={() => router.push(hrefSettingsBusinessProfile)}
            style={{ marginTop: U.space(1.25) }}
          />
        </View>
        <AppButton
          label={save.isPending ? "Kaydediliyor…" : "Kaydet"}
          loading={save.isPending}
          disabled={save.isPending}
          onPress={() => {
            const t = fullName.trim();
            if (t.length > 0 && t.length < 2) {
              Toast.show({ type: "error", text1: "Ad soyad en az 2 karakter olmalı" });
              return;
            }
            void save.mutate();
          }}
          style={{ marginTop: U.space(3) }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
