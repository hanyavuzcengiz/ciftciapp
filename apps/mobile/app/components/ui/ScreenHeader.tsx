import { Text, View } from "react-native";
import { T, U } from "../../theme/tokens";

export function ScreenHeader(props: { title: string; subtitle?: string; warning?: string }) {
  return (
    <View style={{ paddingHorizontal: U.space(2), paddingTop: U.space(2), paddingBottom: U.space(1) }}>
      <Text style={T.title}>{props.title}</Text>
      {props.subtitle ? <Text style={[T.caption, { marginTop: U.space(0.5) }]}>{props.subtitle}</Text> : null}
      {props.warning ? <Text style={[T.caption, { marginTop: U.space(0.75), color: U.warnText }]}>{props.warning}</Text> : null}
    </View>
  );
}
