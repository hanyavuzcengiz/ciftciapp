import { router } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../components/ui/AppButton";
import { apiJsonWithAuth } from "../lib/api";
import { isMockDataEnabled } from "../lib/mockData";
import { hrefListing, hrefProfileSetup } from "../lib/paths";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U, shadowCard } from "../theme/tokens";

const CATEGORIES = [
  { key: "traktor", label: "Traktor" },
  { key: "tohum", label: "Tohum" },
  { key: "gubre", label: "Gubre" },
  { key: "hayvancilik", label: "Hayvancilik" }
] as const;

const PHASES = ["MEDYA", "DETAY", "ÖNE ÇIKAR"] as const;

type BoostTier = "none" | "standard" | "plus" | "premium";

const BOOST_OPTIONS: { id: BoostTier; title: string; subtitle: string; price: string; highlight?: boolean }[] = [
  { id: "none", title: "Standart", subtitle: "Liste görünümünde yayın", price: "Ücretsiz" },
  { id: "standard", title: "Vitrin", subtitle: "7 gün ana sayfa vitrininde", price: "₺49", highlight: true },
  { id: "plus", title: "Plus", subtitle: "Vitrin + arama üstü", price: "₺99" },
  { id: "premium", title: "Premium", subtitle: "Tüm alanlar + rozet", price: "₺199" }
];

const BOOST_PRICE_MAP: Record<Exclude<BoostTier, "none">, number> = {
  standard: 49,
  plus: 99,
  premium: 199
};

const CONDITIONS: { key: "new" | "second_hand" | "organic"; label: string }[] = [
  { key: "new", label: "Sifir" },
  { key: "second_hand", label: "Ikinci el" },
  { key: "organic", label: "Organik" }
];

const requiredFieldsByCategory: Record<string, string[]> = {
  traktor: ["modelYear", "workingHours"],
  tohum: ["certificateType"],
  gubre: ["nutrientRatio"],
  hayvancilik: ["animalType"]
};

const FIELD_LABELS: Record<string, string> = {
  modelYear: "Model yili (ornek: 2022)",
  workingHours: "Calisma saati (ornek: 2150)",
  certificateType: "Sertifika turu",
  nutrientRatio: "Besin orani (ornek: 15-15-15)",
  animalType: "Hayvan / urun turu"
};

const SLOT_COUNT = 10;
const MAX_UPLOAD_IMAGE_BYTES = 1_500_000;

function guessMimeFromUri(uri: string): string {
  const u = uri.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

export default function PostListingScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken, profileComplete } = useAuthStore();
  const mockMode = isMockDataEnabled();
  const [phase, setPhase] = useState(0);
  const [boostTier, setBoostTier] = useState<BoostTier>("none");
  const [title, setTitle] = useState("2020 model 110 HP Traktor - bakimli");
  const [description, setDescription] = useState("Bakimli, tek sahibinden, agir is gormemis. Pazarlik payi vardir.");
  const [price, setPrice] = useState("1485000");
  const [categorySlug, setCategorySlug] = useState<(typeof CATEGORIES)[number]["key"]>("traktor");
  const [condition, setCondition] = useState<"new" | "second_hand" | "organic">("second_hand");
  const [city, setCity] = useState("Konya");
  const [district, setDistrict] = useState("Selcuklu");
  const [lat, setLat] = useState("37.8715");
  const [lng, setLng] = useState("32.4846");
  const [images, setImages] = useState<string[]>([]);
  const [attrs, setAttrs] = useState<Record<string, string>>({ modelYear: "2020", workingHours: "3200" });
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [locating, setLocating] = useState(false);

  const titleNormalized = title.trim().replace(/\s+/g, " ");
  const descriptionNormalized = description.trim().replace(/\s+/g, " ");
  const parsedPrice = Number(price.replace(/\s/g, "").replace(",", "."));
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const requiredDynamic = requiredFieldsByCategory[categorySlug] ?? [];
  const dynamicValid = requiredDynamic.every((k) => (attrs[k] ?? "").trim().length > 0);

  const detailsValid =
    titleNormalized.length >= 5 &&
    descriptionNormalized.length >= 10 &&
    !Number.isNaN(parsedPrice) &&
    parsedPrice >= 0 &&
    price.trim().length > 0 &&
    city.trim().length >= 2 &&
    district.trim().length >= 2 &&
    !Number.isNaN(parsedLat) &&
    !Number.isNaN(parsedLng) &&
    dynamicValid;

  const canPublish =
    Boolean((accessToken && profileComplete) || mockMode) &&
    detailsValid &&
    (mockMode ? images.length >= 0 : images.length >= 3) &&
    images.length <= SLOT_COUNT;

  const phaseValid = (p: number): boolean => {
    if (p === 0) return mockMode ? images.length <= SLOT_COUNT : images.length >= 3 && images.length <= SLOT_COUNT;
    if (p === 1) return detailsValid;
    if (p === 2) return canPublish;
    return false;
  };

  const pickImages = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: SLOT_COUNT
    });
    if (picked.canceled) return;
    const uris = picked.assets.map((a) => a.uri).filter(Boolean);
    setImages([...images, ...uris].slice(0, SLOT_COUNT));
  };

  const removeImageAt = (index: number) => {
    setImages(images.filter((_, j) => j !== index));
  };

  const fillLocationFromDevice = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Toast.show({ type: "error", text1: "Konum izni gerekli" });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));
      const geo = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });
      const g = geo[0];
      if (g?.city) setCity(g.city);
      if (g?.district) setDistrict(g.district);
      else if (g?.subregion) setDistrict(g.subregion);
      Toast.show({ type: "success", text1: "Konum alindi" });
    } catch {
      Toast.show({ type: "error", text1: "Konum okunamadi" });
    } finally {
      setLocating(false);
    }
  };

  const suggestFromImages = async () => {
    if (images.length === 0) {
      Toast.show({ type: "info", text1: "Once fotograf ekleyin" });
      return;
    }
    setSuggesting(true);
    try {
      const j = await apiJsonWithAuth<{ title?: string; description?: string }>("/api/v1/ai/vision-listing-suggest", {
        method: "POST",
        body: JSON.stringify({ category: categorySlug, image_urls: images.slice(0, 5) })
      });
      if (j.title) setTitle(j.title);
      if (j.description) setDescription(j.description);
      appendDemoLog("Hizli ilan", "AI onerisi uygulandi");
      Toast.show({ type: "success", text1: "Oneriler uygulandi" });
    } catch (e) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "AI kullanilamadi" });
    } finally {
      setSuggesting(false);
    }
  };

  const publish = async () => {
    if (loading) return;
    if (!accessToken && !mockMode) {
      Toast.show({ type: "error", text1: "Giris gerekli" });
      return;
    }
    if (!profileComplete && !mockMode) {
      Toast.show({ type: "info", text1: "Once profilinizi tamamlayin" });
      router.push(hrefProfileSetup);
      return;
    }
    if (!canPublish) {
      Toast.show({ type: "error", text1: "Eksik alanlari tamamlayin" });
      return;
    }
    setLoading(true);
    try {
      const uploadedImages: string[] = [];
      for (const img of images) {
        if (/^https?:\/\//i.test(img) || img.startsWith("/uploads/")) {
          uploadedImages.push(img);
          continue;
        }
        const info = await FileSystem.getInfoAsync(img);
        if (info.exists && typeof info.size === "number" && info.size > MAX_UPLOAD_IMAGE_BYTES) {
          Toast.show({ type: "error", text1: "Gorsel cok buyuk", text2: "Tek gorsel en fazla 1.5MB olmali" });
          setLoading(false);
          return;
        }
        const base64 = await FileSystem.readAsStringAsync(img, { encoding: "base64" });
        const up = await apiJsonWithAuth<{ url?: string }>("/api/v1/listings/media/upload-inline", {
          method: "POST",
          body: JSON.stringify({
            fileName: `listing-${Date.now()}.jpg`,
            mimeType: guessMimeFromUri(img),
            base64
          })
        });
        const url = up.url?.trim();
        if (!url) {
          Toast.show({ type: "error", text1: "Gorsel yuklenemedi" });
          setLoading(false);
          return;
        }
        uploadedImages.push(url);
      }

      const body = {
        title: titleNormalized,
        description: descriptionNormalized,
        listing_type: "sell",
        price: parsedPrice,
        price_unit: "TL",
        category_slug: categorySlug,
        condition,
        location: { city: city.trim(), district: district.trim(), lat: parsedLat, lng: parsedLng },
        images: uploadedImages,
        attributes: attrs
      };
      const created = await apiJsonWithAuth<{ id: string }>("/api/v1/listings", { method: "POST", body: JSON.stringify(body) });
      const newId = created?.id?.trim();
      if (!newId) {
        Toast.show({ type: "error", text1: "Ilan id alinamadi" });
        return;
      }
      if (boostTier !== "none") {
        const amount = BOOST_PRICE_MAP[boostTier];
        const intent = await apiJsonWithAuth<{ id?: string }>(`/api/v1/payments/intent`, {
          method: "POST",
          body: JSON.stringify({
            order_id: `listing:${newId}:${boostTier}`,
            provider: "iyzico",
            amount
          })
        });
        const paymentId = intent.id?.trim();
        if (!paymentId) {
          Toast.show({ type: "error", text1: "Odeme baslatilamadi" });
          return;
        }
        await apiJsonWithAuth(`/api/v1/payments/${encodeURIComponent(paymentId)}/confirm`, {
          method: "POST",
          body: "{}"
        });
      }
      await apiJsonWithAuth(`/api/v1/listings/${encodeURIComponent(newId)}/publish`, { method: "POST", body: "{}" });
      appendDemoLog("Hizli ilan", `Yayinda: ${newId} · paket: ${boostTier}`);
      Toast.show({ type: "success", text1: "Ilan yayinda" });
      router.push(hrefListing(newId) as Href);
    } catch (e) {
      if (isMockDataEnabled()) {
        const demoId = `demo-${Date.now()}`;
        appendDemoLog("Hizli ilan", `Mock yayinda: ${demoId}`);
        Toast.show({ type: "info", text1: "Sunucu yok", text2: "Test ilani acildi." });
        router.push(hrefListing(demoId) as Href);
        return;
      }
      Toast.show({ type: "error", text1: "Kayit basarisiz", text2: e instanceof Error ? e.message : "" });
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    if (phase < PHASES.length - 1 && phaseValid(phase)) setPhase(phase + 1);
    else if (!phaseValid(phase)) Toast.show({ type: "info", text1: "Bu adimi tamamlayin" });
  };
  const goBack = () => {
    if (phase > 0) setPhase(phase - 1);
  };

  const inputProps = {
    placeholderTextColor: U.textMuted,
    style: {
      marginTop: U.space(1.5),
      borderWidth: 0,
      borderRadius: U.radius,
      paddingHorizontal: U.space(2),
      paddingVertical: U.space(1.5),
      fontSize: 15,
      color: U.text,
      backgroundColor: U.surfaceContainerHigh
    } as const
  };

  const gap = U.space(1);
  const colW = "31%" as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: U.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}>
      <View style={{ paddingHorizontal: U.space(2), paddingTop: U.space(2), paddingBottom: U.space(1) }}>
        <Text style={T.title}>Ilan ver</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: U.space(1.5), justifyContent: "space-between" }}>
          {PHASES.map((label, i) => {
            const active = i === phase;
            const done = i < phase;
            return (
              <View key={label} style={{ flex: 1, alignItems: "center" }}>
                <View
                  style={{
                    width: U.space(4),
                    height: U.space(4),
                    borderRadius: U.space(2),
                    backgroundColor: done || active ? U.primary : U.surfaceContainer,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: active ? 2 : 0,
                    borderColor: U.limeCta
                  }}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={18} color={U.onPrimary} />
                  ) : (
                    <Text style={{ color: active ? U.onPrimary : U.textMuted, fontSize: 12, fontWeight: "800" }}>{i + 1}</Text>
                  )}
                </View>
                <Text
                  style={[
                    T.overline,
                    {
                      marginTop: U.space(0.5),
                      fontSize: 9,
                      textAlign: "center",
                      color: active ? U.primary : U.textMuted
                    }
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={{ marginTop: U.space(1), height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: U.surfaceContainer }}>
          <View
            style={{
              height: 3,
              width: `${((phase + 1) / PHASES.length) * 100}%`,
              backgroundColor: U.primary
            }}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: U.space(2), paddingBottom: insets.bottom + U.space(15) }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {phase === 0 ? (
          <>
            <Text style={[T.body, { fontWeight: "700", marginBottom: U.space(0.5) }]}>Fotograf ve video alani</Text>
            <Text style={[T.caption, { marginBottom: U.space(1.5) }]}>
              {mockMode ? "Test modunda foto zorunluluğu yok; canlida en az 3 foto." : "En az 3, en fazla 10 fotograf."}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: gap }}>
              {Array.from({ length: SLOT_COUNT }).map((_, i) => {
                const uri = images[i];
                const firstEmpty = i === images.length;
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      if (uri) removeImageAt(i);
                      else if (firstEmpty) void pickImages();
                    }}
                    style={{
                      width: colW,
                      aspectRatio: 1,
                      marginBottom: U.space(1),
                      borderRadius: U.radius,
                      overflow: "hidden",
                      borderWidth: uri ? 0 : 2,
                      borderStyle: uri ? "solid" : "dashed",
                      borderColor: uri ? "transparent" : U.textMuted,
                      backgroundColor: uri ? U.surfaceContainer : U.surfaceTint,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
                    ) : firstEmpty ? (
                      <>
                        <Ionicons name="add" size={28} color={U.primary} />
                        <Text style={[T.caption, { marginTop: 4, fontSize: 10 }]}>Ekle</Text>
                      </>
                    ) : (
                      <Ionicons name="image-outline" size={22} color={U.textMuted} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            <AppButton label="Galeriden sec" variant="secondary" onPress={() => void pickImages()} style={{ marginTop: U.space(1) }} />
            <AppButton label={suggesting ? "AI calisiyor..." : "AI ile baslik / aciklama"} variant="secondary" disabled={suggesting || images.length === 0} onPress={() => void suggestFromImages()} style={{ marginTop: U.space(1) }} />
          </>
        ) : null}

        {phase === 1 ? (
          <>
            <Text style={[T.caption, { marginBottom: U.space(1) }]}>Ne satiyorsunuz?</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: U.space(1) }}>
              {CATEGORIES.map((c) => {
                const on = categorySlug === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategorySlug(c.key)}
                    style={{
                      paddingHorizontal: U.space(1.75),
                      paddingVertical: U.space(1.25),
                      borderRadius: 999,
                      backgroundColor: on ? U.primary : U.surfaceContainerHigh,
                      borderWidth: 0
                    }}
                  >
                    <Text style={[T.body, { fontWeight: "600", color: on ? U.onPrimary : U.text }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[T.caption, { marginTop: U.space(2), marginBottom: U.space(1) }]}>Durum</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: U.space(1) }}>
              {CONDITIONS.map((c) => {
                const on = condition === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCondition(c.key)}
                    style={{
                      paddingHorizontal: U.space(1.75),
                      paddingVertical: U.space(1.25),
                      borderRadius: 999,
                      backgroundColor: on ? U.primary : U.surfaceContainerHigh,
                      borderWidth: 0
                    }}
                  >
                    <Text style={[T.body, { fontWeight: "600", color: on ? U.onPrimary : U.text }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[T.caption, { marginTop: U.space(2) }]}>Baslik (min. 5 karakter)</Text>
            <TextInput
              placeholder="Ornek: 2022 traktor, 145 bg, bakimli"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              {...inputProps}
            />
            <Text style={[T.caption, { marginTop: U.space(1) }]}>Aciklama (min. 10 karakter)</Text>
            <TextInput
              placeholder="Model, kullanim, odeme, teslim..."
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
              multiline
              textAlignVertical="top"
              style={{ ...inputProps.style, minHeight: U.space(14), marginTop: U.space(1.5) }}
              placeholderTextColor={U.textMuted}
            />
            <Text style={[T.caption, { marginTop: U.space(1) }]}>Fiyat (TL)</Text>
            <TextInput
              placeholder="Ornek: 2450000"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              {...inputProps}
            />
            <Text style={[T.caption, { marginTop: U.space(1) }]}>Konum</Text>
            <AppButton label={locating ? "Konum aliniyor..." : "Konumumu kullan"} variant="secondary" disabled={locating} onPress={() => void fillLocationFromDevice()} style={{ marginTop: U.space(1) }} />
            <TextInput placeholder="Il (ornek: Konya)" value={city} onChangeText={setCity} {...inputProps} />
            <TextInput placeholder="Ilce (ornek: Selcuklu)" value={district} onChangeText={setDistrict} {...inputProps} />
            {requiredDynamic.map((field) => (
              <TextInput
                key={field}
                placeholder={FIELD_LABELS[field] ?? field}
                value={attrs[field] ?? ""}
                onChangeText={(v) => setAttrs((prev) => ({ ...prev, [field]: v }))}
                {...inputProps}
              />
            ))}
          </>
        ) : null}

        {phase === 2 ? (
          <>
            <Text style={[T.body, { fontWeight: "700", marginBottom: U.space(0.5) }]}>Gorunurluk paketi</Text>
            <Text style={[T.caption, { marginBottom: U.space(1.5) }]}>Boost paket seciminde odeme intent olusturulur ve onay sonrasi ilan yayinlanir.</Text>
            {BOOST_OPTIONS.map((opt) => {
              const on = boostTier === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setBoostTier(opt.id)}
                  style={{
                    marginBottom: U.space(1.25),
                    padding: U.space(2),
                    borderRadius: U.radiusLg,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? U.primary : U.surfaceContainer,
                    backgroundColor: opt.highlight ? U.surfaceTint : U.surface,
                    ...shadowCard
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[T.body, { fontWeight: "800" }]}>{opt.title}</Text>
                    <Text style={[T.body, { color: U.price, fontWeight: "800" }]}>{opt.price}</Text>
                  </View>
                  <Text style={[T.caption, { marginTop: U.space(0.75) }]}>{opt.subtitle}</Text>
                  {on ? (
                    <Text style={[T.caption, { marginTop: U.space(0.75), color: U.secondary, fontWeight: "700" }]}>Secildi</Text>
                  ) : null}
                </Pressable>
              );
            })}
            <View style={{ marginTop: U.space(1), borderRadius: U.radiusLg, backgroundColor: U.surfaceLow, padding: U.space(1.5) }}>
              <Text style={[T.body, { fontWeight: "700" }]}>Onizleme</Text>
              <Text style={[T.caption, { marginTop: U.space(0.75) }]} numberOfLines={1}>
                {images.length} fotograf · {CATEGORIES.find((c) => c.key === categorySlug)?.label ?? categorySlug}
              </Text>
              <Text style={[T.caption, { marginTop: U.space(0.5) }]} numberOfLines={2}>
                {titleNormalized || "-"}
              </Text>
              <Text style={[T.caption, { marginTop: U.space(0.5) }]} numberOfLines={1}>
                {price || "-"} TL · {city || "-"} / {district || "-"}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: U.space(2),
          paddingBottom: insets.bottom + U.space(1),
          backgroundColor: U.surface,
          borderTopWidth: 0,
          flexDirection: "row",
          gap: U.space(1),
          ...shadowCard
        }}
      >
        {phase > 0 ? <AppButton label="Geri" variant="secondary" onPress={goBack} style={{ flex: 1 }} /> : <View style={{ flex: 1 }} />}
        {phase < PHASES.length - 1 ? (
          <AppButton label="Ileri" onPress={goNext} style={{ flex: 2 }} />
        ) : (
          <AppButton label={loading ? "Gonderiliyor..." : "Yayinla"} loading={loading} disabled={loading || !canPublish} onPress={() => void publish()} style={{ flex: 2 }} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
