import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiJsonWithAuth } from "../lib/api";
import { loadBusinessProfileDraft, saveBusinessProfileDraft, type BusinessProfileDraft } from "../lib/businessProfileDraft";
import { appendDemoLog } from "../store/demoLog";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

const fieldBase = {
  marginTop: U.space(1.25),
  borderWidth: 0,
  borderRadius: U.radius,
  paddingHorizontal: U.space(1.5),
  paddingVertical: U.space(1.5),
  fontSize: 15,
  color: U.text,
  backgroundColor: U.surfaceContainerHigh
} as const;

function fieldStyle(missing: boolean) {
  return [fieldBase, missing ? { borderWidth: 1, borderColor: U.danger } : null];
}

function readStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

type BusinessFormSetters = {
  setProviderKind: (v: "goods" | "services") => void;
  setBusinessName: (v: string) => void;
  setTitle: (v: string) => void;
  setCategory: (v: string) => void;
  setCity: (v: string) => void;
  setDistrict: (v: string) => void;
  setAddressLine: (v: string) => void;
  setServiceArea: (v: string) => void;
  setContactPerson: (v: string) => void;
  setWhatsapp: (v: string) => void;
  setWorkingHours: (v: string) => void;
  setTaxOffice: (v: string) => void;
  setTaxNumber: (v: string) => void;
  setTradeRegistryNo: (v: string) => void;
  setDeliveryTypes: (v: string) => void;
  setWebsite: (v: string) => void;
};

/** Sunucu veya taslaktan form alanlarına aktarır */
function applyBusinessFormData(setters: BusinessFormSetters, src: BusinessProfileDraft | Record<string, unknown>) {
  const r = src as Record<string, unknown>;
  const pk = readStr(r.providerKind);
  if (pk === "services" || pk === "goods") setters.setProviderKind(pk);
  setters.setBusinessName(readStr(r.businessName) ?? "");
  setters.setTitle(readStr(r.title) ?? "");
  setters.setCategory(readStr(r.category) ?? "");
  setters.setCity(readStr(r.city) ?? "");
  setters.setDistrict(readStr(r.district) ?? "");
  setters.setAddressLine(readStr(r.addressLine) ?? "");
  setters.setServiceArea(readStr(r.serviceArea) ?? "");
  setters.setContactPerson(readStr(r.contactPerson) ?? "");
  setters.setWhatsapp(readStr(r.whatsapp) ?? "");
  setters.setWorkingHours(readStr(r.workingHours) ?? "");
  setters.setTaxOffice(readStr(r.taxOffice) ?? "");
  setters.setTaxNumber(readStr(r.taxNumber) ?? "");
  setters.setTradeRegistryNo(readStr(r.tradeRegistryNo) ?? "");
  setters.setDeliveryTypes(readStr(r.deliveryTypes) ?? "");
  setters.setWebsite(readStr(r.website) ?? "");
}

export default function BusinessProfileScreen() {
  const insets = useSafeAreaInsets();
  const { userId, accessToken } = useAuthStore();
  const [providerKind, setProviderKind] = useState<"goods" | "services">("goods");
  const [businessName, setBusinessName] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [tradeRegistryNo, setTradeRegistryNo] = useState("");
  const [deliveryTypes, setDeliveryTypes] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const missingFields: string[] = [];
  if (businessName.trim().length < 2) missingFields.push("Isletme adi");
  if (category.trim().length < 2) missingFields.push("Kategori");
  if (city.trim().length < 2) missingFields.push("Il");
  if (addressLine.trim().length < 5) missingFields.push("Adres");
  if (contactPerson.trim().length < 2) missingFields.push("Yetkili kisi");
  if (providerKind === "services" && workingHours.trim().length < 4) missingFields.push("Calisma saatleri");
  if (providerKind === "services" && whatsapp.trim().length < 10) missingFields.push("WhatsApp hatti");
  if (providerKind === "goods" && deliveryTypes.trim().length < 4) missingFields.push("Teslimat turleri");
  const requiredTotal = providerKind === "services" ? 7 : 6;
  const completionPercent = Math.round(((requiredTotal - missingFields.length) / requiredTotal) * 100);

  useEffect(() => {
    let mounted = true;
    const setters: BusinessFormSetters = {
      setProviderKind,
      setBusinessName,
      setTitle,
      setCategory,
      setCity,
      setDistrict,
      setAddressLine,
      setServiceArea,
      setContactPerson,
      setWhatsapp,
      setWorkingHours,
      setTaxOffice,
      setTaxNumber,
      setTradeRegistryNo,
      setDeliveryTypes,
      setWebsite
    };
    (async () => {
      const draft = await loadBusinessProfileDraft(userId);
      if (!mounted) return;
      if (draft) applyBusinessFormData(setters, draft);
      if (accessToken) {
        try {
          const me = await apiJsonWithAuth<{
            persisted?: boolean;
            businessProfile?: Record<string, unknown> | null;
          }>("/api/v1/users/me");
          if (
            !mounted ||
            !me?.persisted ||
            !me.businessProfile ||
            typeof me.businessProfile !== "object"
          )
            return;
          applyBusinessFormData(setters, me.businessProfile);
        } catch {
          /* yerel taslak */
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, accessToken]);

  const fillSample = () => {
    if (providerKind === "goods") {
      setBusinessName("Bereket Tarim Tedarik");
      setTitle("Bolge Satis Muduru");
      setCategory("Tohum, Gubre, Sulama");
      setCity("Konya");
      setDistrict("Meram");
      setAddressLine("Aykent Sanayi 3. Cadde No:24");
      setServiceArea("Konya ve cevre ilceler");
      setContactPerson("Ahmet Ciftci");
      setWhatsapp("05321234567");
      setWorkingHours("Pzt-Cmt 08:30-19:00");
      setTaxOffice("Meram VD");
      setTaxNumber("1234567890");
      setTradeRegistryNo("TR-2026-4451");
      setDeliveryTypes("Magazadan teslim, Kargo, Sehir ici teslimat");
      setWebsite("www.berekettedarik.com");
      return;
    }
    setBusinessName("Anadolu Tarim Servis");
    setTitle("Servis Koordinatoru");
    setCategory("Traktor bakim, Tarla ilaclama, Nakliye");
    setCity("Eskisehir");
    setDistrict("Tepebasi");
    setAddressLine("Organize Sanayi 2. Blok No:9");
    setServiceArea("Eskisehir, Kutahya, Bilecik");
    setContactPerson("Mehmet Yildiz");
    setWhatsapp("05329876543");
    setWorkingHours("Her gun 09:00-21:00");
    setTaxOffice("Tepebasi VD");
    setTaxNumber("9876543210");
    setTradeRegistryNo("SRV-2026-101");
    setDeliveryTypes("Yerinde servis, Randevulu servis");
    setWebsite("www.anadoluservis.com");
  };

  const onSave = async () => {
    if (saving) return;
    if (missingFields.length > 0) {
      Toast.show({ type: "error", text1: "Zorunlu alanlar eksik", text2: missingFields.join(", ") });
      return;
    }
    setSaving(true);
    try {
      const payload: BusinessProfileDraft = {
        providerKind,
        businessName: businessName.trim() || undefined,
        title: title.trim() || undefined,
        category: category.trim() || undefined,
        city: city.trim() || undefined,
        district: district.trim() || undefined,
        addressLine: addressLine.trim() || undefined,
        serviceArea: serviceArea.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        workingHours: workingHours.trim() || undefined,
        taxOffice: taxOffice.trim() || undefined,
        taxNumber: taxNumber.trim() || undefined,
        tradeRegistryNo: tradeRegistryNo.trim() || undefined,
        deliveryTypes: deliveryTypes.trim() || undefined,
        website: website.trim() || undefined
      };
      await saveBusinessProfileDraft(userId, payload);
      let serverOk = false;
      if (accessToken) {
        try {
          await apiJsonWithAuth("/api/v1/users/me", {
            method: "PUT",
            body: JSON.stringify({ businessProfile: payload })
          });
          serverOk = true;
        } catch {
          serverOk = false;
        }
      }
      appendDemoLog("Isletme", "Isletme profili guncellendi");
      Toast.show({
        type: "success",
        text1: "Isletme profili kaydedildi",
        text2: serverOk ? "Sunucu ile senkron." : accessToken ? "Cihazda kayitli; sunucu yazilamadi." : "Cihazda kayitli; sunucu icin giris yapin."
      });
    } finally {
      setSaving(false);
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
        contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(3), flexGrow: 1 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={T.display}>Isletme Profili</Text>
        <Text style={[T.caption, { marginTop: U.space(0.75) }]}>
          Mal/hizmet sağlayıcı profiliniz cihazda saklanır; giriş yaptıysanız kayıt sunucuya da yazılır.
        </Text>
        {missingFields.length > 0 ? (
          <View
            style={{
              marginTop: U.space(1.25),
              backgroundColor: U.warnBg,
              borderColor: U.warnBorder,
              borderWidth: 1,
              borderRadius: U.radius,
              padding: U.space(1.25)
            }}
          >
            <Text style={[T.body, { color: U.warnText, fontWeight: "700" }]}>Eksik zorunlu alanlar</Text>
            <Text style={[T.caption, { color: U.warnText, marginTop: U.space(0.5) }]}>{missingFields.join(" · ")}</Text>
          </View>
        ) : (
          <View
            style={{
              marginTop: U.space(1.25),
              backgroundColor: U.secondaryContainer,
              borderWidth: 0,
              borderRadius: U.radius,
              padding: U.space(1.25)
            }}
          >
            <Text style={[T.body, { color: U.onSecondaryContainer, fontWeight: "700" }]}>Zorunlu alanlar tamam</Text>
          </View>
        )}
        <View style={{ marginTop: U.space(1.25) }}>
          <Text style={[T.caption, { fontWeight: "700" }]}>Tamamlanma: %{completionPercent}</Text>
          <View
            style={{
              marginTop: U.space(0.75),
              height: U.space(1),
              borderRadius: 999,
              backgroundColor: U.surfaceContainer,
              overflow: "hidden"
            }}
          >
            <View
              style={{
                width: `${completionPercent}%`,
                height: "100%",
                backgroundColor: missingFields.length > 0 ? U.primary : U.secondary
              }}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", marginTop: U.space(1.5), gap: U.space(1) }}>
          <Pressable
            onPress={() => setProviderKind("goods")}
            style={{
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(1),
              borderRadius: 999,
              backgroundColor: providerKind === "goods" ? U.primary : U.surfaceContainerHigh
            }}
          >
            <Text style={[T.caption, { color: providerKind === "goods" ? U.onPrimary : U.text, fontWeight: "700" }]}>
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
            <Text style={[T.caption, { color: providerKind === "services" ? U.onPrimary : U.text, fontWeight: "700" }]}>
              Hizmet Saglayici
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={fillSample}
          style={{
            marginTop: U.space(1.25),
            alignSelf: "flex-start",
            backgroundColor: U.surfaceContainer,
            borderRadius: 999,
            paddingHorizontal: U.space(1.5),
            paddingVertical: U.space(1)
          }}
        >
          <Text style={[T.caption, { color: U.tertiary, fontWeight: "700" }]}>Ornek doldur</Text>
        </Pressable>

        <TextInput
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Isletme adi *"
          placeholderTextColor={U.textMuted}
          style={fieldStyle(missingFields.includes("Isletme adi"))}
        />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Unvan"
          placeholderTextColor={U.textMuted}
          style={fieldBase}
        />
        <TextInput
          value={category}
          onChangeText={setCategory}
          placeholder="Kategori / Uzmanlik *"
          placeholderTextColor={U.textMuted}
          style={fieldStyle(missingFields.includes("Kategori"))}
        />
        <View style={{ flexDirection: "row" }}>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Il *"
            placeholderTextColor={U.textMuted}
            style={[...fieldStyle(missingFields.includes("Il")), { flex: 1, marginRight: U.space(1) }]}
          />
          <TextInput
            value={district}
            onChangeText={setDistrict}
            placeholder="Ilce"
            placeholderTextColor={U.textMuted}
            style={[fieldBase, { flex: 1 }]}
          />
        </View>
        <TextInput
          value={addressLine}
          onChangeText={setAddressLine}
          placeholder="Adres *"
          placeholderTextColor={U.textMuted}
          style={fieldStyle(missingFields.includes("Adres"))}
        />
        <TextInput
          value={serviceArea}
          onChangeText={setServiceArea}
          placeholder="Hizmet bolgesi"
          placeholderTextColor={U.textMuted}
          style={fieldBase}
        />
        <TextInput
          value={contactPerson}
          onChangeText={setContactPerson}
          placeholder="Yetkili kisi *"
          placeholderTextColor={U.textMuted}
          style={fieldStyle(missingFields.includes("Yetkili kisi"))}
        />
        <TextInput
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder={providerKind === "services" ? "WhatsApp hatti *" : "WhatsApp hatti"}
          placeholderTextColor={U.textMuted}
          keyboardType="phone-pad"
          style={fieldStyle(missingFields.includes("WhatsApp hatti"))}
        />
        <TextInput
          value={workingHours}
          onChangeText={setWorkingHours}
          placeholder={providerKind === "services" ? "Calisma saatleri *" : "Calisma saatleri"}
          placeholderTextColor={U.textMuted}
          style={fieldStyle(missingFields.includes("Calisma saatleri"))}
        />
        <TextInput
          value={taxOffice}
          onChangeText={setTaxOffice}
          placeholder="Vergi dairesi"
          placeholderTextColor={U.textMuted}
          style={fieldBase}
        />
        <TextInput
          value={taxNumber}
          onChangeText={setTaxNumber}
          placeholder="Vergi numarasi"
          placeholderTextColor={U.textMuted}
          keyboardType="number-pad"
          style={fieldBase}
        />
        <TextInput
          value={tradeRegistryNo}
          onChangeText={setTradeRegistryNo}
          placeholder="Ticaret / MERSIS no"
          placeholderTextColor={U.textMuted}
          style={fieldBase}
        />
        <TextInput
          value={deliveryTypes}
          onChangeText={setDeliveryTypes}
          placeholder={providerKind === "goods" ? "Teslimat turleri *" : "Teslimat turleri"}
          placeholderTextColor={U.textMuted}
          style={[...fieldStyle(missingFields.includes("Teslimat turleri")), { minHeight: U.space(9.75) }]}
          multiline
        />
        <TextInput
          value={website}
          onChangeText={setWebsite}
          placeholder="Web sitesi"
          placeholderTextColor={U.textMuted}
          autoCapitalize="none"
          style={fieldBase}
        />

        <Pressable
          onPress={() => void onSave()}
          disabled={saving}
          style={{
            marginTop: U.space(2.5),
            backgroundColor: saving ? U.textMuted : U.primary,
            paddingVertical: U.space(1.75),
            borderRadius: 999,
            alignItems: "center"
          }}
        >
          <Text style={[T.body, { color: U.onPrimary, fontWeight: "700" }]}>{saving ? "Kaydediliyor..." : "Kaydet"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
