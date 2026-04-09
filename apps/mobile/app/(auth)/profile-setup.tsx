import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, apiJsonWithAuth } from "../lib/api";
import { saveBusinessProfileDraft, type BusinessProfileDraft } from "../lib/businessProfileDraft";
import { isMockDataEnabled } from "../lib/mockData";
import { hrefTabs } from "../lib/paths";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

const types = ["farmer", "breeder", "buyer", "supplier", "service_provider", "cooperative"] as const;

const typeLabels: Record<(typeof types)[number], string> = {
  farmer: "Çiftçi",
  breeder: "Üretici",
  buyer: "Alıcı",
  supplier: "Tedarikçi",
  service_provider: "Hizmet veren",
  cooperative: "Kooperatif"
};

const inputBase = {
  borderWidth: 0,
  borderRadius: U.radius,
  paddingHorizontal: U.space(1.5),
  paddingVertical: U.space(1.25),
  fontSize: 15,
  color: U.text,
  backgroundColor: U.surfaceContainerHigh
} as const;

function field(error: boolean, extra?: Record<string, unknown>) {
  return [inputBase, error ? { borderWidth: 1, borderColor: U.danger } : null, extra];
}

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const { setProfileComplete, userId } = useAuthStore();
  const [fullName, setFullName] = useState("Ahmet Ciftci");
  const [userType, setUserType] = useState<(typeof types)[number]>("farmer");
  const [businessName, setBusinessName] = useState("Bereket Tarim");
  const [providerKind, setProviderKind] = useState<"goods" | "services">("goods");
  const [title, setTitle] = useState("Kurucu");
  const [category, setCategory] = useState("Tarim makinesi");
  const [city, setCity] = useState("Konya");
  const [district, setDistrict] = useState("Selcuklu");
  const [addressLine, setAddressLine] = useState("Organize Sanayi Civari");
  const [serviceArea, setServiceArea] = useState("Konya ve cevre ilceler");
  const [contactPerson, setContactPerson] = useState("Ahmet Ciftci");
  const [taxNumber, setTaxNumber] = useState("1234567890");
  const [website, setWebsite] = useState("www.berekettarim.com");
  const [loading, setLoading] = useState(false);
  const normalizedName = fullName.trim().replace(/\s+/g, " ");
  const isNameValid = normalizedName.length >= 3;
  const needsBusinessSection = userType === "supplier" || userType === "service_provider";
  const missingBusinessFields: string[] = [];
  if (needsBusinessSection) {
    if (businessName.trim().length < 2) missingBusinessFields.push("Isletme adi");
    if (category.trim().length < 2) missingBusinessFields.push("Kategori");
    if (city.trim().length < 2) missingBusinessFields.push("Il");
    if (addressLine.trim().length < 5) missingBusinessFields.push("Adres");
    if (contactPerson.trim().length < 2) missingBusinessFields.push("Yetkili kisi");
    if (providerKind === "services" && serviceArea.trim().length < 4) missingBusinessFields.push("Hizmet bolgesi");
    if (providerKind === "goods" && taxNumber.trim().length < 6) missingBusinessFields.push("Vergi numarasi");
  }
  const businessValid = missingBusinessFields.length === 0;

  useEffect(() => {
    if (!needsBusinessSection) return;
    if (!businessName.trim()) setBusinessName("Ornek Isletme");
    if (!contactPerson.trim()) setContactPerson(normalizedName || "Yetkili Kisi");
  }, [needsBusinessSection, businessName, contactPerson, normalizedName]);

  const submit = async () => {
    if (loading) return;
    if (!isNameValid) {
      Toast.show({ type: "error", text1: "Geçerli bir ad soyad girin" });
      return;
    }
    if (!businessValid) {
      Toast.show({ type: "error", text1: "Isletme alanlarini tamamlayin", text2: missingBusinessFields.join(", ") });
      return;
    }
    setLoading(true);
    const draft: BusinessProfileDraft = {
      userType,
      providerKind,
      businessName: businessName.trim() || undefined,
      title: title.trim() || undefined,
      category: category.trim() || undefined,
      city: city.trim() || undefined,
      district: district.trim() || undefined,
      addressLine: addressLine.trim() || undefined,
      serviceArea: serviceArea.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      taxNumber: taxNumber.trim() || undefined,
      website: website.trim() || undefined
    };
    try {
      await saveBusinessProfileDraft(userId, draft);
      await apiJsonWithAuth("/api/v1/auth/register-complete", {
        method: "POST",
        body: JSON.stringify({ fullName: normalizedName, userType })
      });
      setProfileComplete(true);
      appendDemoLog("Profil", "Ilk kurulum tamam");
      Toast.show({ type: "success", text1: "Profil hazır" });
      router.replace(hrefTabs);
    } catch (err) {
      if (isMockDataEnabled()) {
        setProfileComplete(true);
        appendDemoLog("Profil", "Mock modda kayit tamamlandi");
        Toast.show({ type: "success", text1: "Test modu kaydi tamamlandi" });
        router.replace(hrefTabs);
        return;
      }
      Toast.show({
        type: "error",
        text1: "Profil kaydedilemedi",
        text2: err instanceof ApiError || err instanceof Error ? err.message : "Ağ hatası"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: U.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + U.space(3),
          paddingHorizontal: U.space(3),
          paddingBottom: insets.bottom + U.space(3),
          flexGrow: 1
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={T.display}>Profiliniz</Text>
        <Text style={[T.caption, { marginTop: U.space(1) }]}>Diğer üyeler sizi böyle görür.</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Ad Soyad"
          placeholderTextColor={U.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={80}
          editable={!loading}
          onSubmitEditing={() => void submit()}
          style={{
            marginTop: U.space(2.5),
            borderWidth: 0,
            borderRadius: U.radiusLg,
            paddingHorizontal: U.space(2),
            paddingVertical: U.space(1.75),
            fontSize: 16,
            color: U.text,
            backgroundColor: U.surfaceContainerHigh
          }}
        />
        <Text style={[T.body, { marginTop: U.space(2.5), fontWeight: "600" }]}>Hesap türü</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: U.space(1.5) }}>
          {types.map((typeKey) => (
            <Pressable
              key={typeKey}
              accessibilityRole="button"
              accessibilityState={{ selected: userType === typeKey }}
              accessibilityLabel={`Hesap türü: ${typeLabels[typeKey]}`}
              onPress={() => setUserType(typeKey)}
              style={{
                marginRight: U.space(1),
                marginBottom: U.space(1),
                paddingHorizontal: U.space(1.5),
                paddingVertical: U.space(1),
                borderRadius: 999,
                backgroundColor: userType === typeKey ? U.primary : U.surfaceContainerHigh
              }}
            >
              <Text style={[T.caption, { color: userType === typeKey ? U.onPrimary : U.text, fontWeight: "600" }]}>
                {typeLabels[typeKey]}
              </Text>
            </Pressable>
          ))}
        </View>
        {needsBusinessSection ? (
          <View
            style={{
              marginTop: U.space(2.25),
              backgroundColor: U.surfaceLow,
              borderRadius: U.radiusLg,
              borderWidth: 0,
              padding: U.space(2)
            }}
          >
            <Text style={[T.body, { fontWeight: "700", fontSize: 15 }]}>Isletme Profili (Mal/Hizmet Saglayici)</Text>
            {missingBusinessFields.length > 0 ? (
              <Text style={[T.caption, { marginTop: U.space(1), color: U.danger, fontWeight: "600" }]}>
                Eksik: {missingBusinessFields.join(" · ")}
              </Text>
            ) : (
              <Text style={[T.caption, { marginTop: U.space(1), color: U.secondary, fontWeight: "600" }]}>Zorunlu alanlar tamam</Text>
            )}
            <View style={{ flexDirection: "row", marginTop: U.space(1.25), gap: U.space(1) }}>
              <Pressable
                onPress={() => setProviderKind("goods")}
                style={{
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(1),
                  borderRadius: 999,
                  backgroundColor: providerKind === "goods" ? U.primary : U.surfaceContainerHigh
                }}
              >
                <Text style={[T.caption, { color: providerKind === "goods" ? U.onPrimary : U.text, fontWeight: "600" }]}>
                  Mal Saglayici
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setProviderKind("services")}
                style={{
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(1),
                  borderRadius: 999,
                  backgroundColor: providerKind === "services" ? U.primary : U.surfaceContainerHigh
                }}
              >
                <Text style={[T.caption, { color: providerKind === "services" ? U.onPrimary : U.text, fontWeight: "600" }]}>
                  Hizmet Saglayici
                </Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ornek verilerle doldur"
              onPress={() => {
                if (providerKind === "goods") {
                  setBusinessName("Bereket Tarim Market");
                  setTitle("Satis Sorumlusu");
                  setCategory("Tohum ve Gubre");
                  setCity("Konya");
                  setDistrict("Karatay");
                  setAddressLine("Fevzi Cakmak Mah. 1045. Sok.");
                  setServiceArea("Konya merkez ve ilceler");
                  setContactPerson("Mehmet Demir");
                } else {
                  setBusinessName("Anadolu Teknik Servis");
                  setTitle("Servis Yetkilisi");
                  setCategory("Traktor Bakim Servisi");
                  setCity("Ankara");
                  setDistrict("Polatli");
                  setAddressLine("Yeni Sanayi Sitesi 2. Blok");
                  setServiceArea("Ankara, Eskisehir, Kirsehir");
                  setContactPerson("Ali Kaya");
                }
              }}
              style={{
                marginTop: U.space(1.25),
                alignSelf: "flex-start",
                backgroundColor: U.surfaceContainer,
                borderRadius: 999,
                paddingHorizontal: U.space(1.25),
                paddingVertical: U.space(0.75)
              }}
            >
              <Text style={[T.caption, { color: U.tertiary, fontWeight: "700" }]}>Ornek doldur</Text>
            </Pressable>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Isletme adi"
              placeholderTextColor={U.textMuted}
              style={[field(missingBusinessFields.includes("Isletme adi")), { marginTop: U.space(1.25) }]}
            />
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Unvan (or. Kurucu / Saha Sorumlusu)"
              placeholderTextColor={U.textMuted}
              style={[field(false), { marginTop: U.space(1) }]}
            />
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder={
                providerKind === "goods" ? "Kategori (or. Gubre, Tohum, Sulama)" : "Kategori (or. Traktor bakim, Ilaclama, Nakliye)"
              }
              placeholderTextColor={U.textMuted}
              style={[field(missingBusinessFields.includes("Kategori")), { marginTop: U.space(1) }]}
            />
            <View style={{ flexDirection: "row", marginTop: U.space(1) }}>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Il"
                placeholderTextColor={U.textMuted}
                style={[field(missingBusinessFields.includes("Il")), { flex: 1, marginRight: U.space(1) }]}
              />
              <TextInput
                value={district}
                onChangeText={setDistrict}
                placeholder="Ilce"
                placeholderTextColor={U.textMuted}
                style={[field(false), { flex: 1 }]}
              />
            </View>
            <TextInput
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder="Adres satiri"
              placeholderTextColor={U.textMuted}
              style={[field(missingBusinessFields.includes("Adres")), { marginTop: U.space(1) }]}
            />
            <TextInput
              value={serviceArea}
              onChangeText={setServiceArea}
              placeholder="Hizmet bolgesi"
              placeholderTextColor={U.textMuted}
              style={[field(missingBusinessFields.includes("Hizmet bolgesi")), { marginTop: U.space(1) }]}
            />
            <TextInput
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder="Yetkili kisi"
              placeholderTextColor={U.textMuted}
              style={[field(missingBusinessFields.includes("Yetkili kisi")), { marginTop: U.space(1) }]}
            />
            <TextInput
              value={taxNumber}
              onChangeText={setTaxNumber}
              placeholder="Vergi numarasi (opsiyonel)"
              placeholderTextColor={U.textMuted}
              keyboardType="number-pad"
              style={[field(missingBusinessFields.includes("Vergi numarasi")), { marginTop: U.space(1) }]}
            />
            <TextInput
              value={website}
              onChangeText={setWebsite}
              placeholder="Web sitesi (opsiyonel)"
              placeholderTextColor={U.textMuted}
              autoCapitalize="none"
              style={[field(false), { marginTop: U.space(1) }]}
            />
          </View>
        ) : null}
        <Pressable
          testID="e2e-profile-submit"
          accessibilityRole="button"
          accessibilityLabel="Profili kaydet ve uygulamaya gir"
          onPress={() => void submit()}
          disabled={loading || !isNameValid || !businessValid}
          style={{
            marginTop: U.space(4),
            backgroundColor: loading || !isNameValid || !businessValid ? U.textMuted : U.primary,
            paddingVertical: U.space(2),
            borderRadius: 999,
            alignItems: "center"
          }}
        >
          <Text style={[T.body, { color: U.onPrimary, fontWeight: "700" }]}>{loading ? "Kaydediliyor..." : "Uygulamaya gir"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
