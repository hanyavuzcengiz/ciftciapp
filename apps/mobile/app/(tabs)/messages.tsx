import { Link } from "expo-router";
import type { Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { maskPhone } from "@agromarket/shared-utils";
import { Avatar } from "../components/ui/Avatar";
import { Card } from "../components/ui/Card";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { StateCard, StateSkeleton } from "../components/RequestStates";
import { apiJsonWithAuth } from "../lib/api";
import { isMockDataEnabled, SAMPLE_CONVERSATIONS } from "../lib/mockData";
import { hrefConversation } from "../lib/paths";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

type Conv = {
  id: string;
  participants?: string[];
  listingId?: string;
  createdAt?: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string;
};

function peerLabel(me: string | null, participants?: string[]): string {
  if (!participants?.length || !me) return "?";
  const others = participants.filter((p) => p !== me);
  if (others.length === 1) return maskPhone(others[0]!);
  if (others.length > 1) return `${others.length} kisi`;
  return maskPhone(participants[0]!);
}

function formatChatTime(iso: string | null | undefined, fallbackIso?: string): string {
  const raw = iso ?? fallbackIso;
  if (!raw) return "";
  const d = new Date(raw);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken, userId } = useAuthStore();
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["conversations", userId],
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiJsonWithAuth<{ data: Conv[] }>("/api/v1/conversations")
  });

  const rowsEarly = data?.data ?? [];
  const renderRowsEarly =
    rowsEarly.length > 0 ? rowsEarly : isMockDataEnabled() ? SAMPLE_CONVERSATIONS : [];
  const showFallbackWarning =
    Boolean(accessToken && userId) && !isPending && isError && renderRowsEarly.length > 0;
  const msgFallbackLogged = useRef(false);
  useEffect(() => {
    if (!showFallbackWarning || msgFallbackLogged.current) return;
    msgFallbackLogged.current = true;
    appendDemoLog("Mesajlar", "API hatasi; ornek konusmalar");
  }, [showFallbackWarning]);

  if (!accessToken) {
    return (
      <View style={{ flex: 1, backgroundColor: U.bg, padding: U.space(2), justifyContent: "center" }}>
        <StateCard title="Giris gerekli" description="Mesajlari gormek icin giris yapin." style={{ marginTop: 0 }} />
      </View>
    );
  }

  if (isPending) {
    return (
      <View testID="e2e-messages-screen" style={{ flex: 1, backgroundColor: U.bg }}>
        <View style={{ backgroundColor: U.surfaceLow, paddingBottom: U.space(0.5) }}>
          <ScreenHeader title="Mesajlar" />
        </View>
        <StateSkeleton count={6} />
      </View>
    );
  }

  const rows = data?.data ?? [];
  const renderRows = rows.length > 0 ? rows : isMockDataEnabled() ? SAMPLE_CONVERSATIONS : [];

  return (
    <View testID="e2e-messages-screen" style={{ flex: 1, backgroundColor: U.bg }}>
      <View style={{ backgroundColor: U.surfaceLow, paddingBottom: U.space(0.5) }}>
        <ScreenHeader title="Mesajlar" warning={isError ? "Baglanti koptu — ornek liste." : undefined} />
      </View>
      <FlatList
        contentContainerStyle={{
          paddingBottom: insets.bottom + U.space(2),
          flexGrow: 1,
          paddingHorizontal: U.space(2),
          paddingTop: U.space(1)
        }}
        data={renderRows}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={isFetching && !isPending} onRefresh={() => void refetch()} />}
        ListEmptyComponent={<StateCard title="Henuz mesaj yok." description="Bir ilana soru yazinca burada gorunur." />}
        renderItem={({ item }) => {
          const title = item.listingId ? `Ilan #${item.listingId.slice(0, 6)}` : "Sohbet";
          const peer = peerLabel(userId, item.participants);
          const preview = item.lastMessagePreview?.trim() || "Mesaj yok";
          const time = formatChatTime(item.lastMessageAt, item.createdAt);

          return (
            <Link href={hrefConversation(item.id, item.listingId) as Href} asChild>
              <Pressable accessibilityRole="button" style={{ marginBottom: U.space(1.25) }}>
                <Card style={{ padding: 0, borderRadius: U.radiusFull }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: U.space(1.5),
                      paddingHorizontal: U.space(2)
                    }}
                  >
                    <Avatar label={peer} size={52} />
                    <View style={{ flex: 1, marginLeft: U.space(1.5), minWidth: 0 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: U.space(1) }}>
                        <Text style={[T.body, { fontWeight: "700", flex: 1 }]} numberOfLines={1}>
                          {peer}
                        </Text>
                        {time ? (
                          <Text style={[T.caption, { color: U.textMuted }]}>{time}</Text>
                        ) : null}
                      </View>
                      <Text style={[T.caption, { marginTop: U.space(0.75), color: U.textSecondary }]} numberOfLines={2}>
                        <Text style={{ color: U.tertiary, fontWeight: "600" }}>{title}</Text>
                        {" · "}
                        {preview}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}
