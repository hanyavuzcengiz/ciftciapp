export type GatewayMemoryUsage = {
  rss: number;
  heapUsed: number;
};

export function buildGatewayPrometheusMetrics(uptimeSeconds: number, mem: GatewayMemoryUsage): string {
  return [
    "# HELP agromarket_api_gateway_uptime_seconds Seconds since the api-gateway Node process started.",
    "# TYPE agromarket_api_gateway_uptime_seconds gauge",
    `agromarket_api_gateway_uptime_seconds ${uptimeSeconds.toFixed(3)}`,
    "",
    "# HELP agromarket_api_gateway_process_resident_memory_bytes Resident set size in bytes.",
    "# TYPE agromarket_api_gateway_process_resident_memory_bytes gauge",
    `agromarket_api_gateway_process_resident_memory_bytes ${Math.round(mem.rss)}`,
    "",
    "# HELP agromarket_api_gateway_process_heap_used_bytes V8 heap used in bytes.",
    "# TYPE agromarket_api_gateway_process_heap_used_bytes gauge",
    `agromarket_api_gateway_process_heap_used_bytes ${Math.round(mem.heapUsed)}`,
    ""
  ].join("\n");
}
