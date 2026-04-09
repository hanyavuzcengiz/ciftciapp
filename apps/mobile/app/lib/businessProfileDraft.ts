import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "business.profile.v1";

export type BusinessProfileDraft = {
  userType?: string;
  providerKind?: "goods" | "services";
  businessName?: string;
  title?: string;
  category?: string;
  city?: string;
  district?: string;
  addressLine?: string;
  serviceArea?: string;
  contactPerson?: string;
  taxNumber?: string;
  website?: string;
  whatsapp?: string;
  workingHours?: string;
  taxOffice?: string;
  tradeRegistryNo?: string;
  deliveryTypes?: string;
};

function key(userId?: string | null): string {
  return `${KEY_PREFIX}.${userId?.trim() || "guest"}`;
}

export async function loadBusinessProfileDraft(userId?: string | null): Promise<BusinessProfileDraft | null> {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BusinessProfileDraft;
    return parsed ?? null;
  } catch {
    return null;
  }
}

export async function saveBusinessProfileDraft(
  userId: string | null | undefined,
  draft: BusinessProfileDraft
): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify(draft));
}
