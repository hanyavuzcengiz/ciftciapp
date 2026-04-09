import { ensureRequestIdHeader, newRequestId } from "@agromarket/shared-utils";
import Constants from "expo-constants";
import { useAuthStore } from "../store/auth";

export { newRequestId };

const BASE =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "http://127.0.0.1:3000";
const USER_SERVICE_BASE =
  (Constants.expoConfig?.extra as { userServiceUrl?: string } | undefined)?.userServiceUrl ?? "http://127.0.0.1:3001";

export class ApiError extends Error {
  readonly status: number;
  readonly kind: "offline" | "auth" | "server" | "client" | "unknown";

  constructor(message: string, status: number, kind: ApiError["kind"] = "unknown") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
  }
}

export function getApiBase(): string {
  return BASE;
}

export function getUserServiceBase(): string {
  return USER_SERVICE_BASE;
}

export type ApiOptions = {
  token?: string | null;
  userId?: string | null;
};

async function errorDetailFromResponse(res: Response): Promise<string> {
  let detail = res.statusText?.trim() || `HTTP ${res.status}`;
  const raw = await res.text();
  if (raw) {
    try {
      const body = JSON.parse(raw) as { message?: string; error?: string };
      if (typeof body.message === "string" && body.message.trim()) detail = body.message.trim();
      else if (typeof body.error === "string" && body.error.trim()) detail = body.error.trim();
      else if (!raw.trim().startsWith("<")) detail = raw.trim().slice(0, 240);
    } catch {
      const t = raw.trim();
      if (t && !t.startsWith("<")) detail = t.slice(0, 240);
    }
  }
  return detail;
}

export async function apiJson<T>(path: string, init: RequestInit = {}, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {})
  };
  ensureRequestIdHeader(headers);
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.userId) headers["x-user-id"] = opts.userId;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    throw new ApiError(msg || "Network request failed", 0, "offline");
  }
  if (res.status === 304) return undefined as T;
  if (!res.ok) {
    const kind: ApiError["kind"] = res.status === 401 ? "auth" : res.status >= 500 ? "server" : "client";
    throw new ApiError(await errorDetailFromResponse(res), res.status, kind);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Uses persisted access + refresh tokens; on 401 refreshes once then retries. */
export async function apiJsonWithAuth<T>(path: string, init: RequestInit = {}): Promise<T> {
  const run = () => {
    const { accessToken, userId } = useAuthStore.getState();
    return apiJson<T>(path, init, { token: accessToken, userId });
  };
  try {
    return await run();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (!refreshToken) throw e;
      let res: Response;
      try {
        res = await fetch(`${BASE}/api/v1/auth/refresh-token`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-request-id": newRequestId()
          },
          body: JSON.stringify({ refreshToken })
        });
      } catch {
        logout();
        throw e;
      }
      if (!res.ok) {
        logout();
        throw new ApiError(await errorDetailFromResponse(res), res.status, res.status >= 500 ? "server" : "auth");
      }
      const rawRefresh = await res.text();
      let j: { accessToken?: string; refreshToken?: string };
      try {
        j = JSON.parse(rawRefresh) as { accessToken?: string; refreshToken?: string };
      } catch {
        logout();
        throw new ApiError("Oturum yanıtı okunamadı", res.status, "server");
      }
      if (!j.accessToken || !j.refreshToken) {
        logout();
        throw new ApiError("Oturum yenileme eksik", res.status, "auth");
      }
      setTokens(j.accessToken, j.refreshToken);
      return await run();
    }
    throw e;
  }
}

export function getUiErrorMessage(error: unknown): { title: string; description: string; canRetry: boolean } {
  if (error instanceof ApiError) {
    if (error.kind === "offline") {
      return {
        title: "Offline Mod",
        description: "Internet baglantiniz yok gibi gorunuyor. Baglanti geldikten sonra tekrar deneyin.",
        canRetry: true
      };
    }
    if (error.kind === "server") {
      return {
        title: "Sunucuya Ulasilamadi",
        description: "Sunucu gecici olarak yanit vermiyor. Birazdan tekrar deneyin.",
        canRetry: true
      };
    }
    if (error.kind === "auth") {
      return {
        title: "Oturum Yenilenemedi",
        description: "Guvenlik nedeniyle tekrar giris yapmaniz gerekebilir.",
        canRetry: false
      };
    }
    return { title: "Islem Hatasi", description: error.message || "Beklenmeyen bir hata olustu.", canRetry: true };
  }
  return { title: "Bilinmeyen Hata", description: "Beklenmeyen bir hata olustu.", canRetry: true };
}
