import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiJsonWithAuth } from "../lib/api";
import { tryDecodeURIComponent } from "../lib/safeDecode";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const { userId: userIdParam, listingId: listingIdParam } = useLocalSearchParams<{
    userId?: string | string[];
    listingId?: string | string[];
  }>();
  const rawUser = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
  const target = rawUser?.trim() ? tryDecodeURIComponent(rawUser.trim()) : "";
  const rawListing = Array.isArray(listingIdParam) ? listingIdParam[0] : listingIdParam;
  const listingForApi = rawListing?.trim() ? tryDecodeURIComponent(rawListing.trim()) : undefined;
  const { accessToken, userId: me } = useAuthStore();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const commentNormalized = comment.trim().replace(/\s+/g, " ");
  const canSubmit = Boolean(accessToken && me && target) && target !== me;

  const submit = async () => {
    if (loading) return;
    if (!accessToken || !me) {
      Toast.show({ type: "error", text1: "Giriş gerekli" });
      return;
    }
    if (target === me) {
      Toast.show({ type: "error", text1: "Kendinizi değerlendiremezsiniz" });
      return;
    }
    setLoading(true);
    try {
      await apiJsonWithAuth("/api/v1/reviews", {
        method: "POST",
        body: JSON.stringify({
          reviewed_user_id: target,
          rating,
          comment: commentNormalized || undefined,
          listing_id: listingForApi
        })
      });
      appendDemoLog("Degerlendirme", `${rating} yildiz — hedef ${target.slice(0, 16)}`);
      Toast.show({ type: "success", text1: "Değerlendirme kaydedildi" });
      router.back();
    } catch (e) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Hata" });
    } finally {
      setLoading(false);
    }
  };

  if (!target) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { color: U.textSecondary, textAlign: "center" }]}>Geçersiz kullanıcı bağlantısı.</Text>
      </View>
    );
  }

  if (!accessToken || !me) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: U.space(3), backgroundColor: U.bg }}>
        <Text style={[T.body, { color: U.textSecondary, textAlign: "center" }]}>Değerlendirme için giriş yapın.</Text>
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
        <Text style={T.display}>Değerlendirme</Text>
        <Text style={[T.caption, { marginTop: U.space(1) }]}>Kullanıcı: {target.slice(0, 12)}…</Text>
        <Text style={[T.body, { marginTop: U.space(2.5), fontWeight: "700" }]}>Puan</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: U.space(1), gap: U.space(1) }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: rating === n }}
              accessibilityLabel={`Puan ${n} yıldız`}
              onPress={() => setRating(n)}
              style={{
                paddingHorizontal: U.space(1.75),
                paddingVertical: U.space(1.25),
                borderRadius: 999,
                backgroundColor: rating === n ? U.primary : U.surfaceContainerHigh,
                borderWidth: 0
              }}
            >
              <Text style={[T.body, { fontWeight: "700", color: rating === n ? U.onPrimary : U.text }]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[T.body, { marginTop: U.space(2.5), fontWeight: "700" }]}>Yorum</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="İsteğe bağlı kısa yorum"
          placeholderTextColor={U.textMuted}
          multiline
          editable={!loading}
          maxLength={500}
          style={{
            marginTop: U.space(1),
            borderWidth: 0,
            borderRadius: U.radius,
            padding: U.space(1.5),
            minHeight: U.space(12.5),
            textAlignVertical: "top",
            color: U.text,
            backgroundColor: U.surfaceContainerHigh
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Değerlendirmeyi gönder"
          onPress={() => void submit()}
          disabled={loading || !canSubmit}
          style={{
            marginTop: U.space(3),
            backgroundColor: loading || !canSubmit ? U.textMuted : U.primary,
            paddingVertical: U.space(2),
            paddingHorizontal: U.space(2),
            borderRadius: 999,
            alignItems: "center"
          }}
        >
          <Text style={[T.body, { color: U.onPrimary, fontWeight: "700" }]}>{loading ? "Gönderiliyor..." : "Gönder"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
