import { U } from "../theme/tokens";

/** Ortak Stack başlık görünümü (kök detay ekranları + Ayarlar). */
export const stackHeaderTheme = {
  headerStyle: { backgroundColor: U.surface },
  headerTitleStyle: { fontWeight: "700" as const, color: U.text },
  headerShadowVisible: false,
  headerTintColor: U.primary,
  headerBackTitle: "Geri"
};
