import assert from "node:assert/strict";
import test from "node:test";
import { buildGatewayPrometheusMetrics } from "../src/metrics";

test("buildGatewayPrometheusMetrics emits required metric names and types", () => {
  const text = buildGatewayPrometheusMetrics(12.3456, { rss: 1234.9, heapUsed: 888.1 });
  assert.match(text, /# TYPE agromarket_api_gateway_uptime_seconds gauge/);
  assert.match(text, /# TYPE agromarket_api_gateway_process_resident_memory_bytes gauge/);
  assert.match(text, /# TYPE agromarket_api_gateway_process_heap_used_bytes gauge/);
});

test("buildGatewayPrometheusMetrics normalizes values", () => {
  const text = buildGatewayPrometheusMetrics(1.23456, { rss: 100.6, heapUsed: 77.2 });
  assert.match(text, /agromarket_api_gateway_uptime_seconds 1\.235/);
  assert.match(text, /agromarket_api_gateway_process_resident_memory_bytes 101/);
  assert.match(text, /agromarket_api_gateway_process_heap_used_bytes 77/);
});
