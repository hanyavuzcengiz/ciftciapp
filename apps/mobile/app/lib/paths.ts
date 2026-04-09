import type { Href } from "expo-router";

/** Profil tamamlama (kayıt sonrası). */
export const hrefProfileSetup: Href = "/(auth)/profile-setup";

/** Ana sekme grubu. */
export const hrefTabs: Href = "/(tabs)";

/** İlk açılış tanıtımı. */
export const hrefOnboarding: Href = "/(auth)/onboarding";

/** Telefon ile giriş. */
export const hrefPhoneAuth: Href = "/(auth)/phone";

/** Uygulama girişinde splash. */
export const hrefSplash: Href = "/(auth)/splash";

/** Teklifler listesi (stack). */
export const hrefOffers: Href = "/offers";

/** Ayarlar kökü ve alt sayfalar. */
export const hrefSettings: Href = "/settings";
export const hrefSettingsProfileEdit: Href = "/settings/profile-edit";
export const hrefSettingsBusinessProfile: Href = "/settings/business-profile";
export const hrefSettingsVerification: Href = "/settings/verification";
export const hrefSettingsNotifications: Href = "/settings/notifications";
export const hrefSettingsPrivacy: Href = "/settings/privacy";
export const hrefSettingsHelp: Href = "/settings/help";
export const hrefSettingsFollowing = "/settings/following" as Href;
export const hrefSettingsVerificationAdmin = "/settings/verification-admin" as Href;

/** OTP ekranına E.164 telefon ile git. */
export function hrefAuthOtp(phone: string): Href {
  return { pathname: "/(auth)/otp", params: { phone: phone.trim() } };
}

/** Dinamik route segmentleri için güvenli path (özel karakter / boşluk). */
export function hrefListing(id: string) {
  return `/listing/${encodeURIComponent(id.trim())}`;
}

export function hrefConversation(id: string, listingId?: string): Href {
  const trimmed = id.trim();
  const lid = listingId?.trim();
  if (lid) {
    return { pathname: "/conversation/[id]", params: { id: trimmed, listingId: lid } };
  }
  return `/conversation/${encodeURIComponent(trimmed)}`;
}

export function hrefUser(userId: string) {
  return `/user/${encodeURIComponent(userId.trim())}`;
}

export function hrefOffer(listingId: string) {
  return `/offer/${encodeURIComponent(listingId.trim())}`;
}

/** `review/[userId]` ekranı `tryDecodeURIComponent` ile param okur; tek katman encode. */
export function hrefReview(userId: string, listingId?: string) {
  const u = encodeURIComponent(userId.trim());
  if (listingId?.trim()) {
    return {
      pathname: "/review/[userId]" as const,
      params: { userId: u, listingId: encodeURIComponent(listingId.trim()) }
    };
  }
  return {
    pathname: "/review/[userId]" as const,
    params: { userId: u }
  };
}
