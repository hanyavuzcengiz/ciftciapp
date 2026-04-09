import { OtpRepository } from "../interfaces/OtpRepository";

export class SendOtpUseCase {
  constructor(private readonly otpRepository: OtpRepository) {}

  async execute(phoneNumber: string): Promise<{ expiresInSeconds: number; debugOtp?: string }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresInSeconds = 180;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await this.otpRepository.saveOtp(phoneNumber, code, expiresAt);
    return process.env.NODE_ENV === "production" ? { expiresInSeconds } : { expiresInSeconds, debugOtp: code };
  }
}
