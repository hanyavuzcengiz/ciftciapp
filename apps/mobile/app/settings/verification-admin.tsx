import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getApiBase, newRequestId } from "../lib/api";
import { T, U, shadowCard } from "../theme/tokens";

type PendingRow = {
  id: string;
  userId?: string;
  phoneNumber?: string;
  fullName?: string;
  verificationType?: "national_id" | "tax_number" | "agricultural_registry";
  documentUrl?: string | null;
  hasDocument?: boolean;
  createdAt?: string;
};
type HistoryRow = PendingRow & {
  decision?: "approved" | "rejected";
  verifiedBy?: string | null;
  verifiedAt?: string | null;
};
type AuditRow = {
  id: string;
  adminId?: string;
  action?: "decision_single" | "decision_bulk" | string;
  decision?: "approved" | "rejected" | null;
  atomic?: boolean | null;
  requestedCount?: number | null;
  processedCount?: number | null;
  failedCount?: number | null;
  createdAt?: string;
};

type PendingResponse = { data?: PendingRow[]; persisted?: boolean };
type PendingPageResponse = PendingResponse & { pagination?: { limit?: number; offset?: number; count?: number; hasMore?: boolean } };
type HistoryResponse = { data?: HistoryRow[]; persisted?: boolean };
type HistoryPageResponse = HistoryResponse & { pagination?: { limit?: number; offset?: number; count?: number; hasMore?: boolean } };
type AuditResponse = { data?: AuditRow[]; persisted?: boolean };
type AuditPageResponse = AuditResponse & { pagination?: { limit?: number; offset?: number; count?: number; hasMore?: boolean } };
const ADMIN_PREFS_KEY = "verification.admin.prefs.v1";
const PENDING_PAGE_SIZE = 40;
const HISTORY_PAGE_SIZE = 30;
const AUDIT_PAGE_SIZE = 30;

function typeLabel(t?: PendingRow["verificationType"]): string {
  if (t === "national_id") return "Kimlik";
  if (t === "tax_number") return "Vergi";
  if (t === "agricultural_registry") return "ÇKS";
  return "—";
}

function adminHeaders(adminToken: string, adminId: string): Record<string, string> {
  const token = adminToken.trim();
  const id = adminId.trim() || "admin-mobile";
  const rid = newRequestId();
  if (/^Bearer\s+/i.test(token)) {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: token,
      "x-request-id": rid
    };
  }
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-admin-token": token,
    "x-admin-id": id,
    "x-request-id": rid
  };
}

export default function VerificationAdminScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [adminToken, setAdminToken] = useState("");
  const [adminId, setAdminId] = useState("admin-mobile");
  const [enabled, setEnabled] = useState(false);
  const [tab, setTab] = useState<"pending" | "history" | "audit">("pending");
  const [onlyWithDocument, setOnlyWithDocument] = useState(false);
  const [bulkAtomic, setBulkAtomic] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "national_id" | "tax_number" | "agricultural_registry">("all");
  const [historyDecisionFilter, setHistoryDecisionFilter] = useState<"all" | "approved" | "rejected">("all");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"all" | "national_id" | "tax_number" | "agricultural_registry">("all");
  const [historyWithinHours, setHistoryWithinHours] = useState<0 | 24>(0);
  const [auditActionFilter, setAuditActionFilter] = useState<"all" | "decision_single" | "decision_bulk">("all");
  const [auditDecisionFilter, setAuditDecisionFilter] = useState<"all" | "approved" | "rejected">("all");
  const [auditWithinHours, setAuditWithinHours] = useState<0 | 24>(0);
  const [auditAdminId, setAuditAdminId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAdminToken, setShowAdminToken] = useState(false);
  const isJwtMode = /^Bearer\s+/i.test(adminToken.trim());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const raw = await AsyncStorage.getItem(ADMIN_PREFS_KEY);
      if (!mounted || !raw) return;
      try {
        const parsed = JSON.parse(raw) as {
          adminId?: string;
          adminToken?: string;
          onlyWithDocument?: boolean;
          bulkAtomic?: boolean;
          typeFilter?: string;
          tab?: string;
          historyDecisionFilter?: string;
          historyTypeFilter?: string;
          historyWithinHours?: number;
          auditActionFilter?: string;
          auditDecisionFilter?: string;
          auditWithinHours?: number;
          auditAdminId?: string;
        };
        if (parsed.adminId?.trim()) setAdminId(parsed.adminId.trim());
        if (parsed.adminToken?.trim()) setAdminToken(parsed.adminToken.trim());
        if (typeof parsed.onlyWithDocument === "boolean") setOnlyWithDocument(parsed.onlyWithDocument);
        if (typeof parsed.bulkAtomic === "boolean") setBulkAtomic(parsed.bulkAtomic);
        if (parsed.typeFilter === "all" || parsed.typeFilter === "national_id" || parsed.typeFilter === "tax_number" || parsed.typeFilter === "agricultural_registry") {
          setTypeFilter(parsed.typeFilter);
        }
        if (parsed.tab === "pending" || parsed.tab === "history" || parsed.tab === "audit") setTab(parsed.tab);
        if (parsed.historyDecisionFilter === "all" || parsed.historyDecisionFilter === "approved" || parsed.historyDecisionFilter === "rejected") {
          setHistoryDecisionFilter(parsed.historyDecisionFilter);
        }
        if (
          parsed.historyTypeFilter === "all" ||
          parsed.historyTypeFilter === "national_id" ||
          parsed.historyTypeFilter === "tax_number" ||
          parsed.historyTypeFilter === "agricultural_registry"
        ) {
          setHistoryTypeFilter(parsed.historyTypeFilter);
        }
        if (parsed.historyWithinHours === 24) setHistoryWithinHours(24);
        if (parsed.auditActionFilter === "all" || parsed.auditActionFilter === "decision_single" || parsed.auditActionFilter === "decision_bulk") {
          setAuditActionFilter(parsed.auditActionFilter);
        }
        if (parsed.auditDecisionFilter === "all" || parsed.auditDecisionFilter === "approved" || parsed.auditDecisionFilter === "rejected") {
          setAuditDecisionFilter(parsed.auditDecisionFilter);
        }
        if (parsed.auditWithinHours === 24) setAuditWithinHours(24);
        if (typeof parsed.auditAdminId === "string") setAuditAdminId(parsed.auditAdminId);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(
      ADMIN_PREFS_KEY,
      JSON.stringify({
        adminId: adminId.trim(),
        adminToken: adminToken.trim(),
        onlyWithDocument,
        bulkAtomic,
        typeFilter,
        tab,
        historyDecisionFilter,
        historyTypeFilter,
        historyWithinHours,
        auditActionFilter,
        auditDecisionFilter,
        auditWithinHours,
        auditAdminId
      })
    );
  }, [adminId, adminToken, onlyWithDocument, bulkAtomic, typeFilter, tab, historyDecisionFilter, historyTypeFilter, historyWithinHours, auditActionFilter, auditDecisionFilter, auditWithinHours, auditAdminId]);

  const pendingQ = useInfiniteQuery({
    queryKey: ["verification-admin", "pending", adminToken.trim(), adminId.trim()],
    enabled: enabled && adminToken.trim().length >= 4 && tab === "pending",
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<PendingPageResponse> => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      const r = await fetch(`${getApiBase()}/api/v1/verifications/admin/pending?limit=${PENDING_PAGE_SIZE}&offset=${offset}`, {
        headers: adminHeaders(adminToken, adminId)
      });
      const j = (await r.json()) as PendingResponse & { message?: string };
      if (!r.ok) throw new Error(j.message || "Admin erişimi başarısız");
      return j as PendingPageResponse;
    },
    getNextPageParam: (lastPage) => {
      const hasMore = Boolean(lastPage.pagination?.hasMore);
      if (!hasMore) return undefined;
      const offset = Number(lastPage.pagination?.offset || 0);
      const count = Number(lastPage.pagination?.count || 0);
      return offset + count;
    }
  });

  const historyQ = useInfiniteQuery({
    queryKey: [
      "verification-admin",
      "history",
      adminToken.trim(),
      adminId.trim(),
      historyDecisionFilter,
      historyTypeFilter,
      historyWithinHours
    ],
    enabled: enabled && adminToken.trim().length >= 4 && tab === "history",
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<HistoryPageResponse> => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      const params = new URLSearchParams();
      params.set("limit", String(HISTORY_PAGE_SIZE));
      params.set("offset", String(offset));
      if (historyDecisionFilter !== "all") params.set("decision", historyDecisionFilter);
      if (historyTypeFilter !== "all") params.set("verificationType", historyTypeFilter);
      if (historyWithinHours > 0) params.set("withinHours", String(historyWithinHours));
      const r = await fetch(`${getApiBase()}/api/v1/verifications/admin/history?${params.toString()}`, {
        headers: adminHeaders(adminToken, adminId)
      });
      const j = (await r.json()) as HistoryPageResponse & { message?: string };
      if (!r.ok) throw new Error(j.message || "Geçmiş alınamadı");
      return j;
    },
    getNextPageParam: (lastPage) => {
      const hasMore = Boolean(lastPage.pagination?.hasMore);
      if (!hasMore) return undefined;
      const offset = Number(lastPage.pagination?.offset || 0);
      const count = Number(lastPage.pagination?.count || 0);
      return offset + count;
    }
  });
  const auditQ = useInfiniteQuery({
    queryKey: ["verification-admin", "audit", adminToken.trim(), adminId.trim(), auditActionFilter, auditDecisionFilter, auditWithinHours, auditAdminId.trim()],
    enabled: enabled && adminToken.trim().length >= 4 && tab === "audit",
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<AuditPageResponse> => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      const params = new URLSearchParams();
      params.set("limit", String(AUDIT_PAGE_SIZE));
      params.set("offset", String(offset));
      if (auditActionFilter !== "all") params.set("action", auditActionFilter);
      if (auditDecisionFilter !== "all") params.set("decision", auditDecisionFilter);
      if (auditWithinHours > 0) params.set("withinHours", String(auditWithinHours));
      if (auditAdminId.trim()) params.set("adminId", auditAdminId.trim());
      const r = await fetch(`${getApiBase()}/api/v1/verifications/admin/audit-logs?${params.toString()}`, {
        headers: adminHeaders(adminToken, adminId)
      });
      const j = (await r.json()) as AuditPageResponse & { message?: string };
      if (!r.ok) throw new Error(j.message || "Loglar alınamadı");
      return j;
    },
    getNextPageParam: (lastPage) => {
      const hasMore = Boolean(lastPage.pagination?.hasMore);
      if (!hasMore) return undefined;
      const offset = Number(lastPage.pagination?.offset || 0);
      const count = Number(lastPage.pagination?.count || 0);
      return offset + count;
    }
  });

  const decideMut = useMutation({
    mutationFn: async (vars: { id: string; decision: "approved" | "rejected" }) => {
      const r = await fetch(`${getApiBase()}/api/v1/verifications/admin/${encodeURIComponent(vars.id)}/decision`, {
        method: "POST",
        headers: adminHeaders(adminToken, adminId),
        body: JSON.stringify({ decision: vars.decision })
      });
      const j = (await r.json()) as { message?: string };
      if (!r.ok) throw new Error(j.message || "Karar kaydedilemedi");
    },
    onSuccess: (_res, vars) => {
      Toast.show({ type: "success", text1: vars.decision === "approved" ? "Onaylandı" : "Reddedildi" });
      void pendingQ.refetch();
      void historyQ.refetch();
      void auditQ.refetch();
    },
    onError: (e) => Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Hata" })
  });

  const bulkMut = useMutation({
    mutationFn: async (vars: { ids: string[]; decision: "approved" | "rejected"; atomic: boolean }) => {
      const r = await fetch(`${getApiBase()}/api/v1/verifications/admin/decisions-bulk`, {
        method: "POST",
        headers: adminHeaders(adminToken, adminId),
        body: JSON.stringify({ ids: vars.ids, decision: vars.decision, atomic: vars.atomic })
      });
      const j = (await r.json()) as { message?: string; failed?: number; processed?: number; reasonCounts?: Record<string, number> };
      if (!r.ok) throw new Error(j.message || "Toplu karar kaydedilemedi");
      if ((j.failed || 0) > 0) {
        const rc = j.reasonCounts || {};
        const reasonText = Object.keys(rc).length
          ? ` [${Object.entries(rc)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")}]`
          : "";
        throw new Error(`Toplu işlem kısmen tamamlandı (${j.processed || 0} başarılı, ${j.failed || 0} başarısız)${reasonText}`);
      }
    },
    onSuccess: (_res, vars) => {
      Toast.show({
        type: "success",
        text1: vars.decision === "approved" ? "Toplu onay tamamlandı" : "Toplu red tamamlandı",
        text2: vars.atomic ? `Atomic: ${vars.ids.length} kayıt işlendi` : `${vars.ids.length} kayıt işlendi`
      });
      setSelectedIds([]);
      void pendingQ.refetch();
      void historyQ.refetch();
      void auditQ.refetch();
    },
    onError: (e) => Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Toplu işlem hatası" })
  });

  const rows = useMemo(() => pendingQ.data?.pages.flatMap((p) => p.data ?? []) ?? [], [pendingQ.data]);
  const pendingHasMore = Boolean(pendingQ.hasNextPage);
  const filteredRows = useMemo(() => {
    let out = rows;
    if (onlyWithDocument) out = out.filter((r) => Boolean(r.hasDocument));
    if (typeFilter !== "all") out = out.filter((r) => r.verificationType === typeFilter);
    return out;
  }, [rows, onlyWithDocument, typeFilter]);
  const historyRows = useMemo(() => historyQ.data?.pages.flatMap((p) => p.data ?? []) ?? [], [historyQ.data]);
  const historyHasMore = Boolean(historyQ.hasNextPage);
  const auditRows = useMemo(() => auditQ.data?.pages.flatMap((p) => p.data ?? []) ?? [], [auditQ.data]);
  const auditHasMore = Boolean(auditQ.hasNextPage);
  const totalCount = rows.length;
  const docsCount = rows.filter((r) => Boolean(r.hasDocument)).length;
  const shownCount = filteredRows.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: U.bg }}
      contentContainerStyle={{ padding: U.space(2), paddingBottom: insets.bottom + U.space(3), flexGrow: 1 }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={T.title}>Doğrulama Yönetimi</Text>
      <Text style={[T.caption, { marginTop: U.space(1) }]}>
        Admin paneli: bekleyen doğrulama taleplerini yönetir, geçmiş kararları listeler.
      </Text>

      {!isJwtMode ? (
        <>
          <Text style={[T.caption, { marginTop: U.space(2) }]}>x-admin-id</Text>
          <TextInput
            value={adminId}
            onChangeText={setAdminId}
            autoCapitalize="none"
            placeholder="admin-mobile"
            placeholderTextColor={U.textMuted}
            style={{
              marginTop: U.space(0.75),
              borderRadius: U.radius,
              backgroundColor: U.surfaceContainerHigh,
              color: U.text,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(1.25)
            }}
          />
        </>
      ) : (
        <View style={{ marginTop: U.space(2), alignSelf: "flex-start", paddingHorizontal: U.space(1.25), paddingVertical: U.space(0.7), borderRadius: 999, backgroundColor: U.secondaryContainer }}>
          <Text style={[T.caption, { color: U.onSecondaryContainer, fontWeight: "700" }]}>JWT modu aktif (x-admin-id gerekmiyor)</Text>
        </View>
      )}

      <Text style={[T.caption, { marginTop: U.space(1.5) }]}>Admin token / Bearer JWT</Text>
      <TextInput
        value={adminToken}
        onChangeText={setAdminToken}
        autoCapitalize="none"
        secureTextEntry={!showAdminToken}
        placeholder="••••••••"
        placeholderTextColor={U.textMuted}
        style={{
          marginTop: U.space(0.75),
          borderRadius: U.radius,
          backgroundColor: U.surfaceContainerHigh,
          color: U.text,
          paddingHorizontal: U.space(1.5),
          paddingVertical: U.space(1.25)
        }}
      />
      <Pressable
        onPress={() => setShowAdminToken((v) => !v)}
        style={{
          marginTop: U.space(0.75),
          alignSelf: "flex-start",
          backgroundColor: U.surfaceContainerHigh,
          borderRadius: 999,
          paddingHorizontal: U.space(1.25),
          paddingVertical: U.space(0.75)
        }}
      >
        <Text style={[T.caption, { fontWeight: "700" }]}>{showAdminToken ? "Tokenı Gizle" : "Tokenı Göster"}</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          if (adminToken.trim().length < 4) {
            Toast.show({ type: "info", text1: "Admin token gerekli" });
            return;
          }
          setEnabled(true);
          if (tab === "pending") void pendingQ.refetch();
          else if (tab === "history") void historyQ.refetch();
          else void auditQ.refetch();
        }}
        style={{
          marginTop: U.space(1.5),
          backgroundColor: U.primary,
          borderRadius: U.radius,
          alignItems: "center",
          paddingVertical: U.space(1.35)
        }}
      >
        <Text style={[T.body, { color: U.onPrimary, fontWeight: "800" }]}>Veriyi Getir</Text>
      </Pressable>

      <View style={{ flexDirection: "row", marginTop: U.space(1), gap: U.space(0.75) }}>
        {(
          [
            { id: "pending", label: "Bekleyen" },
            { id: "history", label: "Geçmiş" },
            { id: "audit", label: "İşlem Logları" }
          ] as const
        ).map((x) => {
          const on = tab === x.id;
          return (
            <Pressable
              key={x.id}
              onPress={() => setTab(x.id)}
              style={{
                paddingHorizontal: U.space(1.5),
                paddingVertical: U.space(0.85),
                borderRadius: 999,
                backgroundColor: on ? U.primary : U.surfaceContainerHigh
              }}
            >
              <Text style={[T.caption, { color: on ? U.onPrimary : U.text, fontWeight: "700" }]}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === "audit" ? (
        <>
          <View style={{ flexDirection: "row", marginTop: U.space(1), gap: U.space(0.75) }}>
            {(
              [
                { id: "all", label: "Tüm Aksiyonlar" },
                { id: "decision_single", label: "Tekli" },
                { id: "decision_bulk", label: "Toplu" }
              ] as const
            ).map((opt) => {
              const on = auditActionFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setAuditActionFilter(opt.id)}
                  style={{
                    paddingHorizontal: U.space(1.25),
                    paddingVertical: U.space(0.75),
                    borderRadius: 999,
                    backgroundColor: on ? U.primary : U.surfaceContainerHigh
                  }}
                >
                  <Text style={[T.caption, { fontWeight: "700", color: on ? U.onPrimary : U.text }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", marginTop: U.space(0.75), gap: U.space(0.75) }}>
            {(
              [
                { id: "all", label: "Tüm Kararlar" },
                { id: "approved", label: "Onay" },
                { id: "rejected", label: "Red" }
              ] as const
            ).map((opt) => {
              const on = auditDecisionFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setAuditDecisionFilter(opt.id)}
                  style={{
                    paddingHorizontal: U.space(1.25),
                    paddingVertical: U.space(0.75),
                    borderRadius: 999,
                    backgroundColor: on ? U.primary : U.surfaceContainerHigh
                  }}
                >
                  <Text style={[T.caption, { fontWeight: "700", color: on ? U.onPrimary : U.text }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => setAuditWithinHours((v) => (v === 24 ? 0 : 24))}
            style={{
              marginTop: U.space(0.75),
              alignSelf: "flex-start",
              backgroundColor: auditWithinHours === 24 ? U.secondaryContainer : U.surfaceContainerHigh,
              borderRadius: 999,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(0.9)
            }}
          >
            <Text style={[T.caption, { fontWeight: "700", color: auditWithinHours === 24 ? U.onSecondaryContainer : U.text }]}>
              {auditWithinHours === 24 ? "Son 24 saat: Açık" : "Son 24 saat: Kapalı"}
            </Text>
          </Pressable>
          <TextInput
            value={auditAdminId}
            onChangeText={setAuditAdminId}
            autoCapitalize="none"
            placeholder="Admin ID filtre (opsiyonel)"
            placeholderTextColor={U.textMuted}
            style={{
              marginTop: U.space(0.75),
              borderRadius: U.radius,
              backgroundColor: U.surfaceContainerHigh,
              color: U.text,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(1.1)
            }}
          />
        </>
      ) : null}
      <View style={{ flexDirection: "row", marginTop: U.space(0.75), gap: U.space(0.75) }}>
        <Pressable
          onPress={() => {
            if (!enabled) return;
            void queryClient.invalidateQueries({ queryKey: ["verification-admin", "pending"] });
            void pendingQ.refetch();
          }}
          disabled={!enabled || pendingQ.isFetching}
          style={{
            paddingHorizontal: U.space(1.25),
            paddingVertical: U.space(0.75),
            borderRadius: 999,
            backgroundColor: tab === "pending" ? U.secondaryContainer : U.surfaceContainerHigh,
            opacity: !enabled || pendingQ.isFetching ? 0.7 : 1
          }}
        >
          <Text style={[T.caption, { fontWeight: "700", color: tab === "pending" ? U.onSecondaryContainer : U.text }]}>
            {pendingQ.isFetching && tab === "pending" ? "Bekleyen yenileniyor..." : "Bekleyeni Yenile"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!enabled) return;
            void queryClient.invalidateQueries({ queryKey: ["verification-admin", "history"] });
            void historyQ.refetch();
          }}
          disabled={!enabled || historyQ.isFetching}
          style={{
            paddingHorizontal: U.space(1.25),
            paddingVertical: U.space(0.75),
            borderRadius: 999,
            backgroundColor: tab === "history" ? U.secondaryContainer : U.surfaceContainerHigh,
            opacity: !enabled || historyQ.isFetching ? 0.7 : 1
          }}
        >
          <Text style={[T.caption, { fontWeight: "700", color: tab === "history" ? U.onSecondaryContainer : U.text }]}>
            {historyQ.isFetching && tab === "history" ? "Geçmiş yenileniyor..." : "Geçmişi Yenile"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!enabled) return;
            void queryClient.invalidateQueries({ queryKey: ["verification-admin", "audit"] });
            void auditQ.refetch();
          }}
          disabled={!enabled || auditQ.isFetching}
          style={{
            paddingHorizontal: U.space(1.25),
            paddingVertical: U.space(0.75),
            borderRadius: 999,
            backgroundColor: tab === "audit" ? U.secondaryContainer : U.surfaceContainerHigh,
            opacity: !enabled || auditQ.isFetching ? 0.7 : 1
          }}
        >
          <Text style={[T.caption, { fontWeight: "700", color: tab === "audit" ? U.onSecondaryContainer : U.text }]}>
            {auditQ.isFetching && tab === "audit" ? "Loglar yenileniyor..." : "Logları Yenile"}
          </Text>
        </Pressable>
      </View>
      <View style={{ marginTop: U.space(0.75), flexDirection: "row", gap: U.space(0.75), flexWrap: "wrap" }}>
        <View style={{ paddingHorizontal: U.space(1.1), paddingVertical: U.space(0.6), borderRadius: 999, backgroundColor: U.surfaceContainerHigh }}>
          <Text style={[T.overline, { color: U.textMuted }]}>
            Bekleyen son yenileme: {pendingQ.dataUpdatedAt ? new Date(pendingQ.dataUpdatedAt).toLocaleTimeString("tr-TR") : "—"}
          </Text>
        </View>
        <View style={{ paddingHorizontal: U.space(1.1), paddingVertical: U.space(0.6), borderRadius: 999, backgroundColor: U.surfaceContainerHigh }}>
          <Text style={[T.overline, { color: U.textMuted }]}>
            Geçmiş son yenileme: {historyQ.dataUpdatedAt ? new Date(historyQ.dataUpdatedAt).toLocaleTimeString("tr-TR") : "—"}
          </Text>
        </View>
      </View>

      {tab === "pending" ? (
        <>
          <View style={{ flexDirection: "row", marginTop: U.space(1), gap: U.space(0.75) }}>
            {(
              [
                { id: "all", label: "Tümü" },
                { id: "national_id", label: "Kimlik" },
                { id: "tax_number", label: "Vergi" },
                { id: "agricultural_registry", label: "ÇKS" }
              ] as const
            ).map((opt) => {
              const on = typeFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setTypeFilter(opt.id)}
                  style={{
                    paddingHorizontal: U.space(1.25),
                    paddingVertical: U.space(0.75),
                    borderRadius: 999,
                    backgroundColor: on ? U.primary : U.surfaceContainerHigh
                  }}
                >
                  <Text style={[T.caption, { fontWeight: "700", color: on ? U.onPrimary : U.text }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => setOnlyWithDocument((v) => !v)}
            style={{
              marginTop: U.space(1),
              alignSelf: "flex-start",
              backgroundColor: onlyWithDocument ? U.secondaryContainer : U.surfaceContainerHigh,
              borderRadius: 999,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(0.9)
            }}
          >
            <Text style={[T.caption, { fontWeight: "700", color: onlyWithDocument ? U.onSecondaryContainer : U.text }]}>
              {onlyWithDocument ? "Sadece belgeli: Açık" : "Sadece belgeli: Kapalı"}
            </Text>
          </Pressable>
        </>
      ) : null}
      {tab === "history" ? (
        <>
          <View style={{ flexDirection: "row", marginTop: U.space(1), gap: U.space(0.75) }}>
            {(
              [
                { id: "all", label: "Tüm Kararlar" },
                { id: "approved", label: "Onay" },
                { id: "rejected", label: "Red" }
              ] as const
            ).map((opt) => {
              const on = historyDecisionFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setHistoryDecisionFilter(opt.id)}
                  style={{
                    paddingHorizontal: U.space(1.25),
                    paddingVertical: U.space(0.75),
                    borderRadius: 999,
                    backgroundColor: on ? U.primary : U.surfaceContainerHigh
                  }}
                >
                  <Text style={[T.caption, { fontWeight: "700", color: on ? U.onPrimary : U.text }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", marginTop: U.space(0.75), gap: U.space(0.75) }}>
            {(
              [
                { id: "all", label: "Tüm Türler" },
                { id: "national_id", label: "Kimlik" },
                { id: "tax_number", label: "Vergi" },
                { id: "agricultural_registry", label: "ÇKS" }
              ] as const
            ).map((opt) => {
              const on = historyTypeFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setHistoryTypeFilter(opt.id)}
                  style={{
                    paddingHorizontal: U.space(1.25),
                    paddingVertical: U.space(0.75),
                    borderRadius: 999,
                    backgroundColor: on ? U.primary : U.surfaceContainerHigh
                  }}
                >
                  <Text style={[T.caption, { fontWeight: "700", color: on ? U.onPrimary : U.text }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => setHistoryWithinHours((v) => (v === 24 ? 0 : 24))}
            style={{
              marginTop: U.space(0.75),
              alignSelf: "flex-start",
              backgroundColor: historyWithinHours === 24 ? U.secondaryContainer : U.surfaceContainerHigh,
              borderRadius: 999,
              paddingHorizontal: U.space(1.5),
              paddingVertical: U.space(0.9)
            }}
          >
            <Text style={[T.caption, { fontWeight: "700", color: historyWithinHours === 24 ? U.onSecondaryContainer : U.text }]}>
              {historyWithinHours === 24 ? "Son 24 saat: Açık" : "Son 24 saat: Kapalı"}
            </Text>
          </Pressable>
        </>
      ) : null}

      {tab === "pending" && pendingQ.error ? (
        <Text style={[T.caption, { color: U.danger, marginTop: U.space(1.5) }]}>
          {pendingQ.error instanceof Error ? pendingQ.error.message : "Yüklenemedi"}
        </Text>
      ) : null}
      {tab === "history" && historyQ.error ? (
        <Text style={[T.caption, { color: U.danger, marginTop: U.space(1.5) }]}>
          {historyQ.error instanceof Error ? historyQ.error.message : "Yüklenemedi"}
        </Text>
      ) : null}
      {tab === "audit" && auditQ.error ? (
        <Text style={[T.caption, { color: U.danger, marginTop: U.space(1.5) }]}>
          {auditQ.error instanceof Error ? auditQ.error.message : "Yüklenemedi"}
        </Text>
      ) : null}

      {tab === "pending" ? (
        <>
          <View style={{ marginTop: U.space(1), flexDirection: "row", gap: U.space(0.75), flexWrap: "wrap" }}>
            <View style={{ paddingHorizontal: U.space(1.25), paddingVertical: U.space(0.75), borderRadius: 999, backgroundColor: U.surfaceContainerHigh }}>
              <Text style={[T.caption, { fontWeight: "700" }]}>Toplam: {totalCount}</Text>
            </View>
            <View style={{ paddingHorizontal: U.space(1.25), paddingVertical: U.space(0.75), borderRadius: 999, backgroundColor: U.surfaceContainerHigh }}>
              <Text style={[T.caption, { fontWeight: "700" }]}>Belgeli: {docsCount}</Text>
            </View>
            <View style={{ paddingHorizontal: U.space(1.25), paddingVertical: U.space(0.75), borderRadius: 999, backgroundColor: U.surfaceContainerHigh }}>
              <Text style={[T.caption, { fontWeight: "700" }]}>Gösterilen: {shownCount}</Text>
            </View>
            <View style={{ paddingHorizontal: U.space(1.25), paddingVertical: U.space(0.75), borderRadius: 999, backgroundColor: U.surfaceContainerHigh }}>
              <Text style={[T.caption, { fontWeight: "700" }]}>Seçili: {selectedIds.length}</Text>
            </View>
          </View>

          {shownCount > 0 ? (
            <View style={{ marginTop: U.space(1), flexDirection: "row", gap: U.space(0.75), flexWrap: "wrap" }}>
              <Pressable
                onPress={() => setBulkAtomic((v) => !v)}
                style={{
                  backgroundColor: bulkAtomic ? U.secondaryContainer : U.surfaceContainerHigh,
                  borderRadius: 999,
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(0.9)
                }}
              >
                <Text style={[T.caption, { fontWeight: "700", color: bulkAtomic ? U.onSecondaryContainer : U.text }]}>
                  {bulkAtomic ? "Atomic: Açık" : "Atomic: Kapalı"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedIds(filteredRows.map((r) => r.id))}
                style={{ backgroundColor: U.surfaceContainerHigh, borderRadius: 999, paddingHorizontal: U.space(1.5), paddingVertical: U.space(0.9) }}
              >
                <Text style={[T.caption, { fontWeight: "700" }]}>Tümünü Seç</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedIds([])}
                style={{ backgroundColor: U.surfaceContainerHigh, borderRadius: 999, paddingHorizontal: U.space(1.5), paddingVertical: U.space(0.9) }}
              >
                <Text style={[T.caption, { fontWeight: "700" }]}>Seçimi Temizle</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (selectedIds.length === 0) return;
                  void bulkMut.mutate({ ids: selectedIds, decision: "approved", atomic: bulkAtomic });
                }}
                disabled={selectedIds.length === 0 || bulkMut.isPending || decideMut.isPending}
                style={{
                  backgroundColor: U.secondaryContainer,
                  borderRadius: 999,
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(0.9),
                  opacity: selectedIds.length === 0 || bulkMut.isPending || decideMut.isPending ? 0.6 : 1
                }}
              >
                <Text style={[T.caption, { color: U.onSecondaryContainer, fontWeight: "800" }]}>Toplu Onay</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (selectedIds.length === 0) return;
                  void bulkMut.mutate({ ids: selectedIds, decision: "rejected", atomic: bulkAtomic });
                }}
                disabled={selectedIds.length === 0 || bulkMut.isPending || decideMut.isPending}
                style={{
                  backgroundColor: U.warnBg,
                  borderWidth: 1,
                  borderColor: U.warnBorder,
                  borderRadius: 999,
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(0.9),
                  opacity: selectedIds.length === 0 || bulkMut.isPending || decideMut.isPending ? 0.6 : 1
                }}
              >
                <Text style={[T.caption, { color: U.warnText, fontWeight: "800" }]}>Toplu Red</Text>
              </Pressable>
            </View>
          ) : null}
          {pendingHasMore ? (
            <Pressable
              onPress={() => void pendingQ.fetchNextPage()}
              disabled={pendingQ.isFetchingNextPage}
              style={{
                marginTop: U.space(1),
                backgroundColor: U.surfaceContainerHigh,
                borderRadius: U.radius,
                paddingVertical: U.space(1.1),
                alignItems: "center",
                opacity: pendingQ.isFetchingNextPage ? 0.7 : 1
              }}
            >
              <Text style={[T.caption, { fontWeight: "800" }]}>
                {pendingQ.isFetchingNextPage ? "Yükleniyor..." : "Daha fazla yükle"}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      <View style={{ marginTop: U.space(2) }}>
        {tab === "pending" ? (
          filteredRows.length === 0 ? (
            <Text style={[T.caption, { color: U.textSecondary }]}>{enabled ? "Bekleyen talep yok." : "Henüz sorgu çalıştırılmadı."}</Text>
          ) : (
            filteredRows.map((row) => (
              <View
                key={row.id}
                style={{
                  marginBottom: U.space(1.25),
                  borderRadius: U.radiusLg,
                  padding: U.space(1.5),
                  backgroundColor: U.surface,
                  borderWidth: 1,
                  borderColor: U.surfaceContainer,
                  ...shadowCard
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Pressable
                      onPress={() =>
                        setSelectedIds((prev) => (prev.includes(row.id) ? prev.filter((x) => x !== row.id) : [...prev, row.id]))
                      }
                      style={{ marginRight: U.space(0.75), padding: 2 }}
                    >
                      <Ionicons name={selectedIds.includes(row.id) ? "checkbox" : "square-outline"} size={18} color={selectedIds.includes(row.id) ? U.primary : U.textMuted} />
                    </Pressable>
                    <Text style={[T.body, { fontWeight: "800" }]}>{typeLabel(row.verificationType)}</Text>
                  </View>
                  <Text style={[T.overline, { color: U.tertiary }]}>{row.createdAt ? new Date(row.createdAt).toLocaleString("tr-TR") : ""}</Text>
                </View>
                <Text style={[T.caption, { marginTop: U.space(0.5) }]}>{row.fullName ?? "—"} · {row.phoneNumber ?? "—"}</Text>
                <Text style={[T.caption, { marginTop: U.space(0.5), color: row.hasDocument ? U.secondary : U.textMuted }]}>
                  {row.hasDocument ? "Belge: var" : "Belge: yok"}
                </Text>
                {row.documentUrl ? (
                  <Pressable
                    onPress={() => {
                      const raw = row.documentUrl!.trim();
                      const full = /^https?:\/\//i.test(raw) ? raw : `${getApiBase()}${raw.startsWith("/") ? raw : `/${raw}`}`;
                      void Linking.openURL(full).catch(() => Toast.show({ type: "error", text1: "Belge açılamadı" }));
                    }}
                  >
                    <Text style={[T.caption, { marginTop: U.space(0.5), color: U.tertiary, fontWeight: "700" }]} numberOfLines={1}>
                      Belgeyi Aç
                    </Text>
                  </Pressable>
                ) : null}
                <Text style={[T.caption, { marginTop: U.space(0.5), color: U.textMuted }]}>ID: {row.id}</Text>
                <View style={{ flexDirection: "row", gap: U.space(1), marginTop: U.space(1.25) }}>
                  <Pressable
                    onPress={() => void decideMut.mutate({ id: row.id, decision: "approved" })}
                    disabled={decideMut.isPending || bulkMut.isPending}
                    style={{
                      flex: 1,
                      backgroundColor: U.secondaryContainer,
                      borderRadius: U.radius,
                      paddingVertical: U.space(1),
                      alignItems: "center",
                      opacity: decideMut.isPending || bulkMut.isPending ? 0.7 : 1
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="checkmark-circle" size={16} color={U.onSecondaryContainer} />
                      <Text style={[T.caption, { marginLeft: 6, color: U.onSecondaryContainer, fontWeight: "800" }]}>Onayla</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => void decideMut.mutate({ id: row.id, decision: "rejected" })}
                    disabled={decideMut.isPending || bulkMut.isPending}
                    style={{
                      flex: 1,
                      backgroundColor: U.warnBg,
                      borderRadius: U.radius,
                      borderWidth: 1,
                      borderColor: U.warnBorder,
                      paddingVertical: U.space(1),
                      alignItems: "center",
                      opacity: decideMut.isPending || bulkMut.isPending ? 0.7 : 1
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="close-circle" size={16} color={U.warnText} />
                      <Text style={[T.caption, { marginLeft: 6, color: U.warnText, fontWeight: "800" }]}>Reddet</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ))
          )
        ) : tab === "history" ? (historyRows.length === 0 ? (
          <Text style={[T.caption, { color: U.textSecondary }]}>{enabled ? "Geçmiş kaydı yok." : "Henüz sorgu çalıştırılmadı."}</Text>
        ) : (
          <>
            {historyRows.map((row) => (
            <View
              key={row.id}
              style={{
                marginBottom: U.space(1.25),
                borderRadius: U.radiusLg,
                padding: U.space(1.5),
                backgroundColor: U.surface,
                borderWidth: 1,
                borderColor: U.surfaceContainer,
                ...shadowCard
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[T.body, { fontWeight: "800" }]}>{typeLabel(row.verificationType)}</Text>
                <Text style={[T.overline, { color: row.decision === "approved" ? U.secondary : U.warnText }]}>
                  {row.decision === "approved" ? "ONAY" : "RED"}
                </Text>
              </View>
              <Text style={[T.caption, { marginTop: U.space(0.5) }]}>{row.fullName ?? "—"} · {row.phoneNumber ?? "—"}</Text>
              <Text style={[T.caption, { marginTop: U.space(0.5), color: U.textMuted }]}>
                Karar zamanı: {row.verifiedAt ? new Date(row.verifiedAt).toLocaleString("tr-TR") : "—"}
              </Text>
              <Text style={[T.caption, { marginTop: U.space(0.5), color: U.textMuted }]}>Karar veren: {row.verifiedBy ?? "—"}</Text>
              <Text style={[T.caption, { marginTop: U.space(0.5), color: U.textMuted }]}>ID: {row.id}</Text>
              {row.documentUrl ? (
                <Pressable
                  onPress={() => {
                    const raw = row.documentUrl!.trim();
                    const full = /^https?:\/\//i.test(raw) ? raw : `${getApiBase()}${raw.startsWith("/") ? raw : `/${raw}`}`;
                    void Linking.openURL(full).catch(() => Toast.show({ type: "error", text1: "Belge açılamadı" }));
                  }}
                  style={{ marginTop: U.space(0.5), alignSelf: "flex-start" }}
                >
                  <Text style={[T.caption, { color: U.tertiary, fontWeight: "700" }]}>Belgeyi Aç</Text>
                </Pressable>
              ) : (
                <Text style={[T.caption, { marginTop: U.space(0.5), color: U.textMuted }]}>Belge: yok</Text>
              )}
            </View>
            ))}
            {historyHasMore ? (
              <Pressable
                onPress={() => void historyQ.fetchNextPage()}
                disabled={historyQ.isFetchingNextPage}
                style={{
                  backgroundColor: U.surfaceContainerHigh,
                  borderRadius: U.radius,
                  paddingVertical: U.space(1.1),
                  alignItems: "center",
                  opacity: historyQ.isFetchingNextPage ? 0.7 : 1
                }}
              >
                <Text style={[T.caption, { fontWeight: "800" }]}>
                  {historyQ.isFetchingNextPage ? "Yükleniyor..." : "Daha fazla yükle"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )) : auditRows.length === 0 ? (
          <Text style={[T.caption, { color: U.textSecondary }]}>{enabled ? "İşlem logu yok." : "Henüz sorgu çalıştırılmadı."}</Text>
        ) : (
          <>
            {auditRows.map((row) => (
              <View
                key={row.id}
                style={{
                  marginBottom: U.space(1.25),
                  borderRadius: U.radiusLg,
                  padding: U.space(1.5),
                  backgroundColor: U.surface,
                  borderWidth: 1,
                  borderColor: U.surfaceContainer,
                  ...shadowCard
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[T.body, { fontWeight: "800" }]}>{row.action === "decision_bulk" ? "Toplu Karar" : "Tekli Karar"}</Text>
                  <Text style={[T.overline, { color: U.tertiary }]}>{row.createdAt ? new Date(row.createdAt).toLocaleString("tr-TR") : ""}</Text>
                </View>
                <Text style={[T.caption, { marginTop: U.space(0.5) }]}>Admin: {row.adminId ?? "—"}</Text>
                <Text style={[T.caption, { marginTop: U.space(0.5), color: U.textMuted }]}>
                  Karar: {row.decision ?? "—"} · Atomic: {row.atomic ? "Evet" : "Hayır"}
                </Text>
                <Text style={[T.caption, { marginTop: U.space(0.5), color: U.textMuted }]}>
                  İstenen: {row.requestedCount ?? 0} · Başarılı: {row.processedCount ?? 0} · Başarısız: {row.failedCount ?? 0}
                </Text>
              </View>
            ))}
            {auditHasMore ? (
              <Pressable
                onPress={() => void auditQ.fetchNextPage()}
                disabled={auditQ.isFetchingNextPage}
                style={{
                  backgroundColor: U.surfaceContainerHigh,
                  borderRadius: U.radius,
                  paddingVertical: U.space(1.1),
                  alignItems: "center",
                  opacity: auditQ.isFetchingNextPage ? 0.7 : 1
                }}
              >
                <Text style={[T.caption, { fontWeight: "800" }]}>
                  {auditQ.isFetchingNextPage ? "Yükleniyor..." : "Daha fazla yükle"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
