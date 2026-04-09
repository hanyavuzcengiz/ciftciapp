export interface RefreshTokenStore {
  saveRefreshToken(tokenId: string, phoneNumber: string, expiresAt: Date): Promise<void>;
  isRefreshTokenValid(tokenId: string, phoneNumber: string): Promise<boolean>;
  invalidateRefreshToken(tokenId: string): Promise<void>;
}
