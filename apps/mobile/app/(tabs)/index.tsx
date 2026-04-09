import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StateCard, StateSkeleton } from "../components/RequestStates";
import { Card } from "../components/ui/Card";
import { apiJson } from "../lib/api";
import { isMockDataEnabled, SAMPLE_FEED } from "../lib/mockData";
import {
  pastoralCatCattle,
  pastoralCatHorse,
  pastoralCatPoultry,
  pastoralCatSheep,
  pastoralSplashBg
} from "../lib/pastoralAssets";
import { hrefListing, hrefUser } from "../lib/paths";
import { appendDemoLog } from "../store/demoLog";
import { T, U, shadowCard } from "../theme/tokens";

type ListingsResponse = {
  data: Array<{
    id: string;
    title?: string;
    price?: number;
    listingType?: string;
    city?: string;
    district?: string;
    sellerRating?: number;
    imageUrl?: string;
    userId?: string;
    authorUuid?: string | null;
  }>;
  nextCursor: string | null;
};

type SortKey = "new" | "price_desc";

const CATEGORY_TILES: { key: string; label: string; source: typeof pastoralSplashBg }[] = [
  { key: "buyukbas", label: "Büyükbaş", source: pastoralCatCattle },
  { key: "kucukbas", label: "Küçükbaş", source: pastoralCatSheep },
  { key: "keci", label: "Keçi", source: pastoralCatSheep },
  { key: "kumes", label: "Kümes", source: pastoralCatPoultry },
  { key: "at", label: "At", source: pastoralCatHorse }
];

function sellerParam(item: ListingsResponse["data"][number]): string | null {
  const uuid = item.authorUuid?.trim();
  if (uuid) return uuid;
  const phone = item.userId?.trim();
  return phone || null;
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "44%",
        backgroundColor: U.surfaceTint,
        borderRadius: U.radius,
        paddingVertical: U.space(1),
        paddingHorizontal: U.space(1.25),
        marginBottom: U.space(1),
        marginRight: U.space(1)
      }}
    >
      <Text style={T.overline}>{label}</Text>
      <Text style={[T.body, { fontWeight: "700", marginTop: U.space(0.25) }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function FeedListingCard({ item }: { item: ListingsResponse["data"][number] }) {
  const sid = sellerParam(item);
  const loc =
    item.city || item.district ? `${item.city ?? "—"} / ${item.district ?? "—"}` : "Konum belirtilmedi";
  const priceStr =
    typeof item.price === "number" ? `${Math.round(item.price).toLocaleString("tr-TR")} TL` : "Fiyat sor";

  return (
    <Card style={{ padding: 0, marginBottom: U.space(2), borderRadius: U.radiusLg, overflow: "hidden" }}>
      <Link href={hrefListing(item.id) as Href} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel={`İlan: ${item.title ?? item.id}`}>
          <View style={{ position: "relative" }}>
            {typeof item.imageUrl === "string" ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: "100%", height: U.space(22), backgroundColor: U.surfaceContainer }}
              />
            ) : (
              <Image
                source={pastoralCatCattle}
                style={{ width: "100%", height: U.space(22) }}
                resizeMode="cover"
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Favorilere ekle"
              onPress={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: U.space(1),
                right: U.space(1),
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.92)",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="heart-outline" size={20} color={U.text} />
            </Pressable>
            <View
              style={{
                position: "absolute",
                left: U.space(1),
                bottom: U.space(1),
                flexDirection: "row",
                flexWrap: "wrap",
                gap: U.space(0.5)
              }}
            >
              <View
                style={{
                  backgroundColor: U.secondaryContainer,
                  paddingHorizontal: U.space(1),
                  paddingVertical: U.space(0.25),
                  borderRadius: 999
                }}
              >
                <Text style={[T.overline, { color: U.onSecondaryContainer, fontSize: 10 }]}>ÖNE ÇIKAN</Text>
              </View>
            </View>
          </View>
          <View style={{ padding: U.space(2) }}>
            <Text style={[T.body, { fontWeight: "800", fontSize: 16 }]} numberOfLines={2}>
              {item.title ?? item.id}
            </Text>
            <Text style={[T.title, { marginTop: U.space(0.75), color: U.price, fontSize: 20 }]}>
              {priceStr}
            </Text>
            <Text style={[T.caption, { marginTop: U.space(0.25), color: U.textMuted }]}>Adet + KDV</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: U.space(1.25), marginRight: -U.space(1) }}>
              <SpecCell label="AĞIRLIK" value="—" />
              <SpecCell label="YAŞ" value="—" />
              <SpecCell label="CİNS" value="—" />
              <SpecCell label="KONUM" value={loc.split(" / ")[0] || "—"} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: U.space(1),
                paddingTop: U.space(1.25),
                borderTopWidth: 1,
                borderTopColor: U.border
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: U.secondaryContainer,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: U.space(1)
                }}
              >
                <Ionicons name="person" size={22} color={U.onSecondaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.caption, { fontWeight: "700", color: U.text }]}>Satıcı</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Ionicons name="checkmark-circle" size={14} color={U.secondary} style={{ marginRight: 4 }} />
                  <Text style={[T.caption, { color: U.secondary, fontWeight: "600" }]}>Onaylı satıcı</Text>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: U.limeCta,
                  paddingHorizontal: U.space(1.25),
                  paddingVertical: U.space(1),
                  borderRadius: 999
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="chatbubble-ellipses" size={16} color={U.onLimeCta} style={{ marginRight: 6 }} />
                  <Text style={[T.caption, { fontWeight: "800", color: U.onLimeCta }]}>İletişim</Text>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      </Link>
      {sid ? (
        <Link href={hrefUser(sid) as Href} asChild>
          <Pressable accessibilityRole="button" style={{ paddingHorizontal: U.space(2), paddingBottom: U.space(2) }}>
            <Text style={[T.caption, { color: U.tertiary, fontWeight: "700" }]}>Satıcı profili →</Text>
          </Pressable>
        </Link>
      ) : null}
    </Card>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<SortKey>("new");
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ["listings", "feed"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiJson<ListingsResponse>(
        pageParam ? `/api/v1/listings?cursor=${encodeURIComponent(pageParam)}` : "/api/v1/listings"
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined
  });

  const items = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    const seen = new Set<string>();
    return flat.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [data?.pages]);

  const renderItems = items.length > 0 ? items : isMockDataEnabled() ? SAMPLE_FEED : [];

  const sortedItems = useMemo(() => {
    const arr = [...renderItems];
    if (sort === "price_desc") {
      arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }
    return arr;
  }, [renderItems, sort]);

  const featuredSlice = useMemo(() => renderItems.slice(0, 8), [renderItems]);

  const errorMessage = error instanceof Error ? error.message : error ? "Yukleme hatasi" : null;
  const showFallbackWarning = isError && renderItems.length > 0;
  const feedFallbackLogged = useRef(false);
  useEffect(() => {
    if (!showFallbackWarning || feedFallbackLogged.current) return;
    feedFallbackLogged.current = true;
    appendDemoLog("Ana sayfa", "API hatasi; ornek vitrin");
  }, [showFallbackWarning]);

  const ListHeader = (
    <View style={{ marginBottom: U.space(1) }}>
      <View
        style={{
          paddingHorizontal: U.space(2),
          paddingTop: insets.top > 0 ? insets.top : U.space(2),
          paddingBottom: U.space(1.5),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Menü">
          <Ionicons name="menu" size={26} color={U.text} />
        </Pressable>
        <Text style={T.brand}>The Pastoral</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: U.space(1) }}>
          <View>
            <Ionicons name="notifications-outline" size={24} color={U.text} />
            <View
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: U.primary
              }}
            />
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: U.space(2) }}>
        <ImageBackground
          source={pastoralSplashBg}
          style={{
            borderRadius: U.radiusLg,
            overflow: "hidden",
            minHeight: U.space(26)
          }}
          imageStyle={{ borderRadius: U.radiusLg }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(26,43,72,0.45)",
              padding: U.space(2.5),
              justifyContent: "center"
            }}
          >
            <Text style={[T.display, { color: U.onPrimary, textAlign: "center" }]}>Güvenilir Canlı Hayvan Ticareti</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="İlan ara"
              onPress={() => router.push("/(tabs)/search" as Href)}
              style={{
                marginTop: U.space(2),
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: U.surface,
                borderRadius: 999,
                paddingVertical: U.space(1.25),
                paddingHorizontal: U.space(1.5),
                ...shadowCard
              }}
            >
              <Ionicons name="search" size={20} color={U.textSecondary} style={{ marginRight: U.space(1) }} />
              <Text style={[T.body, { flex: 1, color: U.textMuted }]}>Cins, bölge veya ilan ara</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Arama yap"
              onPress={() => router.push("/(tabs)/search" as Href)}
              style={{
                marginTop: U.space(1.5),
                backgroundColor: U.primary,
                borderRadius: U.radius,
                paddingVertical: U.space(1.5),
                alignItems: "center"
              }}
            >
              <Text style={[T.body, { color: U.onPrimary, fontWeight: "800" }]}>Arama Yap</Text>
            </Pressable>
          </View>
        </ImageBackground>
      </View>

      <View style={{ paddingHorizontal: U.space(2), marginTop: U.space(2.5) }}>
        <Text style={[T.title, { fontSize: 20 }]}>Kategoriler</Text>
        <Text style={[T.caption, { marginTop: U.space(0.5), marginBottom: U.space(1.5) }]}>
          Özel seçilmiş hayvan gruplarına göz atın
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {CATEGORY_TILES.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              onPress={() => router.push("/(tabs)/search" as Href)}
              style={{
                width: "48%",
                marginBottom: U.space(1.5),
                borderRadius: U.radiusLg,
                overflow: "hidden",
                height: U.space(14),
                ...shadowCard
              }}
            >
              <Image source={c.source} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              <View
                style={{
                  ...{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0 },
                  backgroundColor: "rgba(0,0,0,0.35)",
                  justifyContent: "flex-end",
                  padding: U.space(1.25)
                }}
              >
                <Text style={[T.body, { color: U.onPrimary, fontWeight: "800" }]}>{c.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: U.space(2), marginTop: U.space(1) }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={[T.title, { fontSize: 18 }]}>Vitrin İlanları</Text>
          <Pressable onPress={() => router.push("/(tabs)/search" as Href)}>
            <Text style={[T.caption, { color: U.tertiary, fontWeight: "700" }]}>Tümünü Gör ›</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: U.space(1.25) }}
          contentContainerStyle={{ paddingRight: U.space(2) }}
        >
          {featuredSlice.map((it) => (
            <Link key={it.id} href={hrefListing(it.id) as Href} asChild>
              <Pressable
                style={{
                  width: 220,
                  marginRight: U.space(1.5),
                  backgroundColor: U.surface,
                  borderRadius: U.radiusLg,
                  overflow: "hidden",
                  ...shadowCard
                }}
              >
                <View style={{ position: "relative" }}>
                  {typeof it.imageUrl === "string" ? (
                    <Image source={{ uri: it.imageUrl }} style={{ width: "100%", height: U.space(16) }} />
                  ) : (
                    <Image
                      source={pastoralCatSheep}
                      style={{ width: "100%", height: U.space(16) }}
                      resizeMode="cover"
                    />
                  )}
                  <View
                    style={{
                      position: "absolute",
                      top: U.space(1),
                      right: U.space(1),
                      backgroundColor: U.primary,
                      paddingHorizontal: U.space(0.75),
                      paddingVertical: 2,
                      borderRadius: 6
                    }}
                  >
                    <Text style={[T.overline, { color: U.onPrimary, fontSize: 9 }]}>VİTRİN</Text>
                  </View>
                </View>
                <View style={{ padding: U.space(1.25) }}>
                  <Text style={[T.body, { fontWeight: "700" }]} numberOfLines={2}>
                    {it.title ?? it.id}
                  </Text>
                  <Text style={[T.body, { color: U.price, fontWeight: "800", marginTop: U.space(0.5) }]}>
                    {typeof it.price === "number"
                      ? `₺${Math.round(it.price).toLocaleString("tr-TR")}`
                      : "Fiyat sor"}
                  </Text>
                  <Text style={[T.caption, { marginTop: U.space(0.5) }]}>
                    <Ionicons name="location-outline" size={12} color={U.textMuted} /> {it.city ?? "Türkiye"}
                  </Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: U.space(2), marginTop: U.space(2.5) }}>
        <Text style={[T.title, { fontSize: 18, marginBottom: U.space(1.25) }]}>Tüm İlanlar</Text>
        {errorMessage ? (
          <Text style={[T.caption, { color: U.warnText, marginBottom: U.space(1) }]}>
            Bağlantı zayıf — örnek liste gösteriliyor.
          </Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: U.space(1) }}>
          {(
            [
              { key: "new" as SortKey, label: "En Yeniler" },
              { key: "price_desc" as SortKey, label: "Fiyat Azalan" }
            ] as const
          ).map((opt) => {
            const on = sort === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setSort(opt.key)}
                style={{
                  paddingHorizontal: U.space(1.75),
                  paddingVertical: U.space(1),
                  borderRadius: 999,
                  backgroundColor: on ? U.primary : U.surfaceContainerHigh
                }}
              >
                <Text style={[T.caption, { fontWeight: "700", color: on ? U.onPrimary : U.text }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: U.bg }}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: U.space(2), paddingBottom: insets.bottom + U.space(10), flexGrow: 1 }}
        data={sortedItems}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={ListHeader}
        refreshControl={<RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={() => void refetch()} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={{ marginVertical: U.space(2) }} color={U.primary} />
          ) : sortedItems.length > 0 ? (
            <Pressable
              style={{
                marginTop: U.space(1),
                marginBottom: U.space(2),
                paddingVertical: U.space(1.5),
                borderRadius: U.radius,
                borderWidth: 1,
                borderColor: U.border,
                alignItems: "center",
                backgroundColor: U.surface
              }}
              onPress={() => {
                if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
              }}
            >
              <Text style={[T.body, { fontWeight: "700", color: U.text }]}>Daha Fazla İlan Yükle</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          isPending ? (
            <StateSkeleton count={4} />
          ) : (
            <StateCard title="İlan bulunamadı." description="Arama sekmesinden filtreleri deneyin." />
          )
        }
        renderItem={({ item }) => <FeedListingCard item={item} />}
      />
    </View>
  );
}
