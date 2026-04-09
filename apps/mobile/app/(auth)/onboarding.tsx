import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hrefPhoneAuth } from "../lib/paths";
import { T, U } from "../theme/tokens";

const { width } = Dimensions.get("window");

const slides = [
  { key: "1", title: "Doğrulanmış üreticiler", body: "Kimlik ve telefon doğrulaması ile güvenli alışveriş.", icon: "shield-checkmark" as const },
  { key: "2", title: "İlan ve teklif", body: "Tahıl, hayvan, yedek parça ve hizmet ilanlarını tek yerden yönetin.", icon: "pricetag" as const },
  { key: "3", title: "Mesaj ve bildirim", body: "Teklif ve mesajlar anında cebinizde.", icon: "chatbubbles" as const }
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  return (
    <View style={{ flex: 1, backgroundColor: U.bg, paddingTop: insets.top }}>
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: U.space(4), justifyContent: "center", alignItems: "center" }}>
            <Ionicons name={item.icon} size={80} color={U.primary} />
            <Text style={[T.title, { marginTop: U.space(3), textAlign: "center" }]}>{item.title}</Text>
            <Text style={[T.body, { marginTop: U.space(1.5), textAlign: "center", lineHeight: 22, color: U.textSecondary }]}>{item.body}</Text>
          </View>
        )}
      />
      <View style={{ flexShrink: 0, flexDirection: "row", justifyContent: "center", marginBottom: U.space(2) }}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={{
              width: U.space(1),
              height: U.space(1),
              borderRadius: U.space(0.5),
              marginHorizontal: U.space(0.5),
              backgroundColor: i === index ? U.primary : U.surfaceContainer
            }}
          />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={index < slides.length - 1 ? "Sonraki tanıtım slaydı" : "Başla, telefon ile giriş"}
        onPress={() => {
          if (index < slides.length - 1) {
            listRef.current?.scrollToOffset({ offset: (index + 1) * width, animated: true });
          } else {
            router.replace(hrefPhoneAuth);
          }
        }}
        style={{
          marginHorizontal: U.space(3),
          marginBottom: insets.bottom + U.space(2),
          backgroundColor: U.primary,
          paddingVertical: U.space(2),
          borderRadius: 999,
          alignItems: "center"
        }}
      >
        <Text style={[T.body, { color: U.onPrimary, fontWeight: "700" }]}>{index < slides.length - 1 ? "İleri" : "Başla"}</Text>
      </Pressable>
    </View>
  );
}
