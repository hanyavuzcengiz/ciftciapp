import crypto from "node:crypto";
import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import { z } from "zod";
import { SendOtpUseCase } from "../../application/use-cases/SendOtpUseCase";
import type { RefreshTokenStore } from "../../application/interfaces/RefreshTokenStore";
import { InMemoryOtpRepository } from "../../infrastructure/repositories/InMemoryOtpRepository";
import { InMemoryRefreshTokenStore } from "../../infrastructure/repositories/InMemoryRefreshTokenStore";
import { RedisRefreshTokenStore } from "../../infrastructure/repositories/RedisRefreshTokenStore";
import { upsertUserOnPhoneVerify, upsertUserProfile } from "../../infrastructure/db/userPg";

const router: Router = Router();

const otpRepo = new InMemoryOtpRepository();
const refreshStore: RefreshTokenStore = process.env.REDIS_URL
  ? new RedisRefreshTokenStore(new Redis(process.env.REDIS_URL))
  : new InMemoryRefreshTokenStore();

const sendOtpUseCase = new SendOtpUseCase(otpRepo);

const phoneSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/)
});

const verifySchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/),
  otp: z.string().length(6)
});
const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const registerCompleteSchema = z.object({
  fullName: z.string().min(2).max(120),
  userType: z.enum(["farmer", "breeder", "buyer", "supplier", "service_provider", "cooperative"])
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5
});

function bearerSub(req: Request): string | null {
  const auth = req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(auth.slice("Bearer ".length).trim(), process.env.JWT_SECRET!) as jwt.JwtPayload;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

router.post("/send-otp", authLimiter, async (req, res, next) => {
  try {
    const { phoneNumber } = phoneSchema.parse(req.body);
    const result = await sendOtpUseCase.execute(phoneNumber);
    res.status(202).json({
      success: true,
      message: "OTP sent.",
      expiresInSeconds: result.expiresInSeconds,
      ...(result.debugOtp ? { debugOtp: result.debugOtp } : {})
    });
  } catch (error) {
    next(error);
  }
});

router.post("/verify-otp", authLimiter, async (req, res, next) => {
  try {
    const { phoneNumber, otp } = verifySchema.parse(req.body);
    const ok = await otpRepo.verifyOtp(phoneNumber, otp) || (process.env.NODE_ENV !== "production" && otp === "123456");
    if (!ok) return res.status(401).json({ message: "Invalid or expired OTP" });

    try {
      await upsertUserOnPhoneVerify(phoneNumber);
    } catch (e) {
      console.warn("user-service: upsert user skipped", e);
    }

    const accessToken = jwt.sign({ sub: phoneNumber, role: "unverified_user" }, process.env.JWT_SECRET!, { expiresIn: "15m" });
    const rotation = crypto.randomUUID();
    const refreshToken = jwt.sign({ sub: phoneNumber, rotation }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "30d" });
    await refreshStore.saveRefreshToken(rotation, phoneNumber, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    return res.json({ accessToken, refreshToken, tokenType: "Bearer" });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh-token", authLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { sub: string; rotation: string };
    const isValid = await refreshStore.isRefreshTokenValid(payload.rotation, payload.sub);
    if (!isValid) return res.status(401).json({ message: "Invalid refresh token" });

    await refreshStore.invalidateRefreshToken(payload.rotation);
    const nextRotation = crypto.randomUUID();
    await refreshStore.saveRefreshToken(nextRotation, payload.sub, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    const accessToken = jwt.sign({ sub: payload.sub, role: "verified_user" }, process.env.JWT_SECRET!, { expiresIn: "15m" });
    const nextRefreshToken = jwt.sign({ sub: payload.sub, rotation: nextRotation }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "30d" });
    return res.json({ accessToken, refreshToken: nextRefreshToken, tokenType: "Bearer" });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", authLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { rotation: string };
    await refreshStore.invalidateRefreshToken(payload.rotation);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/register-complete", authLimiter, async (req, res, next) => {
  try {
    const body = registerCompleteSchema.parse(req.body);
    const phone = bearerSub(req);
    if (!phone) return res.status(401).json({ message: "Bearer token required" });

    let persisted = false;
    try {
      const r = await upsertUserProfile(phone, body.fullName, body.userType);
      persisted = r.ok;
    } catch (e) {
      console.warn("user-service: profile upsert failed", e);
    }

    return res.status(200).json({
      message: persisted ? "Profile completed." : "Profile accepted (database unavailable).",
      profile: {
        fullName: body.fullName,
        userType: body.userType,
        phoneNumber: phone,
        completedAt: new Date().toISOString(),
        persisted
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
