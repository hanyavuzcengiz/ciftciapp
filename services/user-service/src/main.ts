import "dotenv/config";
import crypto from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import sanitizeHtml from "sanitize-html";
import path from "path";
import authRoutes from "./presentation/routes/auth.routes";
import usersRoutes from "./presentation/routes/users.routes";
import verificationRoutes from "./presentation/routes/verifications.routes";
import reviewsRoutes from "./presentation/routes/reviews.routes";
import { getVerificationDocumentStorageMode } from "./infrastructure/storage/verificationDocuments";

type HttpRequestWithId = Request & { serviceRequestId: string };

const app = express();
app.use(helmet());
app.use(cors({ origin: ["exp://localhost:8081"] }));
app.use(express.json({ limit: "2mb" }));

function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id")?.trim();
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  (req as HttpRequestWithId).serviceRequestId = id;
  res.setHeader("x-request-id", id);
  next();
}

/** JSON satir: USER_SERVICE_STRUCTURED_ACCESS_LOG=1 */
function structuredAccessLog(req: Request, res: Response, next: NextFunction): void {
  if (String(process.env.USER_SERVICE_STRUCTURED_ACCESS_LOG ?? "").trim() !== "1") {
    next();
    return;
  }
  const requestId = (req as HttpRequestWithId).serviceRequestId;
  const pathOnly = req.originalUrl.split("?")[0];
  const t0 = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        svc: "user-service",
        level: "info",
        event: "http_access",
        requestId,
        method: req.method,
        path: pathOnly,
        status: res.statusCode,
        durationMs: Date.now() - t0
      })
    );
  });
  next();
}
app.use(attachRequestId);
app.use(structuredAccessLog);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use((req, _res, next) => {
  if (typeof req.body === "object" && req.body !== null) {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === "string") {
        req.body[key] = sanitizeHtml(value);
      }
    }
  }
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "user-service" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/verifications", verificationRoutes);
app.use("/api/v1/reviews", reviewsRoutes);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(400).json({ message });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`verification-doc-storage=${getVerificationDocumentStorageMode()}`);
  console.log(`user-service listening on ${port}`);
});
