import { Text, View } from "react-native";
import { T, U } from "../../theme/tokens";

export type NoticeTone = "warning" | "info" | "error";

const toneMap: Record<NoticeTone, { bg: string; border: string; text: string }> = {
  warning: { bg: U.warnBg, border: U.warnBorder, text: U.warnText },
  info: { bg: U.surfaceContainer, border: U.border, text: U.tertiary },
  error: { bg: U.dangerSoft, border: U.dangerBorderMuted, text: U.danger }
};

export function StateNotice(props: { text: string; tone?: NoticeTone; style?: object }) {
  const tone = props.tone ?? "warning";
  const c = toneMap[tone];
  return (
    <View
      style={[
        {
          marginTop: U.space(1),
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.bg,
          borderRadius: U.radius,
          paddingHorizontal: U.space(1.5),
          paddingVertical: U.space(1)
        },
        props.style
      ]}
    >
      <Text style={[T.caption, { color: c.text }]}>{props.text}</Text>
    </View>
  );
}
