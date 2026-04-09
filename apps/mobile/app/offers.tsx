import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "./components/ui/Card";
import { apiJsonWithAuth } from "./lib/api";
import { isMockDataEnabled, SAMPLE_OFFERS } from "./lib/mockData";
import { hrefConversation, hrefListing } from "./lib/paths";
import { appendDemoLog } from "./store/demoLog";
import { useAuthStore } from "./store/auth";
import { T, U } from "./theme/tokens";

type OfferRow = {
  id: string;
  listingId?: string;
  buyerId?: string;
  sellerId?: string;
  offeredPrice?: number;
  status?: string;
  statusTr?: string;
  counterPrice?: number;
  conversationId?: string;
  createdAt?: string;
};

export default function OffersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { accessToken, userId } = useAuthStore();
  const [tab, setTab] = useState<"received" | "sent">("received");

  const receivedQ = useQuery({
    queryKey: ["offers", "received", userId],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<{ data: OfferRow[] }>("/api/v1/offers/received")
  });

  const sentQ = useQuery({
    queryKey: ["offers", "sent", userId],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<{ data: OfferRow[] }>("/api/v1/offers/sent")
  });

  const [actingId, setActingId] = useState<string | null>(null);

  const rowsPreview = tab === "received" ? receivedQ.data?.data ?? [] : sentQ.data?.data ?? [];
  const renderRowsPreview =
    rowsPreview.length > 0 ? rowsPreview : isMockDataEnabled() ? SAMPLE_OFFERS : [];
  const errPreview = tab === "received" ? receivedQ.isError : sentQ.isError;
  const showFallbackWarningPreview =
    Boolean(accessToken && userId) && errPreview && renderRowsPreview.length > 0;
  const offersTabLogged = useRef<{ received: boolean; sent: boolean }>({ received: false, sent: false });
  useEffect(() => {
    if (!accessToken || !userId || !showFallbackWarningPreview) return;
    const t = tab;
    if (t === "received") {
      if (offersTabLogged.current.received) return;
      offersTabLogged.current.received = true;
    } else {
      if (offersTabLogged.current.sent) return;
      offersTabLogged.current.sent = true;
    }
    appendDemoLog("Teklifler", t === "received" ? "API hatasi; ornek gelen" : "API hatasi; ornek giden");
  }, [accessToken, userId, showFallbackWarningPreview, tab]);

  const act = async (id: string, path: "accept" | "reject", listingId?: string) => {
    if (actingId) return;
    setActingId(id);
    try {
      const result = await apiJsonWithAuth<{ statusTr?: string; conversationId?: string }>(`/api/v1/offers/${id}/${path}`, {
        method: "PUT",
        body: "{}"
      });
      Toast.show({ type: "success", text1: path === "accept" ? "Kabul edildi" : "Reddedildi" });
      appendDemoLog("Teklif", `${path === "accept" ? "Kabul" : "Red"} — ${id.slice(0, 12)}`);
      if (path === "accept" && result?.conversationId) {
        Toast.show({
          type: "info",
          text1: "Sohbet otomatik acildi",
          text2: result.statusTr ? `Durum: ${result.statusTr}` : undefined
        });
        const lid = listingId?.trim() || undefined;
        router.push(hrefConversation(result.conversationId, lid) as Href);
      }
      void qc.invalidateQueries({ queryKey: ["offers"] });
    } catch (e) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Hata" });
    } finally {
      setActingId(null);
    }
  };

  if (!accessToken) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { textAlign: "center", color: U.textSecondary }]}>Teklifler icin giris yapin.</Text>
      </View>
    );
  }

  const rows = tab === "received" ? receivedQ.data?.data ?? [] : sentQ.data?.data ?? [];
  const renderRows = rows.length > 0 ? rows : isMockDataEnabled() ? SAMPLE_OFFERS : [];
  const pending = tab === "received" ? receivedQ.isPending : sentQ.isPending;
  const err = tab === "received" ? receivedQ.isError : sentQ.isError;
  const errMsg =
    tab === "received"
      ? receivedQ.error instanceof Error
        ? receivedQ.error.message
        : "Yüklenemedi"
      : sentQ.error instanceof Error
        ? sentQ.error.message
        : "Yüklenemedi";
  const pullRefreshing = (receivedQ.isFetching || sentQ.isFetching) && !pending;
  const showFallbackWarning = err && renderRows.length > 0;

  const onRefresh = () => {
    void receivedQ.refetch();
    void sentQ.refetch();
  };

  return (
    <View style={{ flex: 1, backgroundColor: U.bg }}>
      <View style={{ backgroundColor: U.surfaceLow, paddingHorizontal: U.space(2), paddingTop: U.space(1), paddingBottom: U.space(1.25) }}>
        <Text style={T.display}>Teklif Yonetimi</Text>
        <Text style={[T.caption, { marginTop: U.space(0.75) }]}>
          Gelen ve giden tekliflerinizi tek ekrandan takip edip hizli aksiyon alin.
        </Text>
      </View>
      <View style={{ flexDirection: "row", paddingHorizontal: U.space(2), marginBottom: U.space(1.5), flexShrink: 0, marginTop: U.space(1) }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === "received" }}
          accessibilityLabel="Gelen teklifler"
          onPress={() => setTab("received")}
          style={{
            flex: 1,
            marginRight: U.space(1),
            paddingVertical: U.space(1.5),
            paddingHorizontal: U.space(1),
            borderRadius: 999,
            backgroundColor: tab === "received" ? U.primary : U.surfaceContainerHigh,
            borderWidth: 0
          }}
        >
          <Text
            style={[T.body, { textAlign: "center", fontWeight: "700", color: tab === "received" ? U.onPrimary : U.text }]}
          >
            Gelen
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === "sent" }}
          accessibilityLabel="Gönderilen teklifler"
          onPress={() => setTab("sent")}
          style={{
            flex: 1,
            paddingVertical: U.space(1.5),
            paddingHorizontal: U.space(1),
            borderRadius: 999,
            backgroundColor: tab === "sent" ? U.primary : U.surfaceContainerHigh,
            borderWidth: 0
          }}
        >
          <Text style={[T.body, { textAlign: "center", fontWeight: "700", color: tab === "sent" ? U.onPrimary : U.text }]}>
            Giden
          </Text>
        </Pressable>
      </View>
      {showFallbackWarning ? (
        <View style={{ paddingHorizontal: U.space(2), paddingBottom: U.space(1) }}>
          <Text style={[T.caption, { color: U.warnText, fontWeight: "600" }]}>
            Canli teklif verisine ulasilamadi, test icin ornek teklifler gosteriliyor.
          </Text>
        </View>
      ) : null}
      {pending ? (
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: U.bg }}>
          <ActivityIndicator color={U.primary} />
        </View>
      ) : err && renderRows.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
          <Text style={[T.body, { color: U.danger, textAlign: "center" }]}>{errMsg}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Teklifleri yeniden yükle"
            onPress={onRefresh}
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
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={renderRows}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(3), flexGrow: 1 }}
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={[T.caption, { color: U.textMuted }]}>Teklif kaydi bulunamadi.</Text>}
          renderItem={({ item: o }) => (
            <Card style={{ padding: U.space(2), marginBottom: U.space(1.25), borderRadius: U.radiusFull }}>
              {o.listingId ? (
                <Link href={hrefListing(o.listingId) as Href} asChild>
                  <Pressable accessibilityRole="button" accessibilityLabel={`İlana git, ilan ${o.listingId.slice(0, 8)}`}>
                    <Text style={[T.body, { fontWeight: "700", color: U.tertiary }]}>
                      Ilana git · {o.listingId.slice(0, 8)}…
                    </Text>
                  </Pressable>
                </Link>
              ) : (
                <Text style={[T.body, { fontWeight: "700" }]}>Teklif · {o.id.slice(0, 12)}…</Text>
              )}
              <Text style={[T.caption, { marginTop: U.space(0.75) }]}>
                <Text style={{ color: U.secondary, fontWeight: "700" }}>
                  {typeof o.offeredPrice === "number" ? `${o.offeredPrice} TL` : "-"}
                </Text>
                {" · "}
                {o.statusTr ?? o.status ?? "-"}
              </Text>
              {o.counterPrice != null ? (
                <Text style={[T.caption, { marginTop: U.space(0.5), color: U.tertiary, fontWeight: "600" }]}>
                  Karsi teklif: {o.counterPrice} TL
                </Text>
              ) : null}
              {o.conversationId ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bu teklif için sohbeti aç"
                  onPress={() => router.push(hrefConversation(o.conversationId!, o.listingId) as Href)}
                  style={{
                    marginTop: U.space(1),
                    alignSelf: "flex-start",
                    backgroundColor: U.surfaceContainer,
                    borderWidth: 0,
                    paddingHorizontal: U.space(1.5),
                    paddingVertical: U.space(1),
                    borderRadius: 999
                  }}
                >
                  <Text style={[T.caption, { color: U.tertiary, fontWeight: "700" }]}>Sohbete git</Text>
                </Pressable>
              ) : null}
              {o.createdAt ? (
                <Text style={[T.caption, { marginTop: U.space(0.75), color: U.textMuted }]}>
                  {new Date(o.createdAt).toLocaleString("tr-TR")}
                </Text>
              ) : null}
              {tab === "received" && o.status === "pending" ? (
                <View style={{ flexDirection: "row", marginTop: U.space(1.25), gap: U.space(1) }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Teklifi kabul et"
                    onPress={() => void act(o.id, "accept", o.listingId)}
                    disabled={actingId === o.id}
                    style={{
                      flex: 1,
                      backgroundColor: actingId === o.id ? U.surfaceContainer : U.secondaryContainer,
                      paddingVertical: U.space(1.25),
                      borderRadius: U.radius
                    }}
                  >
                    <Text style={[T.body, { textAlign: "center", fontWeight: "700", color: U.onSecondaryContainer }]}>
                      {actingId === o.id ? "…" : "Kabul"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Teklifi reddet"
                    onPress={() => void act(o.id, "reject")}
                    disabled={actingId === o.id}
                    style={{
                      flex: 1,
                      backgroundColor: actingId === o.id ? U.surfaceContainer : U.dangerSoft,
                      paddingVertical: U.space(1.25),
                      borderRadius: U.radius
                    }}
                  >
                    <Text style={[T.body, { textAlign: "center", fontWeight: "700", color: U.danger }]}>
                      {actingId === o.id ? "…" : "Red"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}
