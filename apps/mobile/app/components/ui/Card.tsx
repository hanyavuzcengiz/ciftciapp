import type { ReactNode } from "react";
import { View } from "react-native";
import { shadowCard, U } from "../../theme/tokens";

export function Card(props: { children: ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          backgroundColor: U.surface,
          borderRadius: U.radiusLg,
          borderWidth: 0,
          overflow: "hidden"
        },
        shadowCard,
        props.style
      ]}
    >
      {props.children}
    </View>
  );
}
