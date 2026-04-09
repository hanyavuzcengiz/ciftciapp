import pg from "pg";

let pool: pg.Pool | null = null;

export function getNotificationsPool(): pg.Pool | null {
  const url = process.env.NOTIFICATIONS_DATABASE_URL?.trim();
  if (!url) return null;
  pool ??= new pg.Pool({ connectionString: url, max: 8 });
  return pool;
}

export function isNotificationsDatabaseConfigured(): boolean {
  return Boolean(process.env.NOTIFICATIONS_DATABASE_URL?.trim());
}

export type NotificationApi = {
  id: string;
  userId: string;
  channel: "push" | "email" | "sms";
  category: "new_offer" | "new_message" | "listing_approval" | "review";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  listingId: string | null;
  conversationId: string | null;
};

type DbRow = {
  id: string;
  user_phone: string;
  channel: string;
  category: string;
  title: string;
  body: string;
  read_at: Date | null;
  created_at: Date;
  listing_id: string | null;
  conversation_id: string | null;
};

function mapRow(r: DbRow): NotificationApi {
  return {
    id: r.id,
    userId: r.user_phone,
    channel: r.channel as NotificationApi["channel"],
    category: r.category as NotificationApi["category"],
    title: r.title,
    body: r.body,
    readAt: r.read_at ? r.read_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    listingId: r.listing_id ?? null,
    conversationId: r.conversation_id ?? null
  };
}

export async function pgList(userPhone: string, limit: number): Promise<NotificationApi[]> {
  const p = getNotificationsPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<DbRow>(
      `SELECT id::text, user_phone, channel, category, title, body, read_at, created_at,
              listing_id, conversation_id
       FROM app_notifications WHERE user_phone = $1 ORDER BY created_at DESC LIMIT $2`,
      [userPhone, limit]
    );
    return r.rows.map(mapRow);
  } finally {
    c.release();
  }
}

export async function pgInsert(
  userPhone: string,
  channel: string,
  category: string,
  title: string,
  body: string,
  listingId?: string | null,
  conversationId?: string | null
): Promise<NotificationApi> {
  const p = getNotificationsPool();
  if (!p) throw new Error("no_database");
  const c = await p.connect();
  try {
    const r = await c.query<DbRow>(
      `INSERT INTO app_notifications (user_phone, channel, category, title, body, listing_id, conversation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text, user_phone, channel, category, title, body, read_at, created_at, listing_id, conversation_id`,
      [userPhone, channel, category, title, body, listingId ?? null, conversationId ?? null]
    );
    return mapRow(r.rows[0]!);
  } finally {
    c.release();
  }
}

export async function pgMarkRead(notificationId: string, userPhone: string): Promise<boolean> {
  const p = getNotificationsPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    const r = await c.query(
      `UPDATE app_notifications SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1::uuid AND user_phone = $2`,
      [notificationId, userPhone]
    );
    return (r.rowCount ?? 0) > 0;
  } finally {
    c.release();
  }
}

export async function pgUpsertPushToken(userPhone: string, expoPushToken: string): Promise<void> {
  const p = getNotificationsPool();
  if (!p) throw new Error("no_database");
  const c = await p.connect();
  try {
    await c.query(
      `INSERT INTO app_push_tokens (user_phone, expo_push_token)
       VALUES ($1, $2)
       ON CONFLICT (expo_push_token) DO UPDATE SET
         user_phone = EXCLUDED.user_phone,
         last_seen_at = NOW()`,
      [userPhone, expoPushToken]
    );
  } finally {
    c.release();
  }
}

export async function pgListPushTokensForUser(userPhone: string): Promise<string[]> {
  const p = getNotificationsPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<{ expo_push_token: string }>(
      `SELECT expo_push_token FROM app_push_tokens WHERE user_phone = $1`,
      [userPhone]
    );
    return r.rows.map((row) => row.expo_push_token);
  } finally {
    c.release();
  }
}

export async function pgCountPushTokensForUser(userPhone: string): Promise<number> {
  const p = getNotificationsPool();
  if (!p) return 0;
  const c = await p.connect();
  try {
    const r = await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM app_push_tokens WHERE user_phone = $1`,
      [userPhone]
    );
    return Number(r.rows[0]?.n ?? 0);
  } finally {
    c.release();
  }
}
