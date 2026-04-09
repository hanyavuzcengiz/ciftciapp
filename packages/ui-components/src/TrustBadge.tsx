import React from "react";
import { Text, View } from "react-native";

/** Pastoral güven rozeti (TrustScoreVisual yeşil halka ile uyumlu) — props ile özelleştirilebilir. */
const DEFAULT_BG = "#a2f569";
const DEFAULT_FG = "#347000";

export function TrustBadge({
  score,
  backgroundColor = DEFAULT_BG,
  textColor = DEFAULT_FG
}: {
  score: number;
  backgroundColor?: string;
  textColor?: string;
}) {
  const n = Number.isFinite(score) ? score : 0;
  const rounded = Math.round(Math.max(0, Math.min(100, n)));
  const label = `Güven skoru: ${rounded}`;
  const a11y = `Güven skoru ${rounded} üzerinden yüz`;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11y}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor,
        alignSelf: "flex-start"
      }}
    >
      <Text style={{ color: textColor, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </View>
  );
}
