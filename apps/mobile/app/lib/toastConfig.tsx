import React from "react";
import { BaseToast, ToastConfig } from "react-native-toast-message";
import { T, U, shadowCard } from "../theme/tokens";

function toastFrame(borderLeftColor: string) {
  return {
    borderLeftColor,
    borderLeftWidth: U.space(0.5),
    backgroundColor: U.surface,
    borderRadius: U.radiusLg,
    width: "92%" as const,
    maxWidth: U.space(50),
    minHeight: U.space(7.25),
    shadowColor: shadowCard.shadowColor,
    shadowOffset: shadowCard.shadowOffset,
    shadowOpacity: shadowCard.shadowOpacity,
    shadowRadius: shadowCard.shadowRadius,
    elevation: shadowCard.elevation
  };
}

/** react-native-toast-message — Pastoral renk ve tipografi */
export const pastoralToastConfig: ToastConfig = {
  success: (p) => (
    <BaseToast
      onPress={p.onPress}
      text1={p.text1}
      text2={p.text2}
      text1Style={[T.body, { fontWeight: "700" }, p.text1Style]}
      text2Style={[T.caption, p.text2Style]}
      style={toastFrame(U.secondary)}
    />
  ),
  error: (p) => (
    <BaseToast
      onPress={p.onPress}
      text1={p.text1}
      text2={p.text2}
      text1Style={[T.body, { fontWeight: "700" }, p.text1Style]}
      text2Style={[T.caption, p.text2Style]}
      style={toastFrame(U.danger)}
    />
  ),
  info: (p) => (
    <BaseToast
      onPress={p.onPress}
      text1={p.text1}
      text2={p.text2}
      text1Style={[T.body, { fontWeight: "700" }, p.text1Style]}
      text2Style={[T.caption, p.text2Style]}
      style={toastFrame(U.tertiary)}
    />
  )
};
