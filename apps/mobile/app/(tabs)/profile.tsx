import { useQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { maskPhone } from "@agromarket/shared-utils";
import { StateCard, StateNotice } from "../components/RequestStates";
import { AppButton } from "../components/ui/AppButton";
import { Card } from "../components/ui/Card";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { TrustScoreVisual } from "../components/ui/TrustScoreVisual";
import { apiJsonWithAuth, getApiBase, newRequestId } from "../lib/api";
import { loadBusinessProfileDraft } from "../lib/businessProfileDraft";
import { isMockDataEnabled, SAMPLE_PROFILE_HIGHLIGHTS } from "../lib/mockData";
import {
  hrefOffers,
  hrefSettings,
  hrefSettingsBusinessProfile,
  hrefSettingsFollowing,
  hrefSettingsProfileEdit,
  hrefUser
} from "../lib/paths";
import { appendDemoLog, useDemoLogStore } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

type MeResponse = {
  persisted: boolean;
  id?: string;
  phoneNumber?: string;
  fullName?: string;
  userType?: string;
  trustScore?: number;
  verificationStatus?: string;
  message?: string;
  businessProfile?: {
    providerKind?: "goods" | "services";
    businessName?: string;
    title?: string;
    category?: string;
    city?: string;
    district?: string;
    addressLine?: string;
    serviceArea?: string;
    contactPerson?: string;
    whatsapp?: string;
    workingHours?: string;
    deliveryTypes?: string;
  } | null;
};
type DashboardResponse = {
  totalSales: number;
  activeListings: number;
  soldListings: number;
  avgResponseMinutes: number;
  persisted?: boolean;
};
const SAMPLE_ME: MeResponse = {
  persisted: true,
  id: "sample-user-1",
  phoneNumber: "+905300000067",
  fullName: "Ahmet Yilmaz - Ciftci",
  userType: "Onayli Uretici",
  trustScore: 82,
  verificationStatus: "agricultural_verified"
};
const SAMPLE_DASHBOARD: DashboardResponse = {
  totalSales: 184500,
  activeListings: 12,
  soldListings: 8,
  avgResponseMinutes: 18,
  persisted: true
};

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: U.space(1.25) }}>
      <Text style={[T.caption, { textAlign: "center" }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[T.title, { marginTop: U.space(0.5), fontSize: 15, textAlign: "center" }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { userId, phoneNumber, logout, accessToken, refreshToken } = useAuthStore();
  const demoEntries = useDemoLogStore((s) => s.entries);
  const clearDemoLog = useDemoLogStore((s) => s.clear);
  const followsQ = useQuery({
    queryKey: ["follows", "list", "profile"],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<{ data?: Array<{ targetUserId?: string }> }>("/api/v1/users/me/follows?limit=200")
  });
  const followedCount =
    accessToken && userId ? (followsQ.data?.data ?? []).filter((x) => Boolean(x.targetUserId?.trim())).length : 0;
  const [loggingOut, setLoggingOut] = useState(false);
  const [providerDraft, setProviderDraft] = useState<{
    providerKind?: "goods" | "services";
    businessName?: string;
    title?: string;
    category?: string;
    city?: string;
    district?: string;
    addressLine?: string;
    serviceArea?: string;
    contactPerson?: string;
    whatsapp?: string;
    workingHours?: string;
    deliveryTypes?: string;
  } | null>(null);
  const profileMockLogged = useRef(false);

  const { data: me, isPending: meLoading, isRefetching, isError, error, refetch } = useQuery({
    queryKey: ["users", "me", userId],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<MeResponse>("/api/v1/users/me")
  });
  const { data: dashboard } = useQuery({
    queryKey: ["users", "dashboard", userId],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<DashboardResponse>("/api/v1/users/me/dashboard")
  });
  const useMockProfile = isError && isMockDataEnabled();
  const resolvedMe = useMockProfile ? SAMPLE_ME : me;
  const resolvedDashboard = useMockProfile ? SAMPLE_DASHBOARD : dashboard;

  useEffect(() => {
    if (useMockProfile && !profileMockLogged.current) {
      profileMockLogged.current = true;
      appendDemoLog("Profil", "Canli veri yok; ornek profil gosterildi");
    }
  }, [useMockProfile]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const draft = await loadBusinessProfileDraft(userId);
      if (!mounted) return;
      if (me?.businessProfile) {
        setProviderDraft(me.businessProfile);
      } else {
        setProviderDraft(draft);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, me?.businessProfile]);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      if (refreshToken) {
        try {
          await fetch(`${getApiBase()}/api/v1/auth/logout`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "x-request-id": newRequestId()
            },
            body: JSON.stringify({ refreshToken })
          });
        } catch {
          /* ag yok */
        }
      }
      appendDemoLog(
        "Oturum",
        phoneNumber ? `Cikis — ${maskPhone(phoneNumber)}` : userId ? `Cikis — kullanici ${userId.slice(0, 8)}...` : "Cikis yapildi"
      );
      logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const publicProfileHref = resolvedMe?.id ? (hrefUser(resolvedMe.id) as Href) : null;
  const initial = (resolvedMe?.fullName?.trim().charAt(0) || "?").toUpperCase();
  const trust = typeof resolvedMe?.trustScore === "number" ? resolvedMe.trustScore : 72;
  const salesText =
    typeof resolvedDashboard?.totalSales === "number"
      ? `${Math.round(resolvedDashboard.totalSales).toLocaleString("tr-TR")} TL`
      : "—";

  const sessionLine = phoneNumber ? maskPhone(phoneNumber) : userId ?? (accessToken ? "—" : "Giris yapin");
  const providerMissingCount = [
    !providerDraft?.businessName,
    !providerDraft?.category,
    !providerDraft?.city,
    !providerDraft?.addressLine,
    !providerDraft?.contactPerson,
    providerDraft?.providerKind === "services" && !providerDraft?.workingHours,
    providerDraft?.providerKind === "services" && !providerDraft?.whatsapp,
    providerDraft?.providerKind === "goods" && !providerDraft?.deliveryTypes
  ].filter(Boolean).length;
  const providerMissingLabels = [
    !providerDraft?.businessName ? "Isletme adi" : null,
    !providerDraft?.category ? "Kategori" : null,
    !providerDraft?.city ? "Il" : null,
    !providerDraft?.addressLine ? "Adres" : null,
    !providerDraft?.contactPerson ? "Yetkili kisi" : null,
    providerDraft?.providerKind === "services" && !providerDraft?.workingHours ? "Calisma saatleri" : null,
    providerDraft?.providerKind === "services" && !providerDraft?.whatsapp ? "WhatsApp hatti" : null,
    providerDraft?.providerKind === "goods" && !providerDraft?.deliveryTypes ? "Teslimat turleri" : null
  ].filter(Boolean) as string[];
  const providerRequiredTotal = providerDraft?.providerKind === "services" ? 7 : 6;
  const providerDone = Math.max(0, providerRequiredTotal - providerMissingCount);
  const providerPercent = Math.round((providerDone / providerRequiredTotal) * 100);

  return (
    <ScrollView
      testID="e2e-profile-screen"
      style={{ flex: 1, backgroundColor: U.bg }}
      contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(3), flexGrow: 1 }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        accessToken && userId ? <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} /> : undefined
      }
    >
      <ScreenHeader title="Profil" subtitle={sessionLine} />

      {accessToken && userId ? (
        meLoading ? (
          <ActivityIndicator style={{ marginTop: U.space(2) }} color={U.primary} />
        ) : isError && !useMockProfile ? (
          <View style={{ marginTop: U.space(2) }}>
            <Text style={[T.body, { color: U.danger }]}>{error instanceof Error ? error.message : "Profil yuklenemedi"}</Text>
            <AppButton label="Yeniden dene" onPress={() => void refetch()} style={{ marginTop: U.space(2) }} />
          </View>
        ) : resolvedMe?.persisted ? (
          <View style={{ marginTop: U.space(2) }}>
            {isError ? <StateNotice text="Ornek veri (baglanti yok)" style={{ marginTop: 0, marginBottom: U.space(1) }} /> : null}

            <Card style={{ padding: U.space(2) }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: U.space(2) }}>
                <View
                  style={{
                    width: U.space(7),
                    height: U.space(7),
                    borderRadius: U.space(3.5),
                    backgroundColor: U.secondaryContainer,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: U.space(2)
                  }}
                >
                  <Text style={[T.title, { fontSize: 22, color: U.onSecondaryContainer }]}>{initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.title, { fontSize: 17 }]} numberOfLines={2}>
                    {resolvedMe.fullName ?? "—"}
                  </Text>
                  <Text style={[T.caption, { marginTop: U.space(0.25) }]} numberOfLines={1}>
                    {resolvedMe.userType ?? ""}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: "center", marginBottom: U.space(2) }}>
                <TrustScoreVisual score={trust} />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  borderRadius: U.radiusLg,
                  backgroundColor: U.surfaceLow,
                  paddingVertical: U.space(1),
                  paddingHorizontal: U.space(0.5)
                }}
              >
                <StatChip label="Satis" value={salesText} />
                <StatChip label="Aktif" value={`${resolvedDashboard?.activeListings ?? 0}`} />
                <StatChip label="Biten" value={`${resolvedDashboard?.soldListings ?? 0}`} />
              </View>
              <Text style={[T.caption, { marginTop: U.space(1), textAlign: "center" }]}>
                Ort. yanit: {resolvedDashboard?.avgResponseMinutes ?? 0} dk
              </Text>
              {resolvedMe.verificationStatus?.toLowerCase().includes("agricultural") ? (
                <View
                  style={{
                    alignSelf: "center",
                    marginTop: U.space(1),
                    backgroundColor: U.secondaryContainer,
                    paddingHorizontal: U.space(1.5),
                    paddingVertical: U.space(0.75),
                    borderRadius: 999
                  }}
                >
                  <Text style={[T.caption, { fontWeight: "700", color: U.onSecondaryContainer }]}>Onayli uretici</Text>
                </View>
              ) : null}
            </Card>

            <AppButton label="Profili duzenle" onPress={() => router.push(hrefSettingsProfileEdit)} style={{ marginTop: U.space(2) }} />
            <AppButton
              label={followedCount > 0 ? `Takip ettikleriniz (${followedCount})` : "Takip ettikleriniz"}
              variant="secondary"
              onPress={() => router.push(hrefSettingsFollowing)}
              style={{ marginTop: U.space(1) }}
            />
            {providerDraft?.businessName ? (
              <Card style={{ marginTop: U.space(1.5), padding: U.space(2) }}>
                <Text style={[T.body, { fontWeight: "700" }]}>Mal / Hizmet Saglayici Profili</Text>
                <Text style={[T.caption, { marginTop: U.space(0.5), color: U.tertiary }]}>
                  Tip: {providerDraft.providerKind === "services" ? "Hizmet saglayici" : "Mal saglayici"}
                </Text>
                <Text style={[T.caption, { marginTop: U.space(0.75) }]}>Isletme: {providerDraft.businessName}</Text>
                {providerDraft.title ? <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Unvan: {providerDraft.title}</Text> : null}
                {providerDraft.category ? <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Kategori: {providerDraft.category}</Text> : null}
                {(providerDraft.city || providerDraft.district) ? (
                  <Text style={[T.caption, { marginTop: U.space(0.5) }]}>
                    Konum: {[providerDraft.city, providerDraft.district].filter(Boolean).join(" / ")}
                  </Text>
                ) : null}
                {providerDraft.addressLine ? <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Adres: {providerDraft.addressLine}</Text> : null}
                {providerDraft.serviceArea ? <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Hizmet bolgesi: {providerDraft.serviceArea}</Text> : null}
                {providerDraft.contactPerson ? <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Yetkili: {providerDraft.contactPerson}</Text> : null}
                {providerDraft.whatsapp ? <Text style={[T.caption, { marginTop: U.space(0.5) }]}>WhatsApp: {providerDraft.whatsapp}</Text> : null}
                {providerDraft.workingHours ? <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Calisma: {providerDraft.workingHours}</Text> : null}
                {providerDraft.deliveryTypes ? <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Teslimat: {providerDraft.deliveryTypes}</Text> : null}
                <View style={{ marginTop: U.space(1) }}>
                  <Text style={[T.caption, { marginBottom: U.space(0.5) }]}>Tamamlanma: %{providerPercent}</Text>
                  <View style={{ height: U.space(1), borderRadius: 999, backgroundColor: U.surfaceContainer, overflow: "hidden" }}>
                    <View
                      style={{
                        width: `${providerPercent}%`,
                        height: "100%",
                        backgroundColor: providerMissingCount > 0 ? U.primary : U.secondary
                      }}
                    />
                  </View>
                </View>
                {providerMissingCount > 0 ? (
                  <>
                    <Text style={[T.caption, { marginTop: U.space(1), color: U.danger }]}>
                      Profil tamamlama: {providerMissingCount} alan eksik
                    </Text>
                    <Text style={[T.caption, { marginTop: U.space(0.5), color: U.danger }]}>
                      Eksikler: {providerMissingLabels.join(", ")}
                    </Text>
                  </>
                ) : (
                  <Text style={[T.caption, { marginTop: U.space(1), color: U.secondary, fontWeight: "600" }]}>Profil tamamlama: Tamamlandi</Text>
                )}
                <AppButton
                  label="Isletme profilini duzenle"
                  variant="secondary"
                  onPress={() => router.push(hrefSettingsBusinessProfile)}
                  style={{ marginTop: U.space(1.5) }}
                />
              </Card>
            ) : (
              <Card style={{ marginTop: U.space(1.5), padding: U.space(2) }}>
                <Text style={[T.body, { fontWeight: "700" }]}>Isletme profili henuz eklenmedi</Text>
                <Text style={[T.caption, { marginTop: U.space(0.75) }]}>Mal/hizmet sagliyorsan detayli profilini tamamla.</Text>
                <AppButton
                  label="Isletme profili olustur"
                  variant="secondary"
                  onPress={() => router.push(hrefSettingsBusinessProfile)}
                  style={{ marginTop: U.space(1.5) }}
                />
              </Card>
            )}

            {publicProfileHref ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Herkese acik profil"
                onPress={() => router.push(publicProfileHref)}
                style={{ marginTop: U.space(1.5), alignItems: "center", paddingVertical: U.space(1) }}
              >
                <Text style={[T.body, { color: U.tertiary, fontWeight: "700" }]}>Herkese acik profilim</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <StateCard title={me?.message ?? "Profil kaydi yok."} description="Kayit icin hesap adimlarini tamamlayin." />
        )
      ) : (
        <StateCard title="Giris gerekli" description="Giris yapinca profilinizi gorursunuz." />
      )}

      {!resolvedMe?.persisted && isMockDataEnabled() ? (
        <Card style={{ marginTop: U.space(2), padding: U.space(2) }}>
          <Text style={[T.body, { fontWeight: "600" }]}>Ornek hesap</Text>
          {SAMPLE_PROFILE_HIGHLIGHTS.map((line) => (
            <Text key={line} style={[T.caption, { marginTop: U.space(0.75) }]}>
              {line}
            </Text>
          ))}
        </Card>
      ) : null}

      {isMockDataEnabled() || __DEV__ ? (
        <Card style={{ marginTop: U.space(2), padding: U.space(2) }}>
          <Text style={[T.body, { fontWeight: "600" }]}>Test gunlugu</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Bu cihazda, oturum boyunca.</Text>
          {demoEntries.length === 0 ? (
            <Text style={[T.caption, { marginTop: U.space(1), color: U.textMuted }]}>Kayit yok.</Text>
          ) : (
            demoEntries.slice(0, 12).map((e) => (
              <Text key={e.id} style={[T.caption, { marginTop: U.space(1), color: U.text }]}>
                {new Date(e.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} · {e.label}
                {e.detail ? ` — ${e.detail}` : ""}
              </Text>
            ))
          )}
          {demoEntries.length > 12 ? (
            <Text style={[T.caption, { marginTop: U.space(0.75), color: U.textMuted }]}>+{demoEntries.length - 12}</Text>
          ) : null}
          {demoEntries.length > 0 ? (
            <AppButton label="Temizle" variant="secondary" onPress={() => clearDemoLog()} style={{ marginTop: U.space(1.5) }} />
          ) : null}
        </Card>
      ) : null}

      <Card style={{ marginTop: U.space(2), overflow: "hidden" }}>
        <Link href={hrefOffers} asChild>
          <Pressable accessibilityRole="button" style={{ paddingVertical: U.space(2), paddingHorizontal: U.space(2), borderBottomWidth: 1, borderBottomColor: U.border }}>
            <Text style={[T.body, { fontWeight: "700", color: U.tertiary }]}>Tekliflerim</Text>
          </Pressable>
        </Link>
        <Link href={hrefSettings} asChild>
          <Pressable accessibilityRole="button" style={{ paddingVertical: U.space(2), paddingHorizontal: U.space(2) }}>
            <Text style={[T.body, { fontWeight: "700", color: U.tertiary }]}>Ayarlar</Text>
          </Pressable>
        </Link>
      </Card>

      <Text style={[T.caption, { marginTop: U.space(2), color: accessToken ? U.primaryDark : U.danger }]}>
        {accessToken ? "Oturum acik" : "Oturum kapali"}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cikis yap"
        disabled={loggingOut || !accessToken}
        onPress={() => void onLogout()}
        style={{
          marginTop: U.space(1.5),
          minHeight: U.space(6),
          borderRadius: U.radius,
          backgroundColor: U.dangerSoft,
          borderWidth: 1,
          borderColor: U.dangerBorderStrong,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={[T.body, { fontWeight: "600", color: U.danger }]}>{loggingOut ? "Cikiliyor..." : "Cikis yap"}</Text>
      </Pressable>
    </ScrollView>
  );
}
