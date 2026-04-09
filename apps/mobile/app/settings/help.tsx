import { ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T, U } from "../theme/tokens";

const bullet = { marginTop: U.space(1.25), ...T.body, lineHeight: 22 };
const updateItem = { marginTop: U.space(1), ...T.body, lineHeight: 22 };

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: U.bg }}
      contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(4), flexGrow: 1 }}
      keyboardDismissMode="on-drag"
    >
      <Text style={T.title}>Yardım</Text>
      <Text style={[T.caption, { marginTop: U.space(1) }]}>AgroMarket mobil uygulaması — kısa rehber.</Text>

      <Text style={[T.body, { marginTop: U.space(2.75), fontWeight: "700", fontSize: 16 }]}>Son Gelismeler (Nisan 2026)</Text>
      <Text style={updateItem}>• Profil, Ilan Ver ve Mesaj ekranlari sade bir tasarima guncellendi.</Text>
      <Text style={updateItem}>• Ortak tasarim sistemi: tek tip kart, baslik, buton ve durum bilesenleri eklendi.</Text>
      <Text style={updateItem}>• Ilan Ver adim adim akisa cevrildi (Kategori → Baslik → Aciklama → Fiyat → Konum → Fotograf).</Text>
      <Text style={updateItem}>• Mesaj listesi WhatsApp benzeri satir yapisina; sohbet ekrani teklif vurgusuna kavustu.</Text>
      <Text style={updateItem}>• Test gunlugu ve mock/fallback akislarinin gorunurlugu iyilestirildi.</Text>
      <Text style={updateItem}>• Release smoke kontrolleri yesil: gateway, listing, search, category spec.</Text>

      <Text style={[T.body, { marginTop: U.space(2.75), fontWeight: "700", fontSize: 16 }]}>Giriş</Text>
      <Text style={bullet}>Telefon numaranızı E.164 formatında girin (ör. +905551234567), OTP ile doğrulayın.</Text>
      <Text style={bullet}>Profil tamamlama adımında ad-soyad ve kullanıcı tipini kaydedin; ilan vermek için gereklidir.</Text>

      <Text style={[T.body, { marginTop: U.space(2.75), fontWeight: "700", fontSize: 16 }]}>İlan ve arama</Text>
      <Text style={bullet}>Ana sayfa ve Arama sekmeleri API’deki yayında ilanları listeler.</Text>
      <Text style={bullet}>İlan detayında satıcı profiline gidebilir, teklif verebilir veya mesaj başlatabilirsiniz.</Text>

      <Text style={[T.body, { marginTop: U.space(2.75), fontWeight: "700", fontSize: 16 }]}>Teklif ve mesaj</Text>
      <Text style={bullet}>Tekliflerim: Profil → Tekliflerim. Gelen teklifleri kabul veya red edebilirsiniz.</Text>
      <Text style={bullet}>Mesajlar: İlan detayından “Satıcıya yaz” ile ilan bağlı sohbet açılır; Mesajlar sekmesinden devam edilir.</Text>
      <Text style={bullet}>
        Kullanıcı profilinde (UUID veya paylaşılan profil linki) “Mesaj” ile de doğrudan yazışma başlatabilirsiniz; karşı taraf kayıtlı ve
        telefonu sistemdeyse sohbet açılır.
      </Text>
      <Text style={bullet}>Ayarlar → Bildirimler: kutudaki satıra dokununca ilgili sohbet veya ilan sayfasına gidebilirsiniz.</Text>
      <Text style={bullet}>Ayarlar → Profili düzenle: ad-soyad ve kısa tanıtım metnini sunucuya kaydeder.</Text>

      <Text style={[T.body, { marginTop: U.space(2.75), fontWeight: "700", fontSize: 16 }]}>Sorun giderme</Text>
      <Text style={bullet}>API adresi: Geliştirme için `app.json` / `extra.apiUrl` veya `EXPO_PUBLIC_API_URL` (varsayılan 127.0.0.1:3000).</Text>
      <Text style={bullet}>Sunucu ve Postgres çalışmıyorsa profil veya ilanlar yüklenmeyebilir.</Text>
    </ScrollView>
  );
}
