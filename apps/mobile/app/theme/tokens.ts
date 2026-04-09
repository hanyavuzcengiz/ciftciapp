/**
 * Pastoral — yüksek sadakat mockup paleti (The Pastoral / PASTORAL görselleri).
 * Native splash / adaptive icon: app.config.js arka plani U.primary ile ayni tutun.
 */
export const U = {
  bg: "#f4f6fb",
  surface: "#ffffff",
  surfaceLow: "#e8edf8",
  surfaceContainer: "#e4ebfa",
  surfaceContainerHigh: "#eef2ff",
  /** Kart / özet alanları (lavanta) */
  surfaceTint: "#edf2ff",
  text: "#1a2b48",
  textSecondary: "#5c6578",
  textMuted: "#7a8499",
  /** Fiyat vurgusu (terracotta) */
  price: "#b33000",
  primary: "#c83e16",
  primaryDark: "#a33212",
  primarySoft: "#ffe8e0",
  secondary: "#2d6a1f",
  secondaryContainer: "#c8f5a0",
  onSecondaryContainer: "#1a4200",
  tertiary: "#0a4d7a",
  limeCta: "#a4f16c",
  onLimeCta: "#1a3d00",
  /** Sekme çubuğu zemini */
  tabBar: "#e8edf5",
  border: "rgba(26, 43, 72, 0.08)",
  warnBg: "#fff7ed",
  warnBorder: "#fdba74",
  warnText: "#9a3412",
  danger: "#ba1a1a",
  dangerSoft: "#ffdad6",
  dangerBorderMuted: "rgba(186, 26, 26, 0.25)",
  dangerBorderStrong: "rgba(186, 26, 26, 0.28)",
  onPrimary: "#ffffff",
  onPrimaryMuted: "rgba(255, 255, 255, 0.88)",
  radius: 14,
  radiusLg: 18,
  radiusFull: 22,
  space: (n: number) => n * 8
} as const;

export const T = {
  brand: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: U.text,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const
  },
  display: { fontSize: 24, fontWeight: "800" as const, color: U.text, letterSpacing: -0.4 },
  title: { fontSize: 19, fontWeight: "700" as const, color: U.text, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: "400" as const, color: U.text },
  caption: { fontSize: 13, fontWeight: "400" as const, color: U.textSecondary },
  overline: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: U.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const
  }
};

export const shadowCard = {
  shadowColor: "#1a2b48",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 4
};

export const shadowFab = {
  shadowColor: "#1a2b48",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 12,
  elevation: 8
};
