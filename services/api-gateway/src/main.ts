import crypto from "node:crypto";
import type { ClientRequest } from "http";
import cors from "cors";
import type { CorsOptions } from "cors";
import express, { type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import jwt from "jsonwebtoken";
import { buildGatewayPrometheusMetrics } from "./metrics";
import { resolveSecurityEnv } from "./securityConfig";

/** gatewayRequestId: gateway girisinde atanir, tum proxylere x-request-id olarak iletilir */
type GatewayRequest = Request & { userSub?: string; gatewayRequestId?: string };
const securityEnv = resolveSecurityEnv(process.env.NODE_ENV, process.env);

function corsOrigin(): CorsOptions["origin"] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw === "*") return true;
  const list = raw?.split(",").map((s) => s.trim()).filter(Boolean);
  if (list?.length) return list;
  return ["exp://localhost:8081", "http://localhost:8081"];
}

const app = express();
app.use(helmet());
app.use(cors({ origin: corsOrigin() }));
app.use(express.json({ limit: "2mb" }));

function attachGatewayRequestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id")?.trim();
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  (req as GatewayRequest).gatewayRequestId = id;
  res.setHeader("x-request-id", id);
  next();
}
app.use(attachGatewayRequestId);

/** JSON satiri: log aggregation / Loki / CloudWatch icin. GATEWAY_STRUCTURED_ACCESS_LOG=1 */
function structuredAccessLog(req: Request, res: Response, next: NextFunction): void {
  if (String(process.env.GATEWAY_STRUCTURED_ACCESS_LOG ?? "").trim() !== "1") {
    next();
    return;
  }
  const requestId = (req as GatewayRequest).gatewayRequestId ?? crypto.randomUUID();
  const pathOnly = req.originalUrl.split("?")[0];
  const t0 = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        svc: "api-gateway",
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
app.use(structuredAccessLog);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 100
  })
);

/** Telefon çözümlemesi — toplu tarama riskini azaltmak için genel limitten sıkı. */
const peerPhoneLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});

function limitPeerPhoneLookup(req: Request, res: Response, next: NextFunction): void {
  const pathOnly = req.originalUrl.split("?")[0];
  if (pathOnly.includes("/peer-phone")) {
    peerPhoneLimiter(req, res, next);
    return;
  }
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.header("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const secret = securityEnv.jwtSecret;
  if (!secret) {
    res.status(500).json({ message: "Gateway misconfigured" });
    return;
  }
  const token = auth.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & { sub?: string };
    const sub = typeof payload.sub === "string" ? payload.sub : undefined;
    if (!sub) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }
    (req as GatewayRequest).userSub = sub;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

function requireListingWriteAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  requireAuth(req, res, next);
}

/** Satıcı profili ve ilan listesi: GET /users/:id, /users/:id/listings|reviews — JWT gerekmez. */
function requireAuthUnlessPublicUserProfile(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "OPTIONS") {
    next();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    requireAuth(req, res, next);
    return;
  }
  const path = req.path;
  const rest = path.replace(/^\/api\/v1\/users\/?/, "");
  const segments = rest.split("/").filter(Boolean);
  if (segments.length === 0) {
    requireAuth(req, res, next);
    return;
  }
  const [first, second] = segments;
  if (first === "me") {
    requireAuth(req, res, next);
    return;
  }
  if (
    segments.length === 1 ||
    (segments.length === 2 && (second === "listings" || second === "reviews"))
  ) {
    next();
    return;
  }
  requireAuth(req, res, next);
}

function forwardRequestId(proxyReq: ClientRequest, req: Request): void {
  const rid = (req as GatewayRequest).gatewayRequestId;
  if (rid) proxyReq.setHeader("x-request-id", rid);
}

function withAuthedUserHeader(options: Parameters<typeof createProxyMiddleware>[0]): ReturnType<typeof createProxyMiddleware> {
  const prev = options.on?.proxyReq;
  return createProxyMiddleware({
    ...options,
    on: {
      ...options.on,
      proxyReq(proxyReq, req, res, opts) {
        const sourceReq = req as Request;
        forwardRequestId(proxyReq, sourceReq);
        const uid = (sourceReq as GatewayRequest).userSub;
        if (uid) proxyReq.setHeader("x-user-id", uid);
        fixRequestBody(proxyReq, sourceReq);
        prev?.(proxyReq, req, res, opts);
      }
    }
  });
}

function proxyWithBody(options: Parameters<typeof createProxyMiddleware>[0]): ReturnType<typeof createProxyMiddleware> {
  const prev = options.on?.proxyReq;
  return createProxyMiddleware({
    ...options,
    on: {
      ...options.on,
      proxyReq(proxyReq, req, res, opts) {
        const sourceReq = req as Request;
        forwardRequestId(proxyReq, sourceReq);
        fixRequestBody(proxyReq, sourceReq);
        prev?.(proxyReq, req, res, opts);
      }
    }
  });
}

/** createProxyMiddleware sarmalaysi: x-request-id arka servise iletilir */
function proxyForwardOnly(options: Parameters<typeof createProxyMiddleware>[0]): ReturnType<typeof createProxyMiddleware> {
  const prev = options.on?.proxyReq;
  return createProxyMiddleware({
    ...options,
    on: {
      ...options.on,
      proxyReq(proxyReq, req, res, opts) {
        forwardRequestId(proxyReq, req as Request);
        prev?.(proxyReq, req, res, opts);
      }
    }
  });
}

function rewriteWithPrefix(prefix: string, path: string): string {
  const [p, q] = path.split("?");
  const base = `${prefix}${p === "/" ? "" : p}`;
  return q ? `${base}?${q}` : base;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = securityEnv.adminApiKey;
  if (req.header("x-admin-key") !== expected) {
    res.status(403).json({ message: "Admin key required" });
    return;
  }
  next();
}

function verifyHmac(req: Request, res: Response, next: NextFunction): void {
  const signature = req.header("x-signature");
  const timestamp = req.header("x-timestamp");
  if (!signature || !timestamp) {
    res.status(401).json({ message: "Missing signature headers" });
    return;
  }

  const payload = `${timestamp}.${JSON.stringify(req.body ?? {})}`;
  const secret = securityEnv.requestSigningSecret;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (expected !== signature) {
    res.status(401).json({ message: "Invalid signature" });
    return;
  }
  next();
}

app.use(
  "/api/v1/auth/health",
  proxyForwardOnly({
    target: "http://localhost:3001",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
const authLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5 });
app.use("/api/v1/auth", authLimiter);

app.get("/health", (_req, res) => res.json({ ok: true, gateway: true }));

/** Prometheus metrikleri — yalnizca GATEWAY_PROMETHEUS_METRICS=1; uretimde ag erisimini kisitlayin. */
if (String(process.env.GATEWAY_PROMETHEUS_METRICS ?? "").trim() === "1") {
  app.get("/metrics", (_req, res) => {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    res.type("text/plain; version=0.0.4; charset=utf-8");
    res.send(buildGatewayPrometheusMetrics(uptime, { rss: mem.rss, heapUsed: mem.heapUsed }));
  });
}

app.use("/api/v1/auth", proxyWithBody({ target: "http://localhost:3001", changeOrigin: true }));
app.use(
  "/api/v1/users/health",
  proxyForwardOnly({
    target: "http://localhost:3001",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use(
  "/api/v1/users",
  limitPeerPhoneLookup,
  requireAuthUnlessPublicUserProfile,
  withAuthedUserHeader({ target: "http://localhost:3001", changeOrigin: true })
);

app.use(
  "/api/v1/verifications/health",
  proxyForwardOnly({
    target: "http://localhost:3001",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use("/api/v1/verifications", requireAuth, withAuthedUserHeader({ target: "http://localhost:3001", changeOrigin: true }));
app.use(
  "/api/v1/listings/health",
  proxyForwardOnly({
    target: "http://localhost:3002",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use(
  "/api/v1/listings",
  requireListingWriteAuth,
  withAuthedUserHeader({
    target: "http://localhost:3002",
    changeOrigin: true,
    pathRewrite: (path) => rewriteWithPrefix("/api/v1/listings", path)
  })
);
app.use(
  "/api/v1/listing-categories/health",
  proxyForwardOnly({
    target: "http://localhost:3002",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use(
  "/api/v1/listing-categories",
  proxyForwardOnly({
    target: "http://localhost:3002",
    changeOrigin: true,
    pathRewrite: (path) => rewriteWithPrefix("/api/v1/listing-categories", path)
  })
);
/** Arka servis /health — JWT yok (smoke / load balancer). */
app.use(
  "/api/v1/offers/health",
  proxyForwardOnly({
    target: "http://localhost:3003",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use("/api/v1/offers", requireAuth, withAuthedUserHeader({ target: "http://localhost:3003", changeOrigin: true }));
app.use(
  "/api/v1/conversations/health",
  proxyForwardOnly({
    target: "http://localhost:3004",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use("/api/v1/conversations", requireAuth, withAuthedUserHeader({ target: "http://localhost:3004", changeOrigin: true }));
app.use(
  "/api/v1/search/health",
  proxyForwardOnly({
    target: "http://localhost:3006",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use(
  "/api/v1/search",
  proxyForwardOnly({
    target: "http://localhost:3006",
    changeOrigin: true,
    pathRewrite: (path) => rewriteWithPrefix("/api/v1/search", path)
  })
);
app.use(
  "/api/v1/admin/health",
  proxyForwardOnly({
    target: "http://localhost:3008",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use(
  "/api/v1/admin",
  requireAdmin,
  proxyForwardOnly({ target: "http://localhost:3008", changeOrigin: true })
);
app.use(
  "/api/v1/ai/health",
  proxyForwardOnly({
    target: "http://localhost:3009",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use("/api/v1/ai", requireAuth, withAuthedUserHeader({ target: "http://localhost:3009", changeOrigin: true }));
app.use(
  "/api/v1/reviews/health",
  proxyForwardOnly({
    target: "http://localhost:3001",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use("/api/v1/reviews", requireAuth, withAuthedUserHeader({ target: "http://localhost:3001", changeOrigin: true }));
/** Bildirim servisi /health — JWT yok; asil path arka planda /health (pathRewrite). */
app.use(
  "/api/v1/notifications/health",
  proxyForwardOnly({
    target: "http://localhost:3005",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use(
  "/api/v1/notifications",
  requireAuth,
  withAuthedUserHeader({
    target: "http://localhost:3005",
    changeOrigin: true,
    pathRewrite: (path) => {
      const [p, q] = path.split("?");
      const base = p === "/" || p === "" ? "/notifications" : `/notifications${p}`;
      return q ? `${base}?${q}` : base;
    }
  })
);
app.use(
  "/api/v1/payments/health",
  proxyForwardOnly({
    target: "http://localhost:3007",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use(
  "/api/v1/payments",
  requireAuth,
  withAuthedUserHeader({
    target: "http://localhost:3007",
    changeOrigin: true,
    pathRewrite: (path) => {
      const [p, q] = path.split("?");
      const base = `/payments${p === "/" ? "" : p}`;
      return q ? `${base}?${q}` : base;
    }
  })
);
/** payments-secure on eki — JWT/HMAC yok (LB); payment-service /health. */
app.use(
  "/api/v1/payments-secure/health",
  proxyForwardOnly({
    target: "http://localhost:3007",
    changeOrigin: true,
    pathRewrite: () => "/health"
  })
);
app.use(
  "/api/v1/payments-secure",
  requireAuth,
  verifyHmac,
  withAuthedUserHeader({
    target: "http://localhost:3007",
    changeOrigin: true,
    pathRewrite: (path) => {
      const [p, q] = path.split("?");
      const base = `/payments${p === "/" ? "" : p}`;
      return q ? `${base}?${q}` : base;
    }
  })
);

app.listen(3000, () => console.log("api-gateway listening on 3000"));
