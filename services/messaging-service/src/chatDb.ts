import pg from "pg";
import { decryptText, encryptText } from "./shared/utils/crypto";

let pool: pg.Pool | null = null;

export function getMessagingPool(): pg.Pool | null {
  const url = process.env.MESSAGING_DATABASE_URL?.trim();
  if (!url) return null;
  pool ??= new pg.Pool({ connectionString: url, max: 8 });
  return pool;
}

export function isMessagingDatabaseConfigured(): boolean {
  return Boolean(process.env.MESSAGING_DATABASE_URL?.trim());
}

export type ConversationRow = {
  id: string;
  participants: string[];
  listingId?: string;
  createdAt: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string;
};

export async function pgListConversations(userPhone: string): Promise<ConversationRow[]> {
  const p = getMessagingPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<{
      id: string;
      listing_id: string | null;
      created_at: Date;
      participants_csv: string | null;
      last_cipher: string | null;
      last_at: Date | null;
    }>(
      `SELECT c.id::text, c.listing_id, c.created_at,
              (SELECT string_agg(p2.user_phone, ',' ORDER BY p2.user_phone)
               FROM chat_participants p2 WHERE p2.conversation_id = c.id) AS participants_csv,
              lm.content_ciphertext AS last_cipher,
              lm.created_at AS last_at
       FROM chat_conversations c
       INNER JOIN chat_participants p ON p.conversation_id = c.id AND p.user_phone = $1
       LEFT JOIN LATERAL (
         SELECT content_ciphertext, created_at FROM chat_messages m
         WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
      [userPhone]
    );
    return r.rows.map((row) => {
      const participants = row.participants_csv ? row.participants_csv.split(",") : [];
      let lastMessagePreview: string | undefined;
      if (row.last_cipher) {
        try {
          const plain = decryptText(row.last_cipher);
          lastMessagePreview = plain.length > 120 ? `${plain.slice(0, 117)}...` : plain;
        } catch {
          lastMessagePreview = undefined;
        }
      }
      return {
        id: row.id,
        participants,
        listingId: row.listing_id ?? undefined,
        createdAt: row.created_at.toISOString(),
        lastMessageAt: row.last_at?.toISOString() ?? null,
        lastMessagePreview
      };
    });
  } finally {
    c.release();
  }
}

/**
 * Aynı ilan ve aynı katılımcı telefonları için zaten var olan sohbeti döndürür (en eskisi).
 */
export async function pgFindConversationByListingAndParticipants(
  listingId: string,
  participants: string[]
): Promise<ConversationRow | null> {
  const p = getMessagingPool();
  if (!p) return null;
  const uniq = Array.from(new Set(participants));
  if (uniq.length < 2) return null;
  const c = await p.connect();
  try {
    const n = uniq.length;
    const r = await c.query<{ id: string; listing_id: string | null; created_at: Date }>(
      `SELECT c.id::text, c.listing_id, c.created_at
       FROM chat_conversations c
       WHERE c.listing_id = $1
         AND (SELECT COUNT(*)::int FROM chat_participants p WHERE p.conversation_id = c.id) = $3
         AND (
           SELECT COUNT(*)::int FROM unnest($2::text[]) AS exp(phone)
           WHERE EXISTS (
             SELECT 1 FROM chat_participants p
             WHERE p.conversation_id = c.id AND p.user_phone = exp.phone
           )
         ) = $3
         AND NOT EXISTS (
           SELECT 1 FROM chat_participants p
           WHERE p.conversation_id = c.id AND NOT (p.user_phone = ANY($2::text[]))
         )
       ORDER BY c.created_at ASC
       LIMIT 1`,
      [listingId, uniq, n]
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      participants: uniq,
      listingId: row.listing_id ?? undefined,
      createdAt: row.created_at.toISOString()
    };
  } finally {
    c.release();
  }
}

/**
 * İlan bağlantısı olmayan, yalnızca iki kişilik DM: aynı çift için tek sohbet.
 */
export async function pgFindDirectConversationBetweenParticipants(participants: string[]): Promise<ConversationRow | null> {
  const p = getMessagingPool();
  if (!p) return null;
  const uniq = Array.from(new Set(participants));
  if (uniq.length !== 2) return null;
  const c = await p.connect();
  try {
    const n = 2;
    const r = await c.query<{ id: string; listing_id: string | null; created_at: Date }>(
      `SELECT c.id::text, c.listing_id, c.created_at
       FROM chat_conversations c
       WHERE c.listing_id IS NULL
         AND (SELECT COUNT(*)::int FROM chat_participants p WHERE p.conversation_id = c.id) = $2
         AND (
           SELECT COUNT(*)::int FROM unnest($1::text[]) AS exp(phone)
           WHERE EXISTS (
             SELECT 1 FROM chat_participants p
             WHERE p.conversation_id = c.id AND p.user_phone = exp.phone
           )
         ) = $2
         AND NOT EXISTS (
           SELECT 1 FROM chat_participants p
           WHERE p.conversation_id = c.id AND NOT (p.user_phone = ANY($1::text[]))
         )
       ORDER BY c.created_at ASC
       LIMIT 1`,
      [uniq, n]
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      participants: uniq,
      listingId: undefined,
      createdAt: row.created_at.toISOString()
    };
  } finally {
    c.release();
  }
}

export async function pgCreateConversation(
  participants: string[],
  listingId: string | undefined
): Promise<ConversationRow> {
  const p = getMessagingPool();
  if (!p) throw new Error("database_unavailable");
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    const ins = await c.query<{ id: string; created_at: Date }>(
      `INSERT INTO chat_conversations (listing_id) VALUES ($1) RETURNING id::text, created_at`,
      [listingId ?? null]
    );
    const row = ins.rows[0]!;
    for (const phone of new Set(participants)) {
      await c.query(
        `INSERT INTO chat_participants (conversation_id, user_phone) VALUES ($1::uuid, $2)`,
        [row.id, phone]
      );
    }
    await c.query("COMMIT");
    return {
      id: row.id,
      participants: Array.from(new Set(participants)),
      listingId,
      createdAt: row.created_at.toISOString()
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

async function pgIsParticipant(conversationId: string, userPhone: string): Promise<boolean> {
  const p = getMessagingPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    const r = await c.query<{ ok: boolean }>(
      `SELECT true AS ok FROM chat_participants WHERE conversation_id = $1::uuid AND user_phone = $2 LIMIT 1`,
      [conversationId, userPhone]
    );
    return Boolean(r.rows[0]?.ok);
  } finally {
    c.release();
  }
}

/**
 * Sayfalama: cursor yoksa en son `limit` mesaj (kronolojik ASC).
 * cursor = önceki yanıttaki nextCursor: daha eski mesajlar [start, öncekiPencereBaşı).
 */
export async function pgGetMessages(
  conversationId: string,
  userPhone: string,
  cursor: string | undefined,
  limit: number
): Promise<{ data: Array<{ id: string; conversationId: string; senderId: string; content: string; messageType: string; mediaUrl?: string; createdAt: string }>; nextCursor: string | null }> {
  const p = getMessagingPool();
  if (!p) return { data: [], nextCursor: null };
  if (!(await pgIsParticipant(conversationId, userPhone))) {
    const err = new Error("forbidden") as Error & { code?: string };
    err.code = "FORBIDDEN";
    throw err;
  }
  const c = await p.connect();
  try {
    const all = await c.query<{
      id: string;
      sender_phone: string;
      content_ciphertext: string;
      message_type: string;
      media_url: string | null;
      created_at: Date;
    }>(
      `SELECT id::text, sender_phone, content_ciphertext, message_type, media_url, created_at
       FROM chat_messages WHERE conversation_id = $1::uuid ORDER BY created_at ASC`,
      [conversationId]
    );
    const mapped = all.rows.map((m) => ({
      id: m.id,
      conversationId,
      senderId: m.sender_phone,
      content: decryptText(m.content_ciphertext),
      messageType: m.message_type,
      mediaUrl: m.media_url ?? undefined,
      createdAt: m.created_at.toISOString()
    }));
    const n = mapped.length;
    let endExclusive = n;
    let startInclusive: number;
    if (!cursor?.trim()) {
      startInclusive = Math.max(0, n - limit);
    } else {
      const parsed = Number(Buffer.from(cursor, "base64").toString("utf8"));
      endExclusive = Number.isFinite(parsed) ? Math.min(Math.max(0, Math.floor(parsed)), n) : n;
      startInclusive = Math.max(0, endExclusive - limit);
    }
    const page = mapped.slice(startInclusive, endExclusive);
    const nextCursor = startInclusive > 0 ? Buffer.from(String(startInclusive), "utf8").toString("base64") : null;
    return { data: page, nextCursor };
  } finally {
    c.release();
  }
}

export async function pgPostMessage(
  conversationId: string,
  userPhone: string,
  content: string,
  messageType: string,
  mediaUrl?: string
): Promise<{ id: string; conversationId: string; senderId: string; content: string; messageType: string; mediaUrl?: string; createdAt: string }> {
  const p = getMessagingPool();
  if (!p) throw new Error("database_unavailable");
  if (!(await pgIsParticipant(conversationId, userPhone))) {
    const err = new Error("forbidden") as Error & { code?: string };
    err.code = "FORBIDDEN";
    throw err;
  }
  const cipher = encryptText(content);
  const c = await p.connect();
  try {
    const r = await c.query<{ id: string; created_at: Date }>(
      `INSERT INTO chat_messages (conversation_id, sender_phone, content_ciphertext, message_type, media_url)
       VALUES ($1::uuid, $2, $3, $4, $5)
       RETURNING id::text, created_at`,
      [conversationId, userPhone, cipher, messageType, mediaUrl ?? null]
    );
    const row = r.rows[0]!;
    return {
      id: row.id,
      conversationId,
      senderId: userPhone,
      content,
      messageType,
      mediaUrl,
      createdAt: row.created_at.toISOString()
    };
  } finally {
    c.release();
  }
}

export async function pgDeleteMessage(conversationId: string, messageId: string, userPhone: string): Promise<boolean> {
  const p = getMessagingPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    const r = await c.query(`DELETE FROM chat_messages WHERE id = $1::uuid AND conversation_id = $2::uuid AND sender_phone = $3`, [
      messageId,
      conversationId,
      userPhone
    ]);
    return (r.rowCount ?? 0) > 0;
  } finally {
    c.release();
  }
}

export async function pgConversationExists(conversationId: string, userPhone: string): Promise<boolean> {
  return pgIsParticipant(conversationId, userPhone);
}

/** Gönderen dışındaki katılımcılara bildirim: ilan id + sohbet id. */
export async function pgConversationNotifyContext(
  conversationId: string,
  senderPhone: string
): Promise<{ listingId: string | null; recipientPhones: string[] } | null> {
  const p = getMessagingPool();
  if (!p) return null;
  const c = await p.connect();
  try {
    const r = await c.query<{ listing_id: string | null; phones: string[] | null }>(
      `SELECT c.listing_id,
              array_agg(p.user_phone) FILTER (WHERE p.user_phone <> $2) AS phones
       FROM chat_conversations c
       INNER JOIN chat_participants p ON p.conversation_id = c.id
       WHERE c.id = $1::uuid
       GROUP BY c.id, c.listing_id`,
      [conversationId, senderPhone]
    );
    const row = r.rows[0];
    if (!row) return null;
    const phones = row.phones ?? [];
    return { listingId: row.listing_id, recipientPhones: phones };
  } finally {
    c.release();
  }
}
