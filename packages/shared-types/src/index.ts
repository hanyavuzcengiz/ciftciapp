export type UserRole = "admin" | "moderator" | "verified_user" | "unverified_user";
export type KycLevel = 0 | 1 | 2;
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}
