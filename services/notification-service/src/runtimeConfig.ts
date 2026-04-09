export function validateNotificationRuntime(nodeEnv: string | undefined, hasPostgres: boolean): void {
  const isProd = nodeEnv === "production";
  if (isProd && !hasPostgres) {
    throw new Error("[notification-service] Production mode requires Postgres configuration");
  }
}
