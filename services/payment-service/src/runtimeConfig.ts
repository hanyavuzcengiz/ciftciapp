export function validatePaymentRuntime(nodeEnv: string | undefined, allowInMemory: boolean): void {
  const isProd = nodeEnv === "production";
  if (isProd && allowInMemory) {
    throw new Error("[payment-service] Production mode requires persistent payment backend");
  }
}
