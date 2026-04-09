import { prisma } from "./db";

/** users.phone_number (E.164) → users.id; tablo yok / satır yoksa null. */
export async function resolveAuthorUuidByPhone(phone: string): Promise<string | null> {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM users WHERE phone_number = ${phone} LIMIT 1
    `;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}
