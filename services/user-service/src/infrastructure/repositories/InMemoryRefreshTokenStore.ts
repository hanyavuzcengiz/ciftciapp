import { RefreshTokenStore } from "../../application/interfaces/RefreshTokenStore";

type RefreshRow = { phoneNumber: string; expiresAt: Date; blacklisted: boolean };
const refreshMap = new Map<string, RefreshRow>();

export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  async saveRefreshToken(tokenId: string, phoneNumber: string, expiresAt: Date): Promise<void> {
    refreshMap.set(tokenId, { phoneNumber, expiresAt, blacklisted: false });
  }

  async isRefreshTokenValid(tokenId: string, phoneNumber: string): Promise<boolean> {
    const row = refreshMap.get(tokenId);
    if (!row) return false;
    if (row.blacklisted) return false;
    if (row.phoneNumber !== phoneNumber) return false;
    return row.expiresAt.getTime() >= Date.now();
  }

  async invalidateRefreshToken(tokenId: string): Promise<void> {
    const row = refreshMap.get(tokenId);
    if (!row) return;
    row.blacklisted = true;
  }
}
