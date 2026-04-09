export function validateOfferRuntime(nodeEnv: string | undefined, hasPostgres: boolean): void {
  const isProd = nodeEnv === "production";
  if (isProd && !hasPostgres) {
    throw new Error("[offer-service] Production mode requires Postgres configuration");
  }
}
