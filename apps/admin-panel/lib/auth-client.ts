export type ClientAuth = {
  userId: string;
  accessToken: string;
};

const STORAGE_KEY = "agromarket-web-auth";

export function getClientAuth(): ClientAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientAuth;
    if (!parsed.userId?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setClientAuth(next: ClientAuth): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
