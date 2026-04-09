import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { apiJsonWithAuth } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { T, U, shadowCard } from "../theme/tokens";

type Step = {
  path: string;
  key: "phone" | "nationalId" | "taxNumber" | "agriculturalId";
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  level: string;
};

const STEPS: Step[] = [
  {
    path: "/api/v1/verifications/phone",
    key: "phone",
    title: "Telefon doğrulaması",
    subtitle: "SMS ile numaranızı onaylayın. Güvenli mesajlaşma için zorunlu adım.",
    icon: "call-outline",
    level: "Seviye 0"
  },
  {
    path: "/api/v1/verifications/national-id",
    key: "nationalId",
    title: "Kimlik doğrulaması",
    subtitle: "TC kimlik veya e-Devlet yönlendirmesi (entegrasyon iskeleti).",
    icon: "id-card-outline",
    level: "Seviye 1"
  },
  {
    path: "/api/v1/verifications/tax-number",
    key: "taxNumber",
    title: "Vergi numarası",
    subtitle: "Şahıs / şirket vergi bilgisi; ticari ilanlar için önerilir.",
    icon: "document-text-outline",
    level: "Seviye 2"
  },
  {
    path: "/api/v1/verifications/agricultural-id",
    key: "agriculturalId",
    title: "Çiftçi kayıt belgesi",
    subtitle: "ÇKS veya eşdeğer belge ile üretici doğrulaması.",
    icon: "leaf-outline",
    level: "Seviye 2"
  }
];

type StatusVal = "approved" | "pending" | "rejected" | "none";
const ALLOWED_DOC_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_DOC_BYTES = 5 * 1024 * 1024;
type VerificationSummary = {
  persisted?: boolean;
  phone?: StatusVal;
  nationalId?: StatusVal;
  taxNumber?: StatusVal;
  agriculturalId?: StatusVal;
  reapplyCooldownHours?: number;
  nationalIdReapplyAt?: string | null;
  taxNumberReapplyAt?: string | null;
  agriculturalIdReapplyAt?: string | null;
};

function statusMeta(v: StatusVal): { label: string; color: string; icon: keyof typeof Ionicons.glyphMap } {
  if (v === "approved") return { label: "Onaylandı", color: "#2e7d32", icon: "checkmark-circle" };
  if (v === "pending") return { label: "İncelemede", color: "#b26a00", icon: "time" };
  if (v === "rejected") return { label: "Reddedildi", color: "#c62828", icon: "close-circle" };
  return { label: "Başlatılmadı", color: "#6b7280", icon: "ellipse-outline" };
}

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [selectedDocKey, setSelectedDocKey] = useState<"nationalId" | "taxNumber" | "agriculturalId" | null>(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [pickedDoc, setPickedDoc] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const summaryQ = useQuery({
    queryKey: ["verifications", "summary"],
    enabled: Boolean(accessToken),
    queryFn: () => apiJsonWithAuth<VerificationSummary>("/api/v1/verifications/summary")
  });
  const action = useMutation({
    mutationFn: async ({ path }: { path: string }) =>
      apiJsonWithAuth<{ status?: string }>(path, { method: "POST", body: "{}" }),
    onSuccess: (_res, vars) => {
      void summaryQ.refetch();
      const step = STEPS.find((s) => s.path === vars.path);
      Toast.show({ type: "success", text1: step?.title ?? "Tamam" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Hata" })
  });
  const uploadDoc = useMutation({
    mutationFn: async (vars: { kindPath: "national-id" | "tax-number" | "agricultural-id"; url: string }) =>
      apiJsonWithAuth<{ status?: string }>(`/api/v1/verifications/${vars.kindPath}/document`, {
        method: "POST",
        body: JSON.stringify({ documentUrl: vars.url.trim() })
      }),
    onSuccess: () => {
      Toast.show({ type: "success", text1: "Belge bağlantısı gönderildi" });
      setDocumentUrl("");
      setSelectedDocKey(null);
      void summaryQ.refetch();
    },
    onError: (e) => Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Belge gönderilemedi" })
  });
  const uploadDocInline = useMutation({
    mutationFn: async (vars: {
      kindPath: "national-id" | "tax-number" | "agricultural-id";
      uri: string;
      fileName: string;
      mimeType?: string;
    }) => {
      const base64 = await FileSystem.readAsStringAsync(vars.uri, { encoding: "base64" });
      return apiJsonWithAuth<{ status?: string }>(`/api/v1/verifications/${vars.kindPath}/document-inline`, {
        method: "POST",
        body: JSON.stringify({
          fileName: vars.fileName,
          mimeType: vars.mimeType || "application/octet-stream",
          base64
        })
      });
    },
    onSuccess: () => {
      Toast.show({ type: "success", text1: "Dosya gönderildi" });
      setPickedDoc(null);
      setDocumentUrl("");
      setSelectedDocKey(null);
      void summaryQ.refetch();
    },
    onError: (e) => Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Dosya gönderilemedi" })
  });

  const getStatus = (k: Step["key"]): StatusVal => {
    const raw = summaryQ.data?.[k];
    return raw === "approved" || raw === "pending" || raw === "rejected" || raw === "none" ? raw : "none";
  };
  const getReapplyAt = (k: Step["key"]): string | null => {
    if (k === "nationalId") return summaryQ.data?.nationalIdReapplyAt ?? null;
    if (k === "taxNumber") return summaryQ.data?.taxNumberReapplyAt ?? null;
    if (k === "agriculturalId") return summaryQ.data?.agriculturalIdReapplyAt ?? null;
    return null;
  };
  const getRemainingText = (iso: string | null): string | null => {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return null;
    const h = Math.ceil(ms / (60 * 60 * 1000));
    return `${h} saat sonra tekrar başvurabilirsiniz`;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: U.bg }}
      contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(3), flexGrow: 1 }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={T.title}>Hesap doğrulama</Text>
      <Text style={[T.caption, { marginTop: U.space(1), marginBottom: U.space(2) }]}>
        Pastoral’da güven rozeti ve öne çıkan ilanlar için adımları tamamlayın. Aşağıdaki işlemler şu an API iskeletine bağlıdır; üretimde e-Devlet ve ödeme
        akışları eklenecektir.
      </Text>
      <View style={{ marginTop: -U.space(1), marginBottom: U.space(1.5), padding: U.space(1.25), borderRadius: U.radius, backgroundColor: U.surfaceContainerHigh }}>
        <Text style={[T.caption, { color: U.textSecondary }]}>
          Reddedilen adımlar için yeniden başvuru bekleme süresi uygulanır. Kalan süre kart üzerinde gösterilir.
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          backgroundColor: U.surfaceTint,
          borderRadius: U.radiusLg,
          padding: U.space(1.75),
          marginBottom: U.space(2),
          borderLeftWidth: 4,
          borderLeftColor: U.primary,
          ...shadowCard
        }}
      >
        <Ionicons name="information-circle" size={22} color={U.primary} style={{ marginRight: U.space(1) }} />
        <View style={{ flex: 1 }}>
          <Text style={[T.body, { fontWeight: "700" }]}>Neden doğrulama?</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>
            Doğrulanmış satıcılar arama ve mesajlarda daha görünür olur; alıcılar dolandırıcılık riskini azaltır.
          </Text>
        </View>
      </View>

      {STEPS.map((step) => {
        const busy = action.isPending && action.variables?.path === step.path;
        const st = getStatus(step.key);
        const sm = statusMeta(st);
        const reapplyAt = getReapplyAt(step.key);
        const cooldownText = getRemainingText(reapplyAt);
        const blockedByCooldown = Boolean(cooldownText);
        return (
          <Pressable
            key={step.path}
            accessibilityRole="button"
            accessibilityLabel={step.title}
            onPress={() => void action.mutate({ path: step.path })}
            disabled={action.isPending || st === "approved" || blockedByCooldown}
            style={{
              backgroundColor: U.surface,
              borderRadius: U.radiusLg,
              padding: U.space(2),
              marginBottom: U.space(1.5),
              borderWidth: 1,
              borderColor: U.surfaceContainer,
              ...shadowCard
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: U.space(10),
                  height: U.space(10),
                  borderRadius: U.radius,
                  backgroundColor: U.surfaceContainerHigh,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: U.space(1.5)
                }}
              >
                <Ionicons name={step.icon} size={26} color={U.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.overline, { color: U.tertiary }]}>{step.level}</Text>
                <Text style={[T.body, { fontWeight: "800", marginTop: 2 }]}>{busy ? "İşleniyor…" : step.title}</Text>
                <Text style={[T.caption, { marginTop: U.space(0.75) }]}>{step.subtitle}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: U.space(0.75) }}>
                  <Ionicons name={sm.icon} size={14} color={sm.color} />
                  <Text style={[T.caption, { marginLeft: 6, color: sm.color, fontWeight: "700" }]}>{sm.label}</Text>
                </View>
                {cooldownText ? (
                  <Text style={[T.caption, { marginTop: U.space(0.5), color: U.warnText, fontWeight: "700" }]}>{cooldownText}</Text>
                ) : null}
                {step.key !== "phone" && st !== "approved" ? (
                  <Pressable
                    onPress={() =>
                      setSelectedDocKey((prev) => (prev === step.key ? null : (step.key as "nationalId" | "taxNumber" | "agriculturalId")))
                    }
                    disabled={blockedByCooldown}
                    style={{ marginTop: U.space(0.75), alignSelf: "flex-start" }}
                  >
                    <Text style={[T.caption, { color: blockedByCooldown ? U.textMuted : U.tertiary, fontWeight: "700" }]}>Belge bağlantısı ekle</Text>
                  </Pressable>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={22} color={U.textMuted} />
            </View>
          </Pressable>
        );
      })}

      {selectedDocKey ? (
        <View style={{ marginTop: U.space(0.5), padding: U.space(1.5), borderRadius: U.radiusLg, backgroundColor: U.surface }}>
          <Text style={[T.body, { fontWeight: "700" }]}>Belge bağlantısı gönder</Text>
          <Text style={[T.caption, { marginTop: U.space(0.5) }]}>PDF/görsel dosyası seçin veya URL girin (https://...)</Text>
          <Pressable
            onPress={async () => {
              const r = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: false
              });
              if (r.canceled) return;
              const f = r.assets?.[0];
              if (!f?.uri) return;
              const mt = (f.mimeType || "").toLowerCase().trim();
              if (mt && !ALLOWED_DOC_MIME.has(mt)) {
                Toast.show({ type: "info", text1: "Desteklenmeyen dosya türü", text2: "PDF, PNG, JPG veya WEBP seçin" });
                return;
              }
              if (typeof f.size === "number" && f.size > MAX_DOC_BYTES) {
                Toast.show({ type: "info", text1: "Dosya çok büyük", text2: "Maksimum boyut 5MB" });
                return;
              }
              setPickedDoc({ uri: f.uri, name: f.name || "document", mimeType: f.mimeType ?? undefined });
            }}
            style={{
              marginTop: U.space(1),
              borderRadius: U.radius,
              backgroundColor: U.surfaceContainerHigh,
              borderWidth: 1,
              borderColor: U.surfaceContainer,
              alignItems: "center",
              paddingVertical: U.space(1.1)
            }}
          >
            <Text style={[T.caption, { color: U.text, fontWeight: "700" }]}>{pickedDoc ? `Seçildi: ${pickedDoc.name}` : "Dosya Seç"}</Text>
          </Pressable>
          <TextInput
            value={documentUrl}
            onChangeText={setDocumentUrl}
            autoCapitalize="none"
            placeholder="https://..."
            placeholderTextColor={U.textMuted}
            style={{
              marginTop: U.space(1),
              borderRadius: U.radius,
              backgroundColor: U.surfaceContainerHigh,
              color: U.text,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(1.25)
            }}
          />
          <Pressable
            onPress={() => {
              const kindPath =
                selectedDocKey === "nationalId"
                  ? "national-id"
                  : selectedDocKey === "taxNumber"
                    ? "tax-number"
                    : "agricultural-id";
              if (pickedDoc?.uri) {
                void uploadDocInline.mutate({
                  kindPath,
                  uri: pickedDoc.uri,
                  fileName: pickedDoc.name,
                  mimeType: pickedDoc.mimeType
                });
                return;
              }
              const trimmed = documentUrl.trim();
              if (!/^https?:\/\//i.test(trimmed)) {
                Toast.show({ type: "info", text1: "Dosya seçin veya geçerli URL girin" });
                return;
              }
              void uploadDoc.mutate({ kindPath, url: trimmed });
            }}
            disabled={uploadDoc.isPending || uploadDocInline.isPending}
            style={{
              marginTop: U.space(1),
              borderRadius: U.radius,
              backgroundColor: U.primary,
              alignItems: "center",
              paddingVertical: U.space(1.2),
              opacity: uploadDoc.isPending || uploadDocInline.isPending ? 0.7 : 1
            }}
          >
            <Text style={[T.body, { color: U.onPrimary, fontWeight: "800" }]}>
              {uploadDocInline.isPending || uploadDoc.isPending ? "Gönderiliyor..." : "Belgeyi Gönder"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ marginTop: U.space(1), padding: U.space(1.5), borderRadius: U.radius, backgroundColor: U.surfaceLow }}>
        <Text style={[T.caption, { color: U.textSecondary }]}>
          e-Devlet ile otomatik kimlik doğrulama ve manuel belge inceleme seçenekleri bir sonraki sürümde bu ekrandan yönetilebilecek.
        </Text>
      </View>
    </ScrollView>
  );
}
