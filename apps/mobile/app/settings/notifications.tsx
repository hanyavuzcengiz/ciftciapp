import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "../components/ui/Card";
import { apiJsonWithAuth } from "../lib/api";
import { isMockDataEnabled, SAMPLE_NOTIFICATIONS } from "../lib/mockData";
import { hrefConversation, hrefListing } from "../lib/paths";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

type Row = {
  id: string;
  title?: string;
  body?: string;
  category?: string;
  createdAt?: string;
  readAt?: string | null;
  listingId?: string | null;
  conversationId?: string | null;
};
const CATEGORY_FILTERS = [
  { key: "all", label: "Tum" },
  { key: "Teklif", label: "Teklif" },
  { key: "Mesaj", label: "Mesaj" },
  { key: "Performans", label: "Performans" }
] as const;
const FILTER_STORAGE_PREFIX = "notifications.filters";

export default function NotificationInboxScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken, userId } = useAuthStore();
  const qc = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_FILTERS)[number]["key"]>("all");
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  useEffect(() => {
    const run = async () => {
      if (!userId) {
        setFiltersHydrated(true);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(`${FILTER_STORAGE_PREFIX}.${userId}`);
        if (!raw) {
          setFiltersHydrated(true);
          return;
        }
        const parsed = JSON.parse(raw) as { onlyUnread?: boolean; categoryFilter?: string };
        if (typeof parsed.onlyUnread === "boolean") setOnlyUnread(parsed.onlyUnread);
        if (
          typeof parsed.categoryFilter === "string" &&
          CATEGORY_FILTERS.some((c) => c.key === parsed.categoryFilter)
        ) {
          setCategoryFilter(parsed.categoryFilter as (typeof CATEGORY_FILTERS)[number]["key"]);
        }
      } finally {
        setFiltersHydrated(true);
      }
    };
    void run();
  }, [userId]);

  useEffect(() => {
    const run = async () => {
      if (!userId || !filtersHydrated) return;
      await AsyncStorage.setItem(
        `${FILTER_STORAGE_PREFIX}.${userId}`,
        JSON.stringify({ onlyUnread, categoryFilter })
      );
    };
    void run();
  }, [userId, filtersHydrated, onlyUnread, categoryFilter]);

  const q = useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<{ data: Row[] }>("/api/v1/notifications?limit=50")
  });

  const notifRows = q.data?.data ?? [];
  const notifFallbackRows =
    notifRows.length > 0 ? notifRows : isMockDataEnabled() ? SAMPLE_NOTIFICATIONS : [];
  const showNotifFallbackWarning =
    Boolean(accessToken && userId && filtersHydrated && !q.isPending) && q.isError && notifFallbackRows.length > 0;
  const notifFallbackLogged = useRef(false);
  useEffect(() => {
    if (!showNotifFallbackWarning || notifFallbackLogged.current) return;
    notifFallbackLogged.current = true;
    appendDemoLog("Bildirimler", "API hatasi; ornek kayitlar");
  }, [showNotifFallbackWarning]);

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiJsonWithAuth(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", body: "{}" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications", userId] })
  });

  if (!accessToken) {
    return (
      <View style={{ flex: 1, padding: U.space(2), backgroundColor: U.bg, justifyContent: "center" }}>
        <Text style={[T.body, { color: U.textSecondary, textAlign: "center" }]}>
          Bildirimleri görmek için giriş yapın.
        </Text>
      </View>
    );
  }

  if (!filtersHydrated || q.isPending) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: U.bg }}>
        <ActivityIndicator color={U.primary} />
      </View>
    );
  }

  const rows = q.data?.data ?? [];
  const fallbackRows = rows.length > 0 ? rows : isMockDataEnabled() ? SAMPLE_NOTIFICATIONS : [];
  const showFallbackWarning = q.isError && fallbackRows.length > 0;
  if (q.isError && fallbackRows.length === 0) {
    const msg = q.error instanceof Error ? q.error.message : "Liste yüklenemedi";
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { color: U.danger, textAlign: "center" }]}>{msg}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bildirimleri yeniden yükle"
          onPress={() => void q.refetch()}
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

  const unreadCount = rows.filter((r) => !r.readAt).length;
  const renderRows = useMemo(() => {
    const byUnread = onlyUnread ? fallbackRows.filter((r) => !r.readAt) : fallbackRows;
    if (categoryFilter === "all") return byUnread;
    return byUnread.filter((r) => (r.category ?? "").toLocaleLowerCase("tr-TR") === categoryFilter.toLocaleLowerCase("tr-TR"));
  }, [fallbackRows, onlyUnread, categoryFilter]);

  const markAllAsRead = async () => {
    if (markingAll) return;
    const unreadRows = rows.filter((r) => !r.readAt);
    if (unreadRows.length === 0) return;
    setMarkingAll(true);
    try {
      await Promise.all(
        unreadRows.map((item) =>
          apiJsonWithAuth(`/api/v1/notifications/${encodeURIComponent(item.id)}/read`, {
            method: "PATCH",
            body: "{}"
          })
        )
      );
      await qc.invalidateQueries({ queryKey: ["notifications", userId] });
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: U.bg }}>
      <View style={{ backgroundColor: U.surfaceLow, paddingHorizontal: U.space(2), paddingTop: U.space(2), paddingBottom: U.space(1) }}>
        <Text style={T.display}>Bildirim Merkezi</Text>
        <Text style={[T.caption, { marginTop: U.space(0.75) }]}>
          Sohbet, teklif ve sistem olaylarini buradan takip edin. Bildirime dokununca ilgili ekran acilir.
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: U.space(2),
          paddingBottom: U.space(1),
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: U.space(1)
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sadece okunmamis bildirimleri goster"
          onPress={() => setOnlyUnread((v) => !v)}
          style={{
            backgroundColor: onlyUnread ? U.primary : U.surfaceContainerHigh,
            borderWidth: 0,
            borderRadius: 999,
            paddingHorizontal: U.space(1.5),
            paddingVertical: U.space(1)
          }}
        >
          <Text style={[T.caption, { color: onlyUnread ? U.onPrimary : U.text, fontWeight: "700" }]}>
            {onlyUnread ? "Okunmamis: Acik" : "Okunmamis: Kapali"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tum bildirimleri okundu yap"
          onPress={() => void markAllAsRead()}
          disabled={markingAll || unreadCount === 0}
          style={{
            backgroundColor: markingAll || unreadCount === 0 ? U.surfaceContainer : U.tertiary,
            borderRadius: 999,
            paddingHorizontal: U.space(1.5),
            paddingVertical: U.space(1)
          }}
        >
          <Text style={[T.caption, { color: markingAll || unreadCount === 0 ? U.textMuted : U.onPrimary, fontWeight: "700" }]}>
            {markingAll ? "Isleniyor..." : `Tumunu okundu yap (${unreadCount})`}
          </Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: U.space(2), paddingBottom: U.space(1.25) }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: U.space(1) }}>
          {CATEGORY_FILTERS.map((f) => {
            const on = categoryFilter === f.key;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityLabel={`Kategori filtresi ${f.label}`}
                onPress={() => setCategoryFilter(f.key)}
                style={{
                  backgroundColor: on ? U.primary : U.surfaceContainerHigh,
                  borderWidth: 0,
                  borderRadius: 999,
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(0.75)
                }}
              >
                <Text style={[T.caption, { color: on ? U.onPrimary : U.text, fontWeight: "700" }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {showFallbackWarning ? (
        <View style={{ paddingHorizontal: U.space(2), paddingBottom: U.space(1) }}>
          <Text style={[T.caption, { color: U.warnText, fontWeight: "600" }]}>
            Baglanti sorunu var, test icin ornek bildirimler gosteriliyor.
          </Text>
        </View>
      ) : null}
      <FlatList
        contentContainerStyle={{ padding: U.space(2), paddingTop: 0, paddingBottom: insets.bottom + U.space(2), flexGrow: 1 }}
        data={renderRows}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isPending} onRefresh={() => void q.refetch()} />
        }
        ListEmptyComponent={<Text style={[T.caption, { color: U.textMuted }]}>Bildirim bulunamadi.</Text>}
        renderItem={({ item }) => (
          <Card
            style={{
              padding: U.space(2),
              marginBottom: U.space(1.25),
              borderRadius: U.radiusFull,
              backgroundColor: item.readAt ? U.surface : U.surfaceLow
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                item.readAt
                  ? (item.title ?? "Bildirim")
                  : `Okunmamış bildirim: ${item.title ?? "Bildirim"}`
              }
              onPress={() => {
                if (!item.readAt) void markRead.mutate(item.id);
                const cid = item.conversationId?.trim();
                const lid = item.listingId?.trim();
                if (cid) {
                  router.push(hrefConversation(cid, lid || undefined) as Href);
                  return;
                }
                if (lid) {
                  router.push(hrefListing(lid) as Href);
                }
              }}
            >
              <Text style={[T.body, { fontWeight: "700" }]}>{item.title ?? "Bildirim"}</Text>
              <Text style={[T.caption, { marginTop: U.space(0.5), color: U.textMuted }]}>{item.category ?? ""}</Text>
              <Text style={[T.body, { marginTop: U.space(1) }]}>{item.body}</Text>
              {item.createdAt ? (
                <Text style={[T.caption, { marginTop: U.space(1), color: U.textMuted }]}>
                  {new Date(item.createdAt).toLocaleString("tr-TR")}
                </Text>
              ) : null}
            </Pressable>
            <View style={{ flexDirection: "row", marginTop: U.space(1.25), gap: U.space(1), flexWrap: "wrap" }}>
              {item.conversationId ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sohbete git"
                  onPress={() => {
                    if (!item.readAt) void markRead.mutate(item.id);
                    router.push(
                      hrefConversation(item.conversationId!.trim(), item.listingId?.trim() ?? undefined) as Href
                    );
                  }}
                  style={{
                    backgroundColor: U.primary,
                    borderRadius: 999,
                    paddingHorizontal: U.space(1.5),
                    paddingVertical: U.space(1)
                  }}
                >
                  <Text style={[T.caption, { color: U.onPrimary, fontWeight: "700" }]}>Sohbete git</Text>
                </Pressable>
              ) : null}
              {item.listingId ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="İlana git"
                  onPress={() => {
                    if (!item.readAt) void markRead.mutate(item.id);
                    router.push(hrefListing(item.listingId!.trim()) as Href);
                  }}
                  style={{
                    backgroundColor: U.surfaceContainer,
                    borderRadius: 999,
                    paddingHorizontal: U.space(1.5),
                    paddingVertical: U.space(1),
                    borderWidth: 0
                  }}
                >
                  <Text style={[T.caption, { color: U.tertiary, fontWeight: "700" }]}>Ilana git</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        )}
      />
    </View>
  );
}
