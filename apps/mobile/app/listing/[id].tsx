import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { apiJson, apiJsonWithAuth } from "../lib/api";
import { openPhoneDialer } from "../lib/openPhoneDialer";
import { isMockDataEnabled, SAMPLE_MARKET_NOTES } from "../lib/mockData";
import { hrefConversation, hrefOffer, hrefReview, hrefUser } from "../lib/paths";
import { tryDecodeURIComponent } from "../lib/safeDecode";
import { Card } from "../components/ui/Card";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U, shadowCard } from "../theme/tokens";

type ListingDetail = {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  listingType?: string;
  userId?: string;
  authorUuid?: string | null;
  status?: string;
  city?: string;
  district?: string;
  sellerRating?: number;
  imageUrl?: string;
};

export default function ListingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = (Array.isArray(idParam) ? idParam[0] : idParam)?.trim() ?? "";
  const id = rawId ? tryDecodeURIComponent(rawId) : "";
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [startingChat, setStartingChat] = useState(false);
  const listingFallbackLoggedFor = useRef<string | null>(null);
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["listing", id],
    enabled: Boolean(id),
    queryFn: () => apiJson<ListingDetail>(`/api/v1/listings/${id}`)
  });

  useEffect(() => {
    if (!id || !error || !isMockDataEnabled() || data) return;
    if (listingFallbackLoggedFor.current === id) return;
    listingFallbackLoggedFor.current = id;
    appendDemoLog("Ilan detayi", `Ornek icerik: ${id}`);
  }, [id, error, data]);

  if (!id) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { textAlign: "center", color: U.textSecondary }]}>Geçersiz ilan bağlantısı.</Text>
      </View>
    );
  }

  if (isPending) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: U.bg }}>
        <ActivityIndicator color={U.primary} />
      </View>
    );
  }
  const fallbackData: ListingDetail = {
    id,
    title: "Ornek Ilan - Test Modu",
    description: "Canli servis baglantisi olmadiginda bu test verisi ile buton akislari denenebilir.",
    price: 2450000,
    listingType: "sell",
    userId: "+905550009988",
    authorUuid: "sample-seller-uuid",
    status: "active",
    city: "Konya",
    district: "Selcuklu",
    sellerRating: 4.8
  };
  const resolvedData = data ?? (isMockDataEnabled() ? fallbackData : undefined);

  if ((error && !resolvedData) || !resolvedData) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { color: U.danger, textAlign: "center" }]}>
          {error instanceof Error ? error.message : "İlan bulunamadı"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="İlanı yeniden yükle"
          onPress={() => void refetch()}
          style={{
            marginTop: U.space(2),
            alignSelf: "center",
            backgroundColor: U.primary,
            paddingHorizontal: U.space(2.5),
            paddingVertical: U.space(1.5),
            borderRadius: 999
          }}
        >
          <Text style={[T.body, { color: U.onPrimary, fontWeight: "700" }]}>Yeniden dene</Text>
        </Pressable>
      </View>
    );
  }

  const sellerId = resolvedData.authorUuid?.trim() || resolvedData.userId?.trim() || "";
  const sellerPhone = resolvedData.userId?.trim() || "";

  const openSellerChat = async () => {
    if (!accessToken || !userId || !sellerPhone || sellerPhone === userId) return;
    setStartingChat(true);
    try {
      const conv = await apiJsonWithAuth<{ id: string; existing?: boolean }>("/api/v1/conversations", {
        method: "POST",
        body: JSON.stringify({
          participants: [userId, sellerPhone],
          listing_id: resolvedData.id
        })
      });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      const cid = conv?.id?.trim();
      if (!cid) {
        Toast.show({ type: "error", text1: "Sohbet kimliği alınamadı" });
        return;
      }
      if (conv.existing) {
        Toast.show({ type: "info", text1: "Bu ilan için sohbetiniz zaten vardı", text2: "Devam ediyorsunuz." });
      }
      appendDemoLog("Ilan", `Satici sohbeti (${conv.existing ? "mevcut" : "yeni"}) — ${resolvedData.id.slice(0, 12)}`);
      router.push(hrefConversation(cid, resolvedData.id) as Href);
    } catch (e) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Sohbet başlatılamadı" });
    } finally {
      setStartingChat(false);
    }
  };

  const locLabel =
    resolvedData.city || resolvedData.district
      ? `${resolvedData.city ?? "—"} / ${resolvedData.district ?? "—"}`
      : "Belirtilmedi";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: U.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + U.space(4), flexGrow: 1 }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isFetching && !isPending} onRefresh={() => void refetch()} />}
    >
      <View style={{ paddingHorizontal: U.space(2), paddingTop: insets.top + U.space(1) }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: U.space(1.5) }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={U.primary} />
          </Pressable>
          <Text style={T.brand}>The Pastoral</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="notifications-outline" size={22} color={U.text} style={{ marginRight: U.space(1) }} />
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: U.secondaryContainer,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="person" size={20} color={U.onSecondaryContainer} />
            </View>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: U.space(2) }}>
        <View style={{ borderRadius: U.radiusLg, overflow: "hidden", ...shadowCard }}>
          {typeof resolvedData.imageUrl === "string" ? (
            <Image source={{ uri: resolvedData.imageUrl }} style={{ width: "100%", height: U.space(28), backgroundColor: U.surfaceContainer }} />
          ) : (
            <View style={{ height: U.space(28), backgroundColor: U.surfaceContainer }} />
          )}
          <View
            style={{
              position: "absolute",
              left: U.space(1.5),
              bottom: U.space(1.5),
              backgroundColor: "rgba(0,0,0,0.5)",
              paddingHorizontal: U.space(1),
              paddingVertical: U.space(0.25),
              borderRadius: 8
            }}
          >
            <Text style={[T.overline, { color: U.onPrimary, fontSize: 10 }]}>ANA GÖRÜNÜM</Text>
          </View>
        </View>

        {error ? (
          <Text style={[T.caption, { color: U.warnText, fontWeight: "600", marginTop: U.space(1) }]}>
            Canlı veri yok — örnek ilan gösteriliyor.
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: U.space(1.5) }}>
          <View
            style={{
              backgroundColor: U.secondaryContainer,
              paddingHorizontal: U.space(1),
              paddingVertical: U.space(0.35),
              borderRadius: 999,
              marginRight: U.space(1)
            }}
          >
            <Text style={[T.caption, { fontWeight: "800", color: U.onSecondaryContainer }]}>DOĞRULANMIŞ İLAN</Text>
          </View>
          <Text style={[T.caption, { color: U.textMuted }]}>
            <Ionicons name="eye-outline" size={14} color={U.textMuted} /> 1.245 kez görüntülendi
          </Text>
        </View>

        <Text style={[T.display, { marginTop: U.space(1), fontSize: 22 }]}>{resolvedData.title ?? resolvedData.id}</Text>
        <Text style={[T.title, { marginTop: U.space(0.75), color: U.price, fontSize: 26 }]}>
          {resolvedData.price != null
            ? `₺${Math.round(resolvedData.price).toLocaleString("tr-TR")}`
            : "Fiyat sor"}
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: U.space(2), marginHorizontal: -U.space(0.5) }}>
          {(
            [
              { icon: "calendar-outline" as const, label: "YAŞ", value: "—" },
              { icon: "speedometer-outline" as const, label: "AĞIRLIK", value: "—" },
              { icon: "paw-outline" as const, label: "CİNS", value: resolvedData.listingType ?? "—" },
              { icon: "location-outline" as const, label: "KONUM", value: locLabel }
            ] as const
          ).map((cell) => (
            <View
              key={cell.label}
              style={{
                width: "50%",
                padding: U.space(0.5)
              }}
            >
              <View
                style={{
                  backgroundColor: U.surfaceTint,
                  borderRadius: U.radius,
                  padding: U.space(1.5),
                  alignItems: "center"
                }}
              >
                <Ionicons name={cell.icon} size={20} color={U.tertiary} />
                <Text style={[T.overline, { marginTop: U.space(0.5) }]}>{cell.label}</Text>
                <Text style={[T.body, { fontWeight: "800", marginTop: 2 }]} numberOfLines={2}>
                  {cell.value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {accessToken && sellerPhone && sellerPhone !== userId ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: U.space(2) }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mesaj gönder"
              onPress={() => void openSellerChat()}
              disabled={startingChat}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: startingChat ? U.textMuted : U.primary,
                paddingVertical: U.space(1.5),
                borderRadius: U.radius
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={U.onPrimary} style={{ marginRight: U.space(1) }} />
              <Text style={[T.body, { color: U.onPrimary, fontWeight: "800" }]}>
                {startingChat ? "Açılıyor…" : "Mesaj Gönder"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ara"
              onPress={() => void openPhoneDialer(sellerPhone)}
              style={{
                width: U.space(6),
                height: U.space(6),
                marginLeft: U.space(1),
                borderRadius: U.radius,
                backgroundColor: U.limeCta,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="call" size={22} color={U.onLimeCta} />
            </Pressable>
          </View>
        ) : null}

        <Card style={{ marginTop: U.space(2.5), padding: U.space(2), borderRadius: U.radiusLg }}>
          <Text style={[T.title, { marginBottom: U.space(1) }]}>Sağlık ve geçmiş</Text>
          <Text style={[T.body, { color: U.textSecondary, lineHeight: 22 }]}>
            {resolvedData.description ?? "Aşı ve sürü kayıtları satıcı beyanı ile listelenir; teslimattan önce veteriner kontrolü önerilir."}
          </Text>
          <View style={{ marginTop: U.space(1.5) }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: U.space(1) }}>
              <Ionicons name="checkmark-circle" size={20} color={U.secondary} style={{ marginRight: U.space(1) }} />
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { fontWeight: "700" }]}>Aşı kayıtları</Text>
                <Text style={[T.caption, { marginTop: 2 }]}>Şap, brucella vb. — satıcı beyanı</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Ionicons name="checkmark-circle" size={20} color={U.secondary} style={{ marginRight: U.space(1) }} />
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { fontWeight: "700" }]}>Veteriner onayı</Text>
                <Text style={[T.caption, { marginTop: 2 }]}>Son kontrol tarihi: örnek Mart 2024</Text>
              </View>
            </View>
          </View>
        </Card>

        <View
          style={{
            marginTop: U.space(2),
            backgroundColor: U.surfaceTint,
            borderRadius: U.radiusLg,
            padding: U.space(2)
          }}
        >
          <Text style={[T.overline, { marginBottom: U.space(0.5) }]}>Satıcı</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: U.surface,
                marginRight: U.space(1.5),
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="person" size={28} color={U.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { fontWeight: "800" }]}>İlan sahibi</Text>
              <Text style={[T.caption, { marginTop: 2 }]}>Üye · ⭐ {typeof resolvedData.sellerRating === "number" ? resolvedData.sellerRating.toFixed(1) : "4.8"}</Text>
            </View>
          </View>
          {sellerId ? (
            <Link href={hrefUser(sellerId) as Href} asChild>
              <Pressable style={{ marginTop: U.space(1.25) }}>
                <Text style={[T.caption, { color: U.tertiary, fontWeight: "700" }]}>Profili görüntüle →</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>

        <View
          style={{
            marginTop: U.space(2),
            backgroundColor: U.surfaceLow,
            borderRadius: U.radius,
            padding: U.space(1.5)
          }}
        >
          <Text style={[T.body, { fontWeight: "700" }]}>Piyasa notları</Text>
          {SAMPLE_MARKET_NOTES.map((line) => (
            <Text key={line} style={[T.caption, { marginTop: U.space(0.75) }]}>
              • {line}
            </Text>
          ))}
        </View>

        {accessToken && sellerId && sellerId !== userId ? (
          <Link href={hrefReview(sellerId, resolvedData.id)} asChild>
            <Pressable accessibilityRole="button" style={{ marginTop: U.space(1.5) }}>
              <Text style={[T.body, { color: U.tertiary, fontWeight: "700" }]}>Bu ilan için satıcıyı değerlendir</Text>
            </Pressable>
          </Link>
        ) : null}

        {accessToken && resolvedData.userId && resolvedData.userId !== userId ? (
          <Link href={hrefOffer(resolvedData.id) as Href} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Teklif ver"
              style={{
                marginTop: U.space(1.5),
                backgroundColor: U.surface,
                paddingVertical: U.space(1.5),
                borderRadius: U.radius,
                alignItems: "center",
                borderWidth: 2,
                borderColor: U.primary
              }}
            >
              <Text style={[T.body, { color: U.primary, fontWeight: "800" }]}>Teklif ver</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>
    </ScrollView>
  );
}

