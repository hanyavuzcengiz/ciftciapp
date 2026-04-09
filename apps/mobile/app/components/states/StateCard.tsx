import type { ViewStyle } from "react-native";
import { Text } from "react-native";
import { AppButton } from "../ui/AppButton";
import { Card } from "../ui/Card";
import { T, U } from "../../theme/tokens";

export function StateCard(props: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) {
  return (
    <Card
      style={[
        { marginTop: U.space(2), padding: U.space(2), alignItems: "center", borderRadius: U.radiusFull },
        props.style
      ]}
    >
      <Text style={[T.body, { fontWeight: "600", textAlign: "center" }]}>{props.title}</Text>
      {props.description ? (
        <Text style={[T.caption, { marginTop: U.space(1), textAlign: "center" }]}>{props.description}</Text>
      ) : null}
      {props.actionLabel && props.onAction ? (
        <AppButton label={props.actionLabel} variant="secondary" onPress={props.onAction} style={{ marginTop: U.space(2), width: "100%" }} />
      ) : null}
    </Card>
  );
}
