import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadBusinessProfileDraft } from "../lib/businessProfileDraft";
import {
  hrefSettingsBusinessProfile,
  hrefSettingsFollowing,
  hrefSettingsHelp,
  hrefSettingsNotifications,
  hrefSettingsPrivacy,
  hrefSettingsProfileEdit,
  hrefSettingsVerification,
  hrefSettingsVerificationAdmin
} from "../lib/paths";
import { useAuthStore } from "../store/auth";
import { apiJsonWithAuth } from "../lib/api";
import { T, U } from "../theme/tokens";

const rowBase = {
  backgroundColor: U.surface,
  paddingVertical: U.space(2),
  paddingHorizontal: U.space(2),
  borderBottomWidth: 1,
  borderBottomColor: U.border
};

type MeResponse = {
  persisted?: boolean;
  businessProfile?: {
    providerKind?: "goods" | "services";
    businessName?: string;
    category?: string;
    city?: string;
    addressLine?: string;
    contactPerson?: string;
    workingHours?: string;
    whatsapp?: string;
    deliveryTypes?: string;
  } | null;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { userId, accessToken } = useAuthStore();
  const followsQ = useQuery({
    queryKey: ["follows", "list", "settings"],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<{ data?: Array<{ targetUserId?: string }> }>("/api/v1/users/me/follows?limit=200")
  });
  const followedCount =
    accessToken && userId ? (followsQ.data?.data ?? []).filter((x) => Boolean(x.targetUserId?.trim())).length : 0;
  const meQ = useQuery({
    queryKey: ["users", "me", "settings", userId],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<MeResponse>("/api/v1/users/me")
  });
  const [completionText, setCompletionText] = useState("Durum: Baslanmadi");
  const [completionTone, setCompletionTone] = useState<"ok" | "warn">("warn");
  const [completionPercent, setCompletionPercent] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const fromServer = meQ.data?.businessProfile ?? null;
      const draft = fromServer ?? (await loadBusinessProfileDraft(userId));
      if (!mounted || !draft) {
        setCompletionText("Durum: Baslanmadi");
        setCompletionTone("warn");
        setCompletionPercent(0);
        return;
      }
      const checks = [
        Boolean(draft.businessName),
        Boolean(draft.category),
        Boolean(draft.city),
        Boolean(draft.addressLine),
        Boolean(draft.contactPerson),
        draft.providerKind === "services" ? Boolean(draft.workingHours) : true,
        draft.providerKind === "services" ? Boolean(draft.whatsapp) : true,
        draft.providerKind === "goods" ? Boolean(draft.deliveryTypes) : true
      ];
      const done = checks.filter(Boolean).length;
      const total = checks.length;
      const percent = Math.round((done / total) * 100);
      const missing = total - done;
      setCompletionText(`Durum: %${percent} tamam · ${missing} eksik`);
      setCompletionTone(missing === 0 ? "ok" : "warn");
      setCompletionPercent(percent);
    })();
    return () => {
      mounted = false;
    };
  }, [userId, meQ.data?.businessProfile]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: U.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + U.space(2), flexGrow: 1 }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          paddingHorizontal: U.space(2),
          paddingTop: U.space(1.5),
          paddingBottom: U.space(1),
          backgroundColor: U.surfaceLow
        }}
      >
        <Text style={T.display}>Hesap Ayarlari</Text>
        <Text style={[T.caption, { marginTop: U.space(0.75) }]}>
          Hesap guvenligi, bildirimler ve gizlilik tercihlerinizi bu alandan yonetebilirsiniz.
        </Text>
      </View>
      <Link href={hrefSettingsProfileEdit} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Profili düzenle" style={rowBase}>
          <Text style={[T.body, { fontWeight: "700" }]}>Profili duzenle</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Ad soyad, tanitim metni ve profil gorunurlugu</Text>
        </Pressable>
      </Link>
      <Link href={hrefSettingsBusinessProfile} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Isletme profili" style={rowBase}>
          <Text style={[T.body, { fontWeight: "700" }]}>Isletme Profili</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>
            Adres, kategori, unvan, calisma saatleri, WhatsApp ve teslimat tipleri
          </Text>
          <Text
            style={[
              T.caption,
              {
                marginTop: U.space(0.75),
                fontWeight: "700",
                color: completionTone === "ok" ? U.secondary : U.warnText
              }
            ]}
          >
            {completionText}
          </Text>
          <View
            style={{
              marginTop: U.space(0.75),
              height: U.space(0.75),
              borderRadius: 999,
              backgroundColor: U.surfaceContainer,
              overflow: "hidden"
            }}
          >
            <View
              style={{
                width: `${completionPercent}%`,
                height: "100%",
                backgroundColor: completionTone === "ok" ? U.secondary : U.primary
              }}
            />
          </View>
        </Pressable>
      </Link>
      <Link href={hrefSettingsFollowing} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Takip ettikleriniz" style={rowBase}>
          <Text style={[T.body, { fontWeight: "700" }]}>Takip ettikleriniz</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>
            {accessToken && userId
              ? followedCount > 0
                ? `${followedCount} satıcı · hesapla senkron`
                : "Henüz takip yok · satıcı profilinden ekleyin"
              : "Takip listesi için giriş yapın"}
          </Text>
        </Pressable>
      </Link>
      <Link href={hrefSettingsVerification} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Hesap doğrulama" style={rowBase}>
          <Text style={[T.body, { fontWeight: "700" }]}>Dogrulama</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Kimlik ve isletme belgeleriyle guven seviyesini artirin</Text>
        </Pressable>
      </Link>
      <Link href={hrefSettingsVerificationAdmin} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Doğrulama yönetimi" style={rowBase}>
          <Text style={[T.body, { fontWeight: "700" }]}>Dogrulama Yonetimi</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Admin paneli: bekleyen talepleri onayla / reddet</Text>
        </Pressable>
      </Link>
      <Link href={hrefSettingsNotifications} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Bildirim ayarları" style={rowBase}>
          <Text style={[T.body, { fontWeight: "700" }]}>Bildirimler</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Sohbet, teklif ve ilan hareket bildirim tercihleri</Text>
        </Pressable>
      </Link>
      <Link href={hrefSettingsPrivacy} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Gizlilik" style={rowBase}>
          <Text style={[T.body, { fontWeight: "700" }]}>Gizlilik</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Veri kullanimi, saklama suresi ve hesap talepleri</Text>
        </Pressable>
      </Link>
      <Link href={hrefSettingsHelp} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Son gelişmeler" style={rowBase}>
          <Text style={[T.body, { fontWeight: "700" }]}>Son Gelismeler</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Nisan 2026 UI/UX ve altyapi iyilestirmelerini goruntule</Text>
        </Pressable>
      </Link>
      <Link href={hrefSettingsHelp} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Yardım" style={{ ...rowBase, borderBottomWidth: 0 }}>
          <Text style={[T.body, { fontWeight: "700" }]}>Yardım</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Sik sorulan sorular ve hizli cozum adimlari</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}
