import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiJson, apiJsonWithAuth } from "../lib/api";
import { tryDecodeURIComponent } from "../lib/safeDecode";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

/** Teklif API satıcıyı E.164 telefon (listing.userId) ile bekler. */
type ListingForOffer = { userId?: string };
type OfferCreateResponse = { id?: string; status?: string; statusTr?: string };

export default function OfferScreen() {
  const insets = useSafeAreaInsets();
  const { listingId: listingIdParam } = useLocalSearchParams<{ listingId?: string | string[] }>();
  const rawListingId = (Array.isArray(listingIdParam) ? listingIdParam[0] : listingIdParam)?.trim() ?? "";
  const listingId = rawListingId ? tryDecodeURIComponent(rawListingId) : "";
  const { accessToken, userId } = useAuthStore();
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const offeredPrice = Number(price);
  const canSubmit =
    Boolean(accessToken && userId && listingId) &&
    !Number.isNaN(offeredPrice) &&
    offeredPrice >= 0;

  const submit = async () => {
    if (loading) return;
    if (!accessToken || !userId || !listingId) return;
    if (Number.isNaN(offeredPrice) || offeredPrice < 0) {
      Toast.show({ type: "error", text1: "Geçerli bir teklif fiyatı girin (≥ 0)" });
      return;
    }
    setLoading(true);
    try {
      const listing = await apiJson<ListingForOffer>(`/api/v1/listings/${listingId}`);
      const sellerId = listing.userId?.trim() ?? "";
      if (!sellerId) {
        Toast.show({ type: "error", text1: "Satıcı bilgisi eksik" });
        return;
      }
      if (sellerId === userId) {
        Toast.show({ type: "error", text1: "Kendi ilanınıza teklif veremezsiniz" });
        return;
      }
      const created = await apiJsonWithAuth<OfferCreateResponse>("/api/v1/offers", {
        method: "POST",
        body: JSON.stringify({
          listing_id: listingId,
          seller_id: sellerId,
          offered_price: offeredPrice,
          message: msg.trim() || undefined
        })
      });
      Toast.show({
        type: "success",
        text1: "Teklif gonderildi",
        text2: created.statusTr ? `Durum: ${created.statusTr}` : undefined
      });
      router.back();
    } catch (e) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Hata" });
    } finally {
      setLoading(false);
    }
  };

  if (!accessToken || !userId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { color: U.textSecondary, textAlign: "center" }]}>Teklif vermek için giriş yapın.</Text>
      </View>
    );
  }

  if (!listingId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { color: U.textSecondary, textAlign: "center" }]}>Geçersiz ilan bağlantısı.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: U.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(3), flexGrow: 1 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={T.display}>Teklif</Text>
        <Text style={[T.caption, { marginTop: U.space(1) }]}>İlan: {listingId}</Text>
        <TextInput
          placeholder="Fiyat (TL)"
          placeholderTextColor={U.textMuted}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          editable={!loading}
          returnKeyType="done"
          maxLength={16}
          onSubmitEditing={() => void submit()}
          style={field}
        />
        <TextInput
          placeholder="Mesaj (isteğe bağlı)"
          placeholderTextColor={U.textMuted}
          value={msg}
          onChangeText={setMsg}
          multiline
          editable={!loading}
          maxLength={500}
          style={[field, { minHeight: U.space(10) }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Teklifi gönder"
          onPress={() => void submit()}
          disabled={loading || !canSubmit}
          style={{
            marginTop: U.space(2.5),
            backgroundColor: loading || !canSubmit ? U.textMuted : U.primary,
            paddingVertical: U.space(2),
            paddingHorizontal: U.space(2),
            borderRadius: 999,
            alignItems: "center"
          }}
        >
          <Text style={[T.body, { color: U.onPrimary, fontWeight: "700", textAlign: "center" }]}>
            {loading ? "Gönderiliyor..." : "Gönder"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const field = {
  marginTop: U.space(1.5),
  borderWidth: 0,
  borderRadius: U.radius,
  paddingHorizontal: U.space(1.5),
  paddingVertical: U.space(1.5),
  fontSize: 16,
  color: U.text,
  backgroundColor: U.surfaceContainerHigh
};
