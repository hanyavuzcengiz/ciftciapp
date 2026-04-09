import { Linking } from "react-native";
import Toast from "react-native-toast-message";

/** E.164 veya rakamlardan oluşan numarayı `tel:` ile sistem aramasında açar. */
export async function openPhoneDialer(raw: string): Promise<boolean> {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) {
    Toast.show({ type: "error", text1: "Telefon numarasi bulunamadi" });
    return false;
  }

  let e164 = trimmed;
  if (!e164.startsWith("+")) {
    const digits = e164.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) {
      e164 = `+${digits}`;
    } else {
      Toast.show({ type: "error", text1: "Gecersiz numara formati" });
      return false;
    }
  }

  const url = `tel:${e164}`;
  try {
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Toast.show({
        type: "info",
        text1: "Bu cihazda arama acilamadi",
        text2: e164
      });
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    Toast.show({ type: "error", text1: "Arama baslatilamadi" });
    return false;
  }
}
