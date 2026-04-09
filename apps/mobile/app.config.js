/** @type {import('expo/config').ExpoConfig} */
/** Splash / adaptive icon arka plani: theme/tokens U.primary ile ayni tutun (#c83e16). */
module.exports = {
  name: "AgroMarket",
  slug: "agromarket",
  scheme: "agromarket",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#c83e16"
  },
  android: {
    package: "com.agromarket.app",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#c83e16"
    }
  },
  ios: {
    bundleIdentifier: "com.agromarket.app",
    supportsTablet: true
  },
  plugins: ["expo-router", "expo-asset", "expo-font"],
  experiments: {
    typedRoutes: true
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3000",
    userServiceUrl: process.env.EXPO_PUBLIC_USER_SERVICE_URL || "http://127.0.0.1:3001",
    enableAdvancedSearch: process.env.EXPO_PUBLIC_ENABLE_ADVANCED_SEARCH || "true",
    enableAiSuggest: process.env.EXPO_PUBLIC_ENABLE_AI_SUGGEST || "true",
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || ""
    }
  }
};
