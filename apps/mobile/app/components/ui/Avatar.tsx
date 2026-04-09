import { Text, View } from "react-native";
import { T, U } from "../../theme/tokens";

export function Avatar({ label, size = 52 }: { label: string; size?: number }) {
  const ch = (label.trim().charAt(0) || "?").toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: U.secondaryContainer,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Text style={[T.title, { fontSize: size * 0.38, color: U.onSecondaryContainer }]}>{ch}</Text>
    </View>
  );
}
