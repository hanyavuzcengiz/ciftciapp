export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: "default" | null;
  data?: Record<string, string | null | undefined>;
};

/** Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/ */
export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
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
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn("notification-service: expo push HTTP", res.status, t.slice(0, 400));
      return;
    }
    const j = (await res.json().catch(() => null)) as { data?: { status?: string; message?: string; details?: unknown }[] } | null;
    const errors = j?.data?.filter((x) => x && x.status === "error") ?? [];
    if (errors.length) {
      console.warn(
        "notification-service: expo push ticket errors",
        errors.length,
        errors.slice(0, 3).map((e) => `${e.message ?? "?"}: ${JSON.stringify(e.details ?? "").slice(0, 120)}`)
      );
    }
  } catch (e) {
    console.warn("notification-service: expo push fetch failed", e);
  }
}
