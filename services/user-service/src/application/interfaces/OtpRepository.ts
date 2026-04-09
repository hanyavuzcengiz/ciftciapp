export interface OtpRepository {
  saveOtp(phoneNumber: string, code: string, expiresAt: Date): Promise<void>;
  verifyOtp(phoneNumber: string, code: string): Promise<boolean>;
}
