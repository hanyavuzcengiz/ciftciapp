import { OtpRepository } from "../../application/interfaces/OtpRepository";

type OtpRow = { code: string; expiresAt: Date };
const otpMap = new Map<string, OtpRow>();

export class InMemoryOtpRepository implements OtpRepository {
  async saveOtp(phoneNumber: string, code: string, expiresAt: Date): Promise<void> {
    otpMap.set(phoneNumber, { code, expiresAt });
  }

  async verifyOtp(phoneNumber: string, code: string): Promise<boolean> {
    const row = otpMap.get(phoneNumber);
    if (!row) return false;
    if (row.expiresAt.getTime() < Date.now()) return false;
    return row.code === code;
  }
}
