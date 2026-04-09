import type { PressableProps, ViewStyle } from "react-native";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { T, U } from "../../theme/tokens";

type Variant = "primary" | "secondary" | "ghost";

type Props = Omit<PressableProps, "style"> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
};

export function AppButton({ label, variant = "primary", loading, disabled, style, ...rest }: Props) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const dim = Boolean(disabled || loading);
  const bg = isPrimary
    ? dim
      ? U.surfaceContainer
      : U.primary
    : isSecondary
      ? U.secondaryContainer
      : "transparent";
  const borderWidth = 0;
  const borderColor = "transparent";
  const textColor = isPrimary
    ? dim
      ? U.textMuted
      : U.onPrimary
    : isSecondary
      ? U.onSecondaryContainer
      : U.primary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={dim}
      style={({ pressed }) => ({
        minHeight: U.space(6),
        paddingHorizontal: U.space(2),
        borderRadius: U.radius,
        backgroundColor: bg,
        borderWidth,
        borderColor,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed && !dim ? 0.92 : 1,
        ...style
      })}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? (dim ? U.textMuted : U.onPrimary) : U.primary} />
      ) : (
        <Text style={[T.body, { color: textColor, fontWeight: "600" }]}>{label}</Text>
      )}
    </Pressable>
  );
}
