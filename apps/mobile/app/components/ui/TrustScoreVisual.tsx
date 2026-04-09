import { Text, View } from "react-native";
import { T, U } from "../../theme/tokens";

/** Basit güven halkası: ek paket yok, kalın çerçeve + skor. */
export function TrustScoreVisual({ score }: { score: number }) {
  const s = Math.min(100, Math.max(0, Math.round(score)));
  const ring = s >= 70 ? U.secondary : s >= 50 ? U.primaryDark : U.textMuted;

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: U.space(11),
          height: U.space(11),
          borderRadius: U.space(5.5),
          borderWidth: U.space(0.625),
          borderColor: ring,
          backgroundColor: U.primarySoft,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={[T.title, { fontSize: 22, color: U.text }]}>{s}</Text>
        <Text style={[T.caption, { color: U.textMuted, marginTop: U.space(0.25) }]}>/ 100</Text>
      </View>
      <Text style={[T.caption, { marginTop: U.space(1), textAlign: "center" }]}>Guven puani</Text>
    </View>
  );
}
