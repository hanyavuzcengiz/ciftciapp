import { Stack } from "expo-router";
import { stackHeaderTheme } from "../lib/navigation";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, ...stackHeaderTheme }}>
      <Stack.Screen name="index" options={{ title: "Ayarlar" }} />
      <Stack.Screen name="profile-edit" options={{ title: "Profili düzenle" }} />
      <Stack.Screen name="business-profile" options={{ title: "Isletme Profili" }} />
      <Stack.Screen name="following" options={{ title: "Takip ettikleriniz" }} />
      <Stack.Screen name="verification" options={{ title: "Doğrulama" }} />
      <Stack.Screen name="verification-admin" options={{ title: "Doğrulama Yönetimi" }} />
      <Stack.Screen name="notifications" options={{ title: "Bildirimler" }} />
      <Stack.Screen name="privacy" options={{ title: "Gizlilik" }} />
      <Stack.Screen name="help" options={{ title: "Yardım" }} />
    </Stack>
  );
}
