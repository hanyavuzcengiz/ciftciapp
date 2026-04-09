export function validatePaymentRuntime(
  nodeEnv: string | undefined,
  allowInMemory: boolean,
  providerMode: string,
  allowMockProviderInProd: boolean
): void {
  const isProd = nodeEnv === "production";
  if (isProd && allowInMemory) {
    throw new Error("[payment-service] Production mode requires persistent payment backend");
  }
  if (isProd && providerMode !== "live" && !allowMockProviderInProd) {
    throw new Error("[payment-service] Production mode requires PAYMENT_PROVIDER_MODE=live");
  }
}
