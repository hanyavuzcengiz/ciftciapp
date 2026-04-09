import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View
} from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiJson, apiJsonWithAuth } from "../lib/api";
import { StateCard, StateNotice } from "../components/RequestStates";
import { buildSampleMessages, isMockDataEnabled } from "../lib/mockData";
import { hrefListing } from "../lib/paths";
import { tryDecodeURIComponent } from "../lib/safeDecode";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U, shadowCard } from "../theme/tokens";

type MessageRow = { id: string; senderId?: string; content?: string; createdAt?: string };

type MessagesPage = { data: MessageRow[]; nextCursor: string | null };

type ListingCtx = {
  id: string;
  title?: string;
  price?: number;
  imageUrl?: string;
  city?: string;
  district?: string;
};

function looksLikeOffer(content: string): boolean {
  const c = content.toLowerCase();
  return /\d[\d.\s]*\s*(tl|try|₺)/i.test(content) || c.includes("teklif") || c.includes("fiyat");
}

function bubbleTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: idParam, listingId: listingIdParam } = useLocalSearchParams<{ id?: string | string[]; listingId?: string | string[] }>();
  const rawConv = (Array.isArray(idParam) ? idParam[0] : idParam)?.trim() ?? "";
  const convId = rawConv ? tryDecodeURIComponent(rawConv) : "";
  const rawListing = Array.isArray(listingIdParam) ? listingIdParam[0] : listingIdParam;
  const listingId = rawListing?.trim() ? tryDecodeURIComponent(rawListing.trim()) : "";
  const { accessToken, userId } = useAuthStore();
  const [text, setText] = useState("");
  const qc = useQueryClient();

  const listingQ = useQuery({
    queryKey: ["listing", "conversation-ctx", listingId],
    enabled: Boolean(listingId),
    queryFn: () => apiJson<ListingCtx>(`/api/v1/listings/${encodeURIComponent(listingId)}`)
  });

  const listingCtx: ListingCtx | null = !listingId
    ? null
    : listingQ.data
      ? listingQ.data
      : listingQ.isPending
        ? null
        : isMockDataEnabled()
          ? {
              id: listingId,
              title: "Bu ilan hakkinda yaziyorsunuz",
              price: 2450000,
              city: "Konya",
              district: "Selcuklu"
            }
          : { id: listingId, title: "Ilan ozeti" };

  const {
    data,
    isPending,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ["messages", convId],
    enabled: Boolean(accessToken && userId && convId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiJsonWithAuth<MessagesPage>(
        pageParam
          ? `/api/v1/conversations/${convId}/messages?cursor=${encodeURIComponent(pageParam)}`
          : `/api/v1/conversations/${convId}/messages`
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined
  });

  const chronologicalAsc = useMemo(() => {
    const pages = data?.pages ?? [];
    const merged = pages
      .slice()
      .reverse()
      .flatMap((p) => p.data);
    const seen = new Set<string>();
    return merged.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [data?.pages]);

  const listData = useMemo(() => [...chronologicalAsc].reverse(), [chronologicalAsc]);
  const renderData = listData.length > 0 ? listData : isMockDataEnabled() ? buildSampleMessages(userId) : [];
  const showEmptyThreadSamples =
    Boolean(accessToken && userId && convId) &&
    !isPending &&
    !isError &&
    listData.length === 0 &&
    isMockDataEnabled() &&
    renderData.length > 0;
  const convEmptyLogged = useRef<string | null>(null);
  useEffect(() => {
    if (!showEmptyThreadSamples) return;
    if (convEmptyLogged.current === convId) return;
    convEmptyLogged.current = convId;
    appendDemoLog("Sohbet", "Bos konusma; ornek mesajlar");
  }, [showEmptyThreadSamples, convId]);

  const send = useMutation({
    mutationFn: async () => {
      await apiJsonWithAuth(`/api/v1/conversations/${convId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: text.trim(), message_type: "text" })
      });
    },
    onSuccess: () => {
      setText("");
      appendDemoLog("Sohbet", `Mesaj gonderildi — ${convId.slice(0, 12)}`);
      void qc.invalidateQueries({ queryKey: ["messages", convId] });
    },
    onError: (e) => Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Gonderilemedi" })
  });

  if (!accessToken) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { textAlign: "center", color: U.textSecondary }]}>Giris gerekli.</Text>
      </View>
    );
  }

  if (!convId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { textAlign: "center", color: U.textSecondary }]}>Gecersiz baglanti.</Text>
      </View>
    );
  }

  const showLoader = isPending && listData.length === 0 && !isError;
  const showError = isError && listData.length === 0;
  const errMsg = error instanceof Error ? error.message : "Mesajlar yuklenemedi";

  const listingStrip =
    listingId && listingQ.isPending && !listingQ.data ? (
      <View style={{ padding: U.space(2), backgroundColor: U.surface, borderBottomWidth: 1, borderBottomColor: U.surfaceContainer }}>
        <ActivityIndicator color={U.primary} />
      </View>
    ) : listingId && listingCtx ? (
      <Link href={hrefListing(listingCtx.id) as Href} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ilan detayina git"
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: U.space(2),
            paddingVertical: U.space(1.25),
            backgroundColor: U.surface,
            borderBottomWidth: 1,
            borderBottomColor: U.surfaceContainer,
            ...shadowCard
          }}
        >
          {typeof listingCtx.imageUrl === "string" ? (
            <Image source={{ uri: listingCtx.imageUrl }} style={{ width: U.space(11), height: U.space(11), borderRadius: U.radius, backgroundColor: U.surfaceContainer }} />
          ) : (
            <View
              style={{
                width: U.space(11),
                height: U.space(11),
                borderRadius: U.radius,
                backgroundColor: U.surfaceTint,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="pricetag-outline" size={22} color={U.primary} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: U.space(1.5) }}>
            <Text style={[T.caption, { color: U.textMuted }]}>Konusulan ilan</Text>
            <Text style={[T.body, { fontWeight: "700", marginTop: 2 }]} numberOfLines={2}>
              {listingCtx.title ?? listingCtx.id}
            </Text>
            <Text style={[T.caption, { marginTop: 4, color: U.price, fontWeight: "800" }]}>
              {typeof listingCtx.price === "number" ? `₺${Math.round(listingCtx.price).toLocaleString("tr-TR")}` : "Fiyat sor"}
              {listingCtx.city ? ` · ${listingCtx.city}` : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={U.textMuted} />
        </Pressable>
      </Link>
    ) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: U.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View style={{ flex: 1 }}>
        {listingStrip}
        {showLoader ? (
          <View style={{ flex: 1, justifyContent: "center", backgroundColor: U.bg }}>
            <ActivityIndicator color={U.primary} />
          </View>
        ) : showError ? (
          <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
            <StateCard title="Mesajlar yuklenemedi" description={errMsg} actionLabel="Yeniden dene" onAction={() => void refetch()} />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            inverted
            contentContainerStyle={{ padding: U.space(1.5), paddingBottom: insets.bottom + U.space(10), flexGrow: 1 }}
            data={renderData}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isPending && !isFetchingNextPage}
                onRefresh={() => void refetch()}
              />
            }
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            onEndReachedThreshold={0.2}
            ListFooterComponent={
              isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: U.space(1.5) }} color={U.primary} /> : null
            }
            ListEmptyComponent={<StateCard title="Mesaj yok" description="Asagidan yazin." />}
            renderItem={({ item }) => {
              const mine = item.senderId === userId;
              const offer = looksLikeOffer(item.content ?? "");
              const bg = offer ? U.warnBg : mine ? U.primary : U.surface;
              const fg = offer ? U.warnText : mine ? U.onPrimary : U.text;
              const border = offer ? U.warnBorder : "transparent";

              return (
                <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", marginBottom: U.space(1.5) }}>
                  {offer ? (
                    <StateNotice
                      text="Teklif / fiyat"
                      tone="warning"
                      style={{
                        marginBottom: U.space(0.5),
                        marginLeft: mine ? 0 : U.space(0.5),
                        alignSelf: mine ? "flex-end" : "flex-start",
                        marginTop: 0
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      backgroundColor: bg,
                      paddingHorizontal: U.space(1.75),
                      paddingVertical: U.space(1.25),
                      borderRadius: U.radiusLg,
                      borderBottomRightRadius: mine ? U.space(0.5) : U.radiusLg,
                      borderBottomLeftRadius: mine ? U.radiusLg : U.space(0.5),
                      borderWidth: offer ? 1 : 0,
                      borderColor: border
                    }}
                  >
                    <Text style={[T.body, { color: offer ? U.text : fg }]}>{item.content}</Text>
                    <Text
                      style={[
                        T.caption,
                        {
                          marginTop: U.space(0.75),
                          fontSize: 11,
                          alignSelf: "flex-end",
                          color: offer ? U.textMuted : mine ? U.onPrimaryMuted : U.textMuted
                        }
                      ]}
                    >
                      {bubbleTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: U.space(2),
            paddingTop: U.space(1),
            paddingBottom: insets.bottom + U.space(1),
            backgroundColor: U.surface,
            borderTopWidth: 0,
            ...shadowCard
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Mesaj yazin..."
            placeholderTextColor={U.textMuted}
            accessibilityLabel="Mesaj"
            returnKeyType="default"
            blurOnSubmit={false}
            multiline
            maxLength={2000}
            onSubmitEditing={() => {
              if (text.trim() && !send.isPending) void send.mutate();
            }}
            style={{
              flex: 1,
              maxHeight: U.space(15),
              borderWidth: 0,
              borderRadius: 999,
              paddingHorizontal: U.space(2),
              paddingVertical: U.space(1.5),
              fontSize: 15,
              color: U.text,
              backgroundColor: U.surfaceContainerHigh
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gonder"
            onPress={() => {
              if (text.trim() && !send.isPending) void send.mutate();
            }}
            disabled={send.isPending}
            style={{
              marginLeft: U.space(1),
              width: U.space(5.5),
              height: U.space(5.5),
              borderRadius: U.space(2.75),
              backgroundColor: send.isPending ? U.textMuted : U.primary,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: U.onPrimary, fontSize: 18, fontWeight: "700" }}>↑</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
