export function validateSearchRuntime(
  nodeEnv: string | undefined,
  elasticsearchUrl: string | undefined,
  allowMemoryFallback: boolean
): void {
  const isProd = nodeEnv === "production";
  if (isProd && !elasticsearchUrl?.trim() && !allowMemoryFallback) {
    throw new Error("[search-service] Production mode requires ELASTICSEARCH_URL or SEARCH_ALLOW_MEMORY_FALLBACK=true");
  }
}
