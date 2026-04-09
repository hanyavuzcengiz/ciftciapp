import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { U, shadowCard, shadowFab } from "../theme/tokens";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <Tabs
        screenListeners={{
          tabPress: () => {
            void Haptics.selectionAsync().catch(() => {});
          }
        }}
        screenOptions={{
          lazy: true,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: U.primary,
          tabBarInactiveTintColor: U.textMuted,
          headerShown: false,
          tabBarStyle: {
            paddingBottom: Math.max(insets.bottom, U.space(1)),
            paddingTop: U.space(1.25),
            minHeight: 58 + Math.max(insets.bottom, U.space(1)),
            backgroundColor: U.tabBar,
            borderTopWidth: 0,
            elevation: 16,
            shadowColor: shadowCard.shadowColor,
            shadowOpacity: 0.1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -4 }
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" }
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Ana Sayfa",
            tabBarAccessibilityLabel: "Ana sayfa",
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Ara",
            tabBarAccessibilityLabel: "İlan ara",
            tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="post"
          options={{
            title: "İlan ver",
            tabBarAccessibilityLabel: "Yeni ilan ver",
            tabBarIcon: () => (
              <View
                style={{
                  marginTop: -U.space(2.5),
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: U.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadowFab
                }}
              >
                <Ionicons name="add" size={30} color={U.onPrimary} />
              </View>
            ),
            tabBarLabel: ({ focused }) => (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  marginTop: U.space(0.25),
                  color: focused ? U.primary : U.textMuted
                }}
              >
                İlan ver
              </Text>
            )
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Mesajlar",
            tabBarAccessibilityLabel: "Mesajlar",
            tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            tabBarAccessibilityLabel: "Profil",
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
          }}
        />
      </Tabs>
    </>
  );
}
