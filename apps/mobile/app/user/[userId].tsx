import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, ImageBackground, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { TrustBadge } from "@agromarket/ui-components";
import { apiJson, apiJsonWithAuth } from "../lib/api";
import { isMockDataEnabled, SAMPLE_USER_LISTINGS, SAMPLE_USER_REVIEWS } from "../lib/mockData";
import { hrefConversation, hrefListing, hrefReview } from "../lib/paths";
import { tryDecodeURIComponent } from "../lib/safeDecode";
import { Card } from "../components/ui/Card";
import { pastoralSplashBg } from "../lib/pastoralAssets";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U, shadowCard } from "../theme/tokens";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;

function isPastListingStatus(status?: string): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "sold" || s === "closed" || s === "archived" || s === "inactive" || s === "expired";
}

type PublicUser = {
  id: string;
  fullName?: string;
  userType?: string;
  verificationStatus?: string;
  ratingAvg?: number;
  ratingCount?: number;
  trustScore?: number;
  persisted?: boolean;
};

type UserListings = {
  data: Array<{
    id: string;
    title?: string;
    listingType?: string;
    price?: number;
    status?: string;
    createdAt?: string;
  }>;
};

type UserReviews = {
  data: Array<{
    id: string;
    reviewerName?: string;
    rating?: number;
    comment?: string | null;
    sellerReply?: string | null;
    createdAt?: string;
  }>;
};

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const { userId: userIdParam } = useLocalSearchParams<{ userId?: string | string[] }>();
  const rawUid = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
  const uid = rawUid?.trim() ? tryDecodeURIComponent(rawUid.trim()) : "";
  const sessionPhone = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [startingDm, setStartingDm] = useState(false);
  const [tab, setTab] = useState<"active" | "past" | "reviews">("active");
  const phoneFromUrl = E164_PHONE.test(uid);

  const profileQ = useQuery({
    queryKey: ["user", "profile", uid],
    enabled: Boolean(uid),
    queryFn: () => apiJson<PublicUser>(`/api/v1/users/${encodeURIComponent(uid)}`)
  });

  const listingsQ = useQuery({
    queryKey: ["user", "listings", uid],
    enabled: Boolean(uid),
    queryFn: () => apiJson<UserListings>(`/api/v1/users/${encodeURIComponent(uid)}/listings?limit=30`)
  });

  const reviewsQ = useQuery({
    queryKey: ["user", "reviews", uid],
    enabled: Boolean(uid),
    queryFn: () => apiJson<UserReviews>(`/api/v1/users/${encodeURIComponent(uid)}/reviews?limit=20`)
  });

  const peerPhoneQ = useQuery({
    queryKey: ["user", "peer-phone", uid],
    enabled: Boolean(accessToken && sessionPhone && uid && !phoneFromUrl && profileQ.isSuccess),
    queryFn: () =>
      apiJsonWithAuth<{ phoneNumber: string }>(`/api/v1/users/${encodeURIComponent(uid)}/peer-phone`)
  });

  const dmTarget = phoneFromUrl ? uid : (peerPhoneQ.data?.phoneNumber ?? "");
  const canMessage =
    Boolean(accessToken && sessionPhone && dmTarget && dmTarget !== sessionPhone) &&
    (phoneFromUrl || peerPhoneQ.isSuccess);

  const inboxRefreshing =
    profileQ.isRefetching || listingsQ.isRefetching || reviewsQ.isRefetching || peerPhoneQ.isRefetching;

  const pullRefresh = () => {
    void profileQ.refetch();
    void listingsQ.refetch();
    void reviewsQ.refetch();
    void peerPhoneQ.refetch();
  };

  const listingsRowsEarly = listingsQ.data?.data ?? [];
  const reviewsRowsEarly = reviewsQ.data?.data ?? [];
  const listingsFallbackLog =
    Boolean(uid) &&
    !profileQ.isPending &&
    profileQ.isSuccess &&
    !listingsQ.isPending &&
    listingsQ.isError &&
    listingsRowsEarly.length === 0 &&
    isMockDataEnabled();
  const reviewsFallbackLog =
    Boolean(uid) &&
    !profileQ.isPending &&
    profileQ.isSuccess &&
    !reviewsQ.isPending &&
    reviewsQ.isError &&
    reviewsRowsEarly.length === 0 &&
    isMockDataEnabled();
  const userListingsFallbackLogged = useRef<string | null>(null);
  useEffect(() => {
    if (!listingsFallbackLog || !uid) return;
    if (userListingsFallbackLogged.current === uid) return;
    userListingsFallbackLogged.current = uid;
    appendDemoLog("Kullanici ilanlari", "Ornek vitrin");
  }, [listingsFallbackLog, uid]);
  const userReviewsFallbackLogged = useRef<string | null>(null);
  useEffect(() => {
    if (!reviewsFallbackLog || !uid) return;
    if (userReviewsFallbackLogged.current === uid) return;
    userReviewsFallbackLogged.current = uid;
    appendDemoLog("Kullanici yorumlari", "Ornek yorumlar");
  }, [reviewsFallbackLog, uid]);

  if (!uid) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { textAlign: "center", color: U.textSecondary }]}>Geçersiz profil bağlantısı.</Text>
      </View>
    );
  }

  if (profileQ.isPending) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: U.bg }}>
        <ActivityIndicator color={U.primary} />
      </View>
    );
  }

  if (profileQ.error || !profileQ.data) {
    return (
      <View style={{ flex: 1, padding: U.space(3), justifyContent: "center", backgroundColor: U.bg }}>
        <Text style={[T.body, { color: U.danger, textAlign: "center" }]}>
          {profileQ.error instanceof Error ? profileQ.error.message : "Profil yüklenemedi"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profili yeniden yükle"
          onPress={() => void profileQ.refetch()}
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

  const p = profileQ.data;
  const isSelf = Boolean(sessionPhone && uid === sessionPhone);
  const followStatusQ = useQuery({
    queryKey: ["follows", "status", uid],
    enabled: Boolean(accessToken && sessionPhone && uid && !isSelf),
    queryFn: () =>
      apiJsonWithAuth<{ following?: boolean; persisted?: boolean }>(
        `/api/v1/users/me/follows/${encodeURIComponent(uid)}`
      )
  });
  const followMut = useMutation({
    mutationFn: async (next: boolean) => {
      if (!accessToken || !sessionPhone || isSelf) return;
      if (next) {
        await apiJsonWithAuth("/api/v1/users/me/follows", {
          method: "POST",
          body: JSON.stringify({ targetUserId: uid })
        });
      } else {
        await apiJsonWithAuth(`/api/v1/users/me/follows/${encodeURIComponent(uid)}`, { method: "DELETE" });
      }
    },
    onSuccess: (_res, _next) => {
      void qc.invalidateQueries({ queryKey: ["follows", "status", uid] });
      void qc.invalidateQueries({ queryKey: ["follows", "list"] });
    }
  });
  const following = Boolean(followStatusQ.data?.following);
  const rows = listingsQ.data?.data ?? [];
  const reviewRows = reviewsQ.data?.data ?? [];
  const renderRows = rows.length > 0 ? rows : isMockDataEnabled() ? SAMPLE_USER_LISTINGS : [];
  const renderReviewRows = reviewRows.length > 0 ? reviewRows : isMockDataEnabled() ? SAMPLE_USER_REVIEWS : [];
  const activeListings = renderRows.filter((r) => !isPastListingStatus(r.status));
  const pastListings = renderRows.filter((r) => isPastListingStatus(r.status));
  const listData = tab === "active" ? activeListings : tab === "past" ? pastListings : [];
  const initials = (p.fullName ?? "Ü")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const openDirectMessage = async () => {
    if (!accessToken || !sessionPhone || !dmTarget || dmTarget === sessionPhone) return;
    setStartingDm(true);
    try {
      const conv = await apiJsonWithAuth<{ id: string; existing?: boolean }>("/api/v1/conversations", {
        method: "POST",
        body: JSON.stringify({ participants: [sessionPhone, dmTarget] })
      });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      const cid = conv?.id?.trim();
      if (!cid) {
        Toast.show({ type: "error", text1: "Sohbet kimliği alınamadı" });
        return;
      }
      if (conv.existing) {
        Toast.show({ type: "info", text1: "Mevcut sohbetiniz açılıyor" });
      }
      appendDemoLog("Mesaj", `${conv.existing ? "Mevcut" : "Yeni"} sohbet — ${cid.slice(0, 12)}`);
      router.push(hrefConversation(cid) as Href);
    } catch (e) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Mesaj başlatılamadı" });
    } finally {
      setStartingDm(false);
    }
  };

  const TabChip = ({ id, label }: { id: typeof tab; label: string }) => {
    const on = tab === id;
    return (
      <Pressable
        onPress={() => setTab(id)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={{
          flex: 1,
          paddingVertical: U.space(1.1),
          borderRadius: U.radius,
          backgroundColor: on ? U.primary : U.surfaceContainerHigh,
          alignItems: "center"
        }}
      >
        <Text style={[T.caption, { fontWeight: "800", color: on ? U.onPrimary : U.text }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <FlatList
      key={tab}
      style={{ flex: 1, backgroundColor: U.bg }}
      contentContainerStyle={{ paddingHorizontal: U.space(2), paddingBottom: insets.bottom + U.space(4), flexGrow: 1 }}
      data={tab === "reviews" ? [] : listData}
      keyExtractor={(item) => item.id}
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={inboxRefreshing} onRefresh={pullRefresh} />}
      ListHeaderComponent={
        <View style={{ marginBottom: U.space(2) }}>
          <ImageBackground
            source={pastoralSplashBg}
            style={{ borderRadius: U.radiusLg, overflow: "hidden", marginBottom: U.space(2), minHeight: U.space(18), ...shadowCard }}
            imageStyle={{ borderRadius: U.radiusLg }}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(26,43,72,0.55)", padding: U.space(2) }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: U.space(14),
                    height: U.space(14),
                    borderRadius: U.space(7),
                    backgroundColor: U.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 3,
                    borderColor: U.limeCta
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: "800", color: U.primary }}>{initials}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: U.space(1.5) }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                    <Text style={[T.title, { color: U.onPrimary, flexShrink: 1 }]} numberOfLines={2}>
                      {p.fullName ?? "Üye"}
                    </Text>
                    {p.verificationStatus ? (
                      <Ionicons name="shield-checkmark" size={18} color={U.limeCta} style={{ marginLeft: 6 }} />
                    ) : null}
                  </View>
                  <Text style={[T.caption, { color: U.onPrimaryMuted, marginTop: 4 }]}>{p.userType ?? "Üretici / satıcı"}</Text>
                  {typeof p.ratingAvg === "number" ? (
                    <Text style={[T.caption, { color: U.onPrimary, marginTop: 6, fontWeight: "700" }]}>
                      ★ {p.ratingAvg.toFixed(1)}
                      {typeof p.ratingCount === "number" ? ` (${p.ratingCount} değerlendirme)` : ""}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </ImageBackground>

          <Text style={[T.caption, { marginBottom: U.space(1.5) }]}>
            Son 30 günde ortalama yanıt ~22 dk; işlem tamamlama oranı örnek veriyle %91 gösterilir.
          </Text>

          {typeof p.trustScore === "number" ? (
            <View style={{ marginBottom: U.space(1.5) }}>
              <TrustBadge score={p.trustScore} backgroundColor={U.secondaryContainer} textColor={U.onSecondaryContainer} />
            </View>
          ) : null}

          {!isSelf ? (
            <View style={{ flexDirection: "row", gap: U.space(1), marginBottom: U.space(1.5) }}>
              {canMessage ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mesaj gönder"
                  onPress={() => void openDirectMessage()}
                  disabled={startingDm}
                  style={{
                    flex: 1,
                    backgroundColor: U.primary,
                    paddingVertical: U.space(1.35),
                    borderRadius: U.radius,
                    alignItems: "center",
                    opacity: startingDm ? 0.65 : 1
                  }}
                >
                  <Text style={[T.body, { color: U.onPrimary, fontWeight: "800" }]}>{startingDm ? "Açılıyor…" : "İletişim"}</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={following ? "Takipten çık" : "Takip et"}
                onPress={() => {
                  if (!accessToken) {
                    Toast.show({ type: "info", text1: "Takip için giriş yapın" });
                    return;
                  }
                  const was = following;
                  if (!accessToken || !sessionPhone) {
                    Toast.show({ type: "info", text1: "Takip için giriş yapın" });
                    return;
                  }
                  void followMut.mutate(!following);
                  appendDemoLog("Takip", was ? "Takipten cikildi" : "Takip edildi");
                  Toast.show({
                    type: "success",
                    text1: was ? "Takipten çıkıldı" : "Takip ediliyor",
                    text2: "Liste: Ayarlar → Takip ettikleriniz"
                  });
                }}
                style={{
                  flex: canMessage ? 1 : 1,
                  backgroundColor: following ? U.secondaryContainer : U.surfaceContainerHigh,
                  paddingVertical: U.space(1.35),
                  borderRadius: U.radius,
                  alignItems: "center",
                  borderWidth: following ? 1 : 0,
                  borderColor: following ? U.secondary : "transparent",
                  opacity: followMut.isPending ? 0.7 : 1
                }}
              >
                <Text
                  style={[
                    T.body,
                    { fontWeight: "800", color: following ? U.onSecondaryContainer : U.text }
                  ]}
                >
                  {following ? "Takiptesiniz" : "Takip et"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!phoneFromUrl && accessToken && peerPhoneQ.isFetching ? (
            <Text style={[T.caption, { marginBottom: U.space(1) }]}>Mesaj seçenekleri yükleniyor…</Text>
          ) : null}

          {accessToken && uid !== sessionPhone ? (
            <Link href={hrefReview(uid)} asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Değerlendir" style={{ marginBottom: U.space(2) }}>
                <Text style={[T.body, { color: U.tertiary, fontWeight: "700" }]}>Bu kullanıcıyı değerlendir →</Text>
              </Pressable>
            </Link>
          ) : null}

          <View style={{ flexDirection: "row", gap: U.space(0.75), marginBottom: U.space(1.5) }}>
            <TabChip id="active" label="Aktif" />
            <TabChip id="past" label="Geçmiş" />
            <TabChip id="reviews" label="Yorumlar" />
          </View>

          {tab !== "reviews" ? (
            listingsQ.isPending ? (
              <ActivityIndicator style={{ marginVertical: U.space(1) }} color={U.primary} />
            ) : listingsQ.isError ? (
              <View style={{ marginBottom: U.space(1) }}>
                <Text style={[T.body, { color: U.danger }]}>İlanlar yüklenemedi</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void listingsQ.refetch()}
                  style={{
                    marginTop: U.space(1),
                    alignSelf: "flex-start",
                    backgroundColor: U.primary,
                    paddingHorizontal: U.space(1.75),
                    paddingVertical: U.space(1),
                    borderRadius: 999
                  }}
                >
                  <Text style={[T.caption, { color: U.onPrimary, fontWeight: "700" }]}>Yeniden dene</Text>
                </Pressable>
              </View>
            ) : rows.length === 0 && isMockDataEnabled() ? (
              <Text style={[T.caption, { marginBottom: U.space(1) }]}>Canlı veri yok; örnek ilanlar kullanılıyor.</Text>
            ) : null
          ) : reviewsQ.isPending ? (
            <ActivityIndicator style={{ marginVertical: U.space(1) }} color={U.primary} />
          ) : reviewsQ.isError ? (
            <View style={{ marginBottom: U.space(1) }}>
              <Text style={[T.body, { color: U.danger }]}>Yorumlar yüklenemedi</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void reviewsQ.refetch()}
                style={{
                  marginTop: U.space(1),
                  alignSelf: "flex-start",
                  backgroundColor: U.primary,
                  paddingHorizontal: U.space(1.75),
                  paddingVertical: U.space(1),
                  borderRadius: 999
                }}
              >
                <Text style={[T.caption, { color: U.onPrimary, fontWeight: "700" }]}>Yeniden dene</Text>
              </Pressable>
            </View>
          ) : reviewRows.length === 0 && isMockDataEnabled() ? (
            <Text style={[T.caption, { marginBottom: U.space(1) }]}>Canlı veri yok; örnek yorumlar aşağıda.</Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Link href={hrefListing(item.id) as Href} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`İlan: ${item.title ?? item.id}`} style={{ marginBottom: U.space(1.25) }}>
            <Card style={{ padding: U.space(2), borderRadius: U.radiusFull }}>
              <Text style={[T.body, { fontWeight: "700" }]}>{item.title ?? item.id}</Text>
              <Text style={[T.caption, { marginTop: U.space(0.5) }]}>
                {item.listingType ?? "-"}{" "}
                {typeof item.price === "number" ? (
                  <Text style={{ color: U.price, fontWeight: "800" }}>· {item.price} TL</Text>
                ) : null}
              </Text>
              {item.status ? (
                <Text style={[T.overline, { marginTop: U.space(0.75), color: U.textMuted }]}>{item.status}</Text>
              ) : null}
            </Card>
          </Pressable>
        </Link>
      )}
      ListEmptyComponent={
        tab === "reviews" ? (
          <View>
            {renderReviewRows.map((rev) => (
              <Card key={rev.id} style={{ padding: U.space(2), borderRadius: U.radiusFull, marginBottom: U.space(1.25) }}>
                <Text style={[T.body, { fontWeight: "700" }]}>
                  {rev.reviewerName ?? "Üye"} · {typeof rev.rating === "number" ? `${rev.rating}/5` : "-"}
                </Text>
                {rev.comment ? <Text style={[T.body, { marginTop: U.space(0.75) }]}>{rev.comment}</Text> : null}
                {rev.sellerReply ? (
                  <Text style={[T.caption, { marginTop: U.space(1) }]}>Satıcı: {rev.sellerReply}</Text>
                ) : null}
              </Card>
            ))}
            {renderReviewRows.length === 0 ? (
              <Text style={[T.body, { textAlign: "center", color: U.textSecondary, paddingVertical: U.space(3) }]}>Henüz yorum yok.</Text>
            ) : null}
          </View>
        ) : (
          <Text style={[T.body, { textAlign: "center", color: U.textSecondary, paddingVertical: U.space(3) }]}>
            {tab === "past" ? "Geçmiş ilan bulunmuyor." : "Aktif ilan bulunmuyor."}
          </Text>
        )
      }
    />
  );
}
