export type SecurityEnv = {
  jwtSecret: string;
  adminApiKey: string;
  requestSigningSecret: string;
};

function requiredEnv(name: string, value: string | undefined, forbidDevDefault?: string): string {
  const v = value?.trim();
  if (!v) throw new Error(`[api-gateway] Missing required env: ${name}`);
  if (forbidDevDefault && v === forbidDevDefault) {
    throw new Error(`[api-gateway] Insecure ${name} value is not allowed in production`);
  }
  return v;
}

export function resolveSecurityEnv(nodeEnv: string | undefined, env: NodeJS.ProcessEnv): SecurityEnv {
  const isProd = nodeEnv === "production";
  if (!isProd) {
    return {
      jwtSecret: env.JWT_SECRET?.trim() || "dev-secret",
      adminApiKey: env.ADMIN_API_KEY?.trim() || "dev-admin-key",
      requestSigningSecret: env.REQUEST_SIGNING_SECRET?.trim() || "dev-secret"
    };
  }

  return {
    jwtSecret: requiredEnv("JWT_SECRET", env.JWT_SECRET, "dev-secret"),
    adminApiKey: requiredEnv("ADMIN_API_KEY", env.ADMIN_API_KEY, "dev-admin-key"),
    requestSigningSecret: requiredEnv("REQUEST_SIGNING_SECRET", env.REQUEST_SIGNING_SECRET, "dev-secret")
  };
}
