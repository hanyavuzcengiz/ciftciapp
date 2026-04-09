import { ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T, U } from "../theme/tokens";

const p = { marginTop: U.space(1.25), ...T.body, lineHeight: 22 };

export default function PrivacySettings() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: U.bg }}
      contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(4), flexGrow: 1 }}
      keyboardDismissMode="on-drag"
    >
      <Text style={T.title}>Gizlilik özeti</Text>
      <Text style={[T.caption, { marginTop: U.space(1) }]}>Bu metin bilgilendirme amaçlıdır; yasal metin avukat onayı ile güncellenmelidir.</Text>

      <Text style={[T.body, { marginTop: U.space(2.5), fontWeight: "700" }]}>Toplanan veriler</Text>
      <Text style={p}>Telefon numarası (giriş), profil bilgileri (ad, tip, isteğe bağlı biyografi), ilan ve teklif içerikleri, mesajlar (sunucuda şifrelenmiş saklama yapılandırmasına bağlı).</Text>

      <Text style={[T.body, { marginTop: U.space(2.5), fontWeight: "700" }]}>Konum</Text>
      <Text style={p}>Harita veya yakın ilan özellikleri etkinse cihaz konumu işlenebilir; şu an çekirdek akışta zorunlu değildir.</Text>

      <Text style={[T.body, { marginTop: U.space(2.5), fontWeight: "700" }]}>Hesap silme (KVKK)</Text>
      <Text style={p}>Talebinizi destek kanalı üzerinden iletebilirsiniz; teknik olarak kullanıcı ve ilişkili kayıtlar yönetim politikasına göre anonimleştirilir veya silinir.</Text>

      <Text style={[T.body, { marginTop: U.space(2.5), fontWeight: "700" }]}>Çerez / analitik</Text>
      <Text style={p}>Mobil istemci tarafında oturum için yerel depolama (ör. AsyncStorage) kullanılır; üçüncü taraf reklam çerezi yoktur.</Text>
    </ScrollView>
  );
}
