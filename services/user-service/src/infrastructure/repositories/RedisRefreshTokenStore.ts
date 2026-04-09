import Redis from "ioredis";
import { RefreshTokenStore } from "../../application/interfaces/RefreshTokenStore";

export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly redis: Redis) {}

  private key(tokenId: string): string {
    return `agromarket:refresh:${tokenId}`;
  }

  async saveRefreshToken(tokenId: string, phoneNumber: string, expiresAt: Date): Promise<void> {
    const ttlSec = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    await this.redis.set(this.key(tokenId), JSON.stringify({ phoneNumber, blacklisted: false }), "EX", ttlSec);
  }

  async isRefreshTokenValid(tokenId: string, phoneNumber: string): Promise<boolean> {
    const raw = await this.redis.get(this.key(tokenId));
    if (!raw) return false;
    const row = JSON.parse(raw) as { phoneNumber: string; blacklisted: boolean };
    if (row.blacklisted) return false;
    return row.phoneNumber === phoneNumber;
  }

  async invalidateRefreshToken(tokenId: string): Promise<void> {
    const k = this.key(tokenId);
    const raw = await this.redis.get(k);
    if (!raw) return;
    const row = JSON.parse(raw) as { phoneNumber: string; blacklisted: boolean };
    row.blacklisted = true;
    const ttl = await this.redis.ttl(k);
    if (ttl > 0) {
      await this.redis.set(k, JSON.stringify(row), "EX", ttl);
    } else {
      await this.redis.del(k);
    }
  }
}
