import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiJson, getUiErrorMessage } from "../lib/api";
import { StateCard, StateNotice, StateSkeleton, TryAgainState } from "../components/RequestStates";
import { Card } from "../components/ui/Card";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { isMockDataEnabled, SAMPLE_SEARCH_RESULTS } from "../lib/mockData";
import { hrefListing, hrefOffer, hrefUser } from "../lib/paths";
import { appendDemoLog } from "../store/demoLog";
import { T, U } from "../theme/tokens";

type SearchRow = {
  id: string;
  title?: string;
  price?: number;
  listingType?: string;
  city?: string;
  district?: string;
  condition?: "new" | "second_hand" | "organic";
  sellerRating?: number;
  userId?: string;
  authorUuid?: string | null;
};
type SearchResponse = { data: SearchRow[]; nextCursor: string | null };

const LISTING_TYPES = [
  { key: "" as const, label: "Tümü" },
  { key: "sell" as const, label: "Satış" },
  { key: "buy" as const, label: "Alış" },
  { key: "rent" as const, label: "Kiralama" },
  { key: "service" as const, label: "Hizmet" }
];
const POPULAR_CATEGORIES = [
  { key: "traktor", label: "Traktor", icon: "🚜" },
  { key: "tohum", label: "Tohum", icon: "🌱" },
  { key: "gubre", label: "Gubre", icon: "🧪" },
  { key: "hayvancilik", label: "Hayvancilik", icon: "🐄" }
] as const;
const CONDITIONS = [
  { key: "", label: "Durum" },
  { key: "new", label: "Sifir" },
  { key: "second_hand", label: "Ikinci El" },
  { key: "organic", label: "Organik" }
] as const;

function sellerParam(item: SearchRow): string | null {
  const u = item.authorUuid?.trim();
  if (u) return u;
  const p = item.userId?.trim();
  return p || null;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [listingType, setListingType] = useState<(typeof LISTING_TYPES)[number]["key"]>("");
  const [categorySlug, setCategorySlug] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [condition, setCondition] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const baseParams = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (listingType) p.set("listing_type", listingType);
    if (categorySlug) p.set("category_slug", categorySlug);
    if (city.trim()) p.set("city", city.trim());
    if (district.trim()) p.set("district", district.trim());
    if (condition) p.set("condition", condition);
    if (minPrice.trim()) p.set("min_price", minPrice.trim());
    if (maxPrice.trim()) p.set("max_price", maxPrice.trim());
    p.set("limit", "20");
    return p.toString();
  }, [debouncedQ, listingType, categorySlug, city, district, condition, minPrice, maxPrice]);

  const {
    data,
    isFetching,
    isPending,
    isFetchingNextPage,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ["search", "listings", baseParams],
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams(baseParams);
      if (pageParam) p.set("cursor", pageParam);
      return apiJson<SearchResponse>(`/api/v1/search/listings?${p.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined
  });

  const items = useMemo(() => {
    const pages = data?.pages ?? [];
    const seen = new Set<string>();
    const out: SearchRow[] = [];
    for (const page of pages) {
      for (const row of page.data) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  }, [data?.pages]);

  const onRefresh = useCallback(() => void refetch(), [refetch]);
  const renderItems = items.length > 0 ? items : isMockDataEnabled() ? SAMPLE_SEARCH_RESULTS : [];
  const uiError = getUiErrorMessage(error);
  const showFallbackWarning = isError && renderItems.length > 0;
  const searchFallbackLogged = useRef(false);
  useEffect(() => {
    if (!showFallbackWarning || searchFallbackLogged.current) return;
    searchFallbackLogged.current = true;
    appendDemoLog("Arama", "API hatasi; ornek sonuclar gosterildi");
  }, [showFallbackWarning]);

  return (
    <View style={{ flex: 1, backgroundColor: U.bg }}>
      <View style={{ flexShrink: 0, backgroundColor: U.surfaceLow, paddingHorizontal: U.space(2), paddingBottom: U.space(1.5) }}>
        <ScreenHeader title="Ilan ara" subtitle="Kisa kelime yazin. Geri kalan filtreler opsiyonel." />
        <TextInput
          testID="e2e-search-input"
          value={q}
          onChangeText={setQ}
          placeholder="Ornek: traktor, tohum..."
          placeholderTextColor={U.textMuted}
          returnKeyType="search"
          onSubmitEditing={() => void refetch()}
          style={{
            marginTop: U.space(1.5),
            borderWidth: 0,
            backgroundColor: U.surfaceContainerHigh,
            borderRadius: 999,
            paddingHorizontal: U.space(2),
            paddingVertical: U.space(1.5),
            fontSize: 15,
            color: U.text
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: U.space(1.25) }}>
          {POPULAR_CATEGORIES.map((c) => {
            const on = categorySlug === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setCategorySlug((prev) => (prev === c.key ? "" : c.key))}
                style={{
                  marginRight: U.space(1.25),
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(1),
                  borderRadius: 999,
                  backgroundColor: on ? U.primary : U.surfaceContainerHigh,
                  borderWidth: 0
                }}
              >
                <Text style={[T.caption, { color: on ? U.onPrimary : U.text, fontWeight: "600" }]}>{c.icon} {c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: U.space(1.25) }}>
          {LISTING_TYPES.map((opt) => {
            const on = listingType === opt.key;
            return (
              <Pressable
                key={opt.key || "all"}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`İlan türü filtresi: ${opt.label}`}
                onPress={() => setListingType(opt.key)}
                style={{
                  marginRight: U.space(1),
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(1),
                  borderRadius: 999,
                  backgroundColor: on ? U.primary : U.surfaceContainerHigh,
                  borderWidth: 0
                }}
              >
                <Text style={[T.caption, { fontWeight: "600", color: on ? U.onPrimary : U.text }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: "row", marginTop: U.space(1.25) }}>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Il"
            placeholderTextColor={U.textMuted}
            style={{
              flex: 1,
              borderWidth: 0,
              backgroundColor: U.surfaceContainerHigh,
              borderRadius: U.radius,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(1.25),
              marginRight: U.space(1)
            }}
          />
          <TextInput
            value={district}
            onChangeText={setDistrict}
            placeholder="Ilce"
            placeholderTextColor={U.textMuted}
            style={{
              flex: 1,
              borderWidth: 0,
              backgroundColor: U.surfaceContainerHigh,
              borderRadius: U.radius,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(1.25)
            }}
          />
        </View>
        <View style={{ flexDirection: "row", marginTop: U.space(1.25) }}>
          <TextInput
            value={minPrice}
            onChangeText={setMinPrice}
            placeholder="Min fiyat"
            keyboardType="number-pad"
            placeholderTextColor={U.textMuted}
            style={{
              flex: 1,
              borderWidth: 0,
              backgroundColor: U.surfaceContainerHigh,
              borderRadius: U.radius,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(1.25),
              marginRight: U.space(1)
            }}
          />
          <TextInput
            value={maxPrice}
            onChangeText={setMaxPrice}
            placeholder="Max fiyat"
            keyboardType="number-pad"
            placeholderTextColor={U.textMuted}
            style={{
              flex: 1,
              borderWidth: 0,
              backgroundColor: U.surfaceContainerHigh,
              borderRadius: U.radius,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(1.25)
            }}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: U.space(1.25) }}>
          {CONDITIONS.map((opt) => {
            const on = condition === opt.key;
            return (
              <Pressable
                key={opt.key || "any-cond"}
                onPress={() => setCondition(opt.key)}
                style={{
                  marginRight: U.space(1),
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(0.875),
                  borderRadius: 999,
                  backgroundColor: on ? U.primary : U.surfaceContainerHigh,
                  borderWidth: 0
                }}
              >
                <Text style={[T.caption, { color: on ? U.onPrimary : U.text, fontWeight: "600" }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {isError && renderItems.length === 0 ? <TryAgainState title={uiError.title} description={uiError.description} onRetry={() => void refetch()} /> : null}
      {showFallbackWarning ? (
        <View style={{ paddingHorizontal: U.space(2), paddingTop: U.space(1.25) }}>
          <StateNotice text="Baglanti sorunu var, test icin ornek ilanlar gosteriliyor." />
        </View>
      ) : null}
      {!(isError && renderItems.length === 0) ? (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(3), flexGrow: 1 }}
          data={renderItems}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isFetching && !isPending && !isFetchingNextPage} onRefresh={onRefresh} />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: U.space(2) }} color={U.primary} /> : null
          }
          ListEmptyComponent={
            isPending ? (
              <StateSkeleton count={3} />
            ) : !isFetching && !isError ? (
              <StateCard title="Sonuc bulunamadi." description="Kelimeyi kisaltin veya filtreyi azaltin." />
            ) : null
          }
          renderItem={({ item }) => {
            const sid = sellerParam(item);
            return (
              <Card style={{ padding: 0, marginBottom: U.space(1.5), borderRadius: U.radiusFull }}>
                <Link href={hrefListing(item.id) as Href} asChild>
                  <Pressable accessibilityRole="button" accessibilityLabel={`İlan: ${item.title ?? item.id}`} style={{ padding: U.space(2) }}>
                    <Text style={[T.body, { fontWeight: "700", fontSize: 16 }]} numberOfLines={2}>{item.title ?? item.id}</Text>
                    <Text style={[T.body, { marginTop: U.space(0.75), color: U.price, fontWeight: "800" }]}>
                      {typeof item.price === "number" ? `${Math.round(item.price).toLocaleString("tr-TR")} TL` : "Fiyat sor"}
                    </Text>
                    <Text style={[T.caption, { marginTop: U.space(0.75) }]}>
                      {(item.city || item.district) ? `${item.city ?? "-"} / ${item.district ?? "-"}` : "Konum belirsiz"} · ⭐{" "}
                      {item.sellerRating != null ? item.sellerRating.toFixed(1) : "4.5"}
                    </Text>
                  </Pressable>
                </Link>
                {sid ? (
                  <Link href={hrefUser(sid) as Href} asChild>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Satıcı profilini aç"
                      style={{ paddingHorizontal: U.space(2), paddingBottom: U.space(1) }}
                    >
                      <Text style={[T.caption, { color: U.tertiary, fontWeight: "700" }]}>Satıcı profili →</Text>
                    </Pressable>
                  </Link>
                ) : null}
                <Link href={hrefOffer(item.id) as Href} asChild>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Hizli teklif ver"
                    style={{
                      marginHorizontal: U.space(2),
                      marginBottom: U.space(2),
                      minHeight: U.space(5.5),
                      borderRadius: 999,
                      backgroundColor: U.primary,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Text style={[T.body, { color: U.onPrimary, fontWeight: "700" }]}>Hızlı teklif ver</Text>
                  </Pressable>
                </Link>
              </Card>
            );
          }}
        />
      ) : null}
    </View>
  );
}
