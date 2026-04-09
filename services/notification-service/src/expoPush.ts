export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: "default" | null;
  data?: Record<string, string | null | undefined>;
};

export type ExpoPushDeliveryResult = {
  ok: boolean;
  attempts: number;
  httpStatus: number | null;
  ticketErrorCount: number;
  retryScheduled: boolean;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

function retryDelayMs(attempt: number, baseMs: number): number {
  const exp = Math.max(0, attempt - 1);
  return baseMs * Math.pow(2, exp);
}

function isRetryableStatus(code: number): boolean {
  return code === 429 || code >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/ */
export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<ExpoPushDeliveryResult> {
  if (messages.length === 0) {
    return { ok: true, attempts: 0, httpStatus: null, ticketErrorCount: 0, retryScheduled: false };
  }

  const maxAttempts = parsePositiveInt(process.env.NOTIFICATION_PUSH_MAX_ATTEMPTS, 3);
  const baseDelayMs = parsePositiveInt(process.env.NOTIFICATION_PUSH_RETRY_BASE_MS, 400);

  let attempts = 0;
  let lastStatus: number | null = null;
  let ticketErrorCount = 0;
  let retryScheduled = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate"
        },
        body: JSON.stringify(messages)
      });
      lastStatus = res.status;

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        const retryable = isRetryableStatus(res.status) && attempt < maxAttempts;
        console.warn("notification-service: expo push HTTP", res.status, `attempt=${attempt}/${maxAttempts}`, t.slice(0, 400));
        if (retryable) {
          retryScheduled = true;
          await sleep(retryDelayMs(attempt, baseDelayMs));
          continue;
        }
        return { ok: false, attempts, httpStatus: lastStatus, ticketErrorCount, retryScheduled };
      }

      const j = (await res.json().catch(() => null)) as { data?: { status?: string; message?: string; details?: unknown }[] } | null;
      const errors = j?.data?.filter((x) => x && x.status === "error") ?? [];
      ticketErrorCount = errors.length;
      if (errors.length) {
        console.warn(
          "notification-service: expo push ticket errors",
          errors.length,
          errors.slice(0, 3).map((e) => `${e.message ?? "?"}: ${JSON.stringify(e.details ?? "").slice(0, 120)}`)
        );
      }
      return { ok: true, attempts, httpStatus: lastStatus, ticketErrorCount, retryScheduled };
    } catch (e) {
      const retryable = attempt < maxAttempts;
      console.warn("notification-service: expo push fetch failed", `attempt=${attempt}/${maxAttempts}`, e);
      if (retryable) {
        retryScheduled = true;
        await sleep(retryDelayMs(attempt, baseDelayMs));
        continue;
      }
      return { ok: false, attempts, httpStatus: lastStatus, ticketErrorCount, retryScheduled };
    }
  }

  return { ok: false, attempts, httpStatus: lastStatus, ticketErrorCount, retryScheduled };
}

export const __expoPushInternals = {
  retryDelayMs,
  isRetryableStatus
};
