import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { maskPhone } from "@agromarket/shared-utils";
import { Card } from "../components/ui/Card";
import { StateCard } from "../components/RequestStates";
import { apiJsonWithAuth } from "../lib/api";
import { hrefUser } from "../lib/paths";
import { useAuthStore } from "../store/auth";
import { T, U } from "../theme/tokens";

export default function FollowingScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((s) => s.accessToken);
  const sessionPhone = useAuthStore((s) => s.userId);
  if (!accessToken || !sessionPhone) {
    return (
      <View style={{ flex: 1, backgroundColor: U.bg, justifyContent: "center", padding: U.space(2) }}>
        <StateCard
          title="Giriş gerekli"
          description="Takip listenizi görmek için oturum açın."
          style={{ marginTop: 0 }}
        />
      </View>
    );
  }
  const followsQ = useQuery({
    queryKey: ["follows", "list"],
    enabled: true,
    queryFn: () => apiJsonWithAuth<{ data?: Array<{ targetUserId?: string }> }>("/api/v1/users/me/follows?limit=200")
  });
  const remoteIds = useMemo(
    () =>
      (followsQ.data?.data ?? [])
        .map((x) => x.targetUserId?.trim())
        .filter((x): x is string => Boolean(x)),
    [followsQ.data?.data]
  );
  const removeMut = useMutation({
    mutationFn: (target: string) =>
      apiJsonWithAuth(`/api/v1/users/me/follows/${encodeURIComponent(target)}`, { method: "DELETE" }),
    onSuccess: () => void followsQ.refetch()
  });
  const sorted = useMemo(() => [...remoteIds].sort(), [remoteIds]);

  return (
    <View style={{ flex: 1, backgroundColor: U.bg }}>
      <Text style={[T.caption, { paddingHorizontal: U.space(2), paddingTop: U.space(1), paddingBottom: U.space(0.5) }]}>
        Takipler hesabınızla senkronizedir.
      </Text>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item}
        contentContainerStyle={{
          padding: U.space(2),
          paddingBottom: insets.bottom + U.space(2),
          flexGrow: 1
        }}
        ListEmptyComponent={
          <StateCard
            title="Takip ettiğiniz satıcı yok"
            description="Satıcı profilinde «Takip et» ile ekleyebilirsiniz."
            style={{ marginTop: U.space(2) }}
          />
        }
        renderItem={({ item }) => {
          const label = item.startsWith("+") ? maskPhone(item) : item.length > 20 ? `${item.slice(0, 14)}…` : item;
          return (
            <Card style={{ marginBottom: U.space(1.25), padding: U.space(2), borderRadius: U.radiusFull }}>
              <Link href={hrefUser(item) as Href} asChild>
                <Pressable accessibilityRole="button" accessibilityLabel={`Profil: ${label}`}>
                  <Text style={[T.body, { fontWeight: "800" }]}>{label}</Text>
                  <Text style={[T.caption, { marginTop: U.space(0.5), color: U.tertiary }]}>Profile git →</Text>
                </Pressable>
              </Link>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Takipten çık"
                onPress={() => {
                  void removeMut.mutate(item);
                }}
                style={{
                  marginTop: U.space(1.25),
                  alignSelf: "flex-start",
                  paddingHorizontal: U.space(1.5),
                  paddingVertical: U.space(1),
                  borderRadius: 999,
                  backgroundColor: U.surfaceContainerHigh,
                  opacity: removeMut.isPending ? 0.7 : 1
                }}
              >
                <Text style={[T.caption, { fontWeight: "700", color: U.danger }]}>Takipten çık</Text>
              </Pressable>
            </Card>
          );
        }}
      />
    </View>
  );
}
