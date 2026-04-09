import crypto from "node:crypto";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`smoke-prod-readiness.mjs — gateway ve bagimli servis smoke kontrolleri

Kullanim:
  node scripts/smoke-prod-readiness.mjs [secenekler]

Secenekler:
  --json          Ciktiyi JSON (totalWallMs, meta: schemaVersion, fetchTimeoutMs, node, durationMs)
  --verbose, -v   Metin modunda her kontrol suresi
  --fail-fast     Ilk hatada dur (SMOKE_FAIL_FAST=1 ile de)
  --list          Tanimli kontrolleri ag olmadan listele; --json ile yapilandirilmis cikti
  --help, -h      Bu metin

Ortam (oncelik):
  SMOKE_API_URL — Smoke ozel API tabani (en yuksek oncelik; CI/staging kolayligi)
  NEXT_PUBLIC_API_URL veya EXPO_PUBLIC_API_URL — Uygulama ile ayni taban
  (hicbiri yoksa varsayilan: http://127.0.0.1:3000)
  SMOKE_FAIL_FAST=1 — --fail-fast ile ayni
  SMOKE_FETCH_TIMEOUT_MS — Tek istek zaman asimi ms (varsayilan: 30000, min 1000, max 300000)
  SMOKE_CHECK_METRICS=1 — GET /metrics kontrolunu (Prometheus text) etkinlestirir

pnpm:
  pnpm smoke:prod | smoke:prod:json | smoke:validate-list | smoke:prod:verbose | smoke:prod:fail-fast | smoke:prod:list | smoke:prod:list:json | smoke:prod:help
  pnpm verify — smoke:validate-list + lint + typecheck + test + build (CI ile ayni tam kapı)
`);
  process.exit(0);
}

function resolveApiBase() {
  const smoke = process.env.SMOKE_API_URL?.trim();
  if (smoke) return { base: smoke.replace(/\/$/, ""), source: "SMOKE_API_URL" };
  const next = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (next) return { base: next.replace(/\/$/, ""), source: "NEXT_PUBLIC_API_URL" };
  const expo = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (expo) return { base: expo.replace(/\/$/, ""), source: "EXPO_PUBLIC_API_URL" };
  return { base: "http://127.0.0.1:3000", source: "default" };
}

const { base: api, source: apiSource } = resolveApiBase();
const wantsJson = process.argv.includes("--json");
const wantsVerbose = process.argv.includes("--verbose") || process.argv.includes("-v");
const failFast = process.argv.includes("--fail-fast") || String(process.env.SMOKE_FAIL_FAST ?? "").trim() === "1";
const smokeStarted = Date.now();

function parseFetchTimeoutMs() {
  const raw = String(process.env.SMOKE_FETCH_TIMEOUT_MS ?? "30000").trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000) return 30000;
  if (n > 300000) return 300000;
  return Math.floor(n);
}

const fetchTimeoutMs = parseFetchTimeoutMs();
const smokeCheckMetrics = String(process.env.SMOKE_CHECK_METRICS ?? "").trim() === "1";

/**
 * Node 17.3+ icin AbortSignal.timeout; eski surumlerde AbortController + clearTimeout (finally ile).
 * @returns {{ signal: AbortSignal, cancel: () => void }}
 */
function createFetchTimeout(ms) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(ms), cancel() {} };
  }
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  return {
    signal: ac.signal,
    cancel: () => clearTimeout(id)
  };
}

function smokeMeta() {
  return {
    schemaVersion: 1,
    definedChecks: checks.length,
    completedChecks: results.length,
    failFast,
    skippedChecks: Math.max(0, checks.length - results.length),
    fetchTimeoutMs,
    node: process.version,
    apiSource
  };
}

/** Istekle gonderilen id ile yanıttaki x-request-id eslesmeli (gateway + hedef servis zinciri). */
function requestIdEchoFailure(checkName, res, requestId) {
  const echoed = res.headers.get("x-request-id")?.trim();
  if (echoed === requestId) return null;
  return {
    ok: false,
    name: `${checkName} (x-request-id echo)`,
    status: res.status,
    statusText: echoed ? `expected ${requestId}, got ${echoed}` : "missing x-request-id on response",
    hint: "Gateway `attachGatewayRequestId` / proxy `forwardRequestId` ve hedef serviste `x-request-id` yanitini kontrol edin."
  };
}

/** Basarili yanitta x-request-id yankisi beklenir (proxy + hedef veya saf gateway yaniti). */
const REQUEST_ID_ECHO_CHECKS = new Set([
  "api-gateway",
  "listing-service (via gateway)",
  "listing-service health (via gateway)",
  "listing-service HEAD (via gateway)",
  "search-service (via gateway)",
  "search-service health (via gateway)",
  "search-service HEAD (via gateway)",
  "listing category spec",
  "listing category spec HEAD (via gateway)",
  "listing-categories path health (via gateway)",
  "user-service public profile (via gateway)",
  "notification-service health (via gateway)",
  "offer-service health (via gateway)",
  "messaging-service health (via gateway)",
  "payment-service health (via gateway)",
  "payments-secure path health (via gateway)",
  "user-service health (via gateway)",
  "auth path health (via gateway)",
  "verifications path health (via gateway)",
  "reviews path health (via gateway)",
  "ai-service health (via gateway)",
  "admin-service health (via gateway)",
  "gateway JWT required (GET /users/me)",
  "gateway JWT required (GET /conversations)",
  "gateway JWT required (GET /offers/sent)",
  "gateway JWT required (GET /notifications)",
  "gateway JWT required (GET /ai)",
  "gateway JWT required (GET /reviews)",
  "gateway JWT required (GET /verifications)",
  "gateway JWT required (GET /payments)",
  "gateway JWT required (GET /payments-secure)",
  "gateway admin key required (GET /admin)",
  "gateway JWT required (POST /listings)"
]);

const checks = [
  {
    name: "api-gateway",
    url: `${api}/health`,
    hint: "API gateway dev server ayakta olmayabilir. `pnpm dev:services` calistirin."
  },
  ...(smokeCheckMetrics
    ? [
        {
          name: "api-gateway metrics (optional)",
          url: `${api}/metrics`,
          hint: "Gateway /metrics endpoint'i kapali olabilir (GATEWAY_PROMETHEUS_METRICS=1) veya erisim kisitli olabilir.",
          accept: "text/plain",
          expectTextContains: [
            "# TYPE agromarket_api_gateway_uptime_seconds gauge",
            "agromarket_api_gateway_process_resident_memory_bytes"
          ]
        }
      ]
    : []),
  {
    name: "listing-service (via gateway)",
    url: `${api}/api/v1/listings?limit=1`,
    hint: "Gateway route eksik olabilir veya listing-service kapali olabilir."
  },
  {
    name: "listing-service health (via gateway)",
    url: `${api}/api/v1/listings/health`,
    hint: "listing-service kapali, veritabani baglantisi yok veya /api/v1/listings/health proxy yanlis."
  },
  {
    name: "listing-service HEAD (via gateway)",
    url: `${api}/api/v1/listings?limit=1`,
    method: "HEAD",
    hint: "Listing okuma (HEAD) veya gateway requireListingWriteAuth zinciri bozuk olabilir."
  },
  {
    name: "search-service (via gateway)",
    url: `${api}/api/v1/search/listings?limit=1`,
    hint: "Search-service veya gateway proxy ayarini kontrol edin."
  },
  {
    name: "search-service health (via gateway)",
    url: `${api}/api/v1/search/health`,
    hint: "search-service kapali veya /api/v1/search/health proxy yanlis."
  },
  {
    name: "search-service HEAD (via gateway)",
    url: `${api}/api/v1/search/listings?limit=1`,
    method: "HEAD",
    hint: "Search okuma (HEAD) veya gateway /api/v1/search proxy'si bozuk olabilir."
  },
  {
    name: "listing category spec",
    url: `${api}/api/v1/listing-categories/traktor/spec`,
    hint: "listing-service yeni endpoint deploy edilmemis olabilir."
  },
  {
    name: "listing category spec HEAD (via gateway)",
    url: `${api}/api/v1/listing-categories/traktor/spec`,
    method: "HEAD",
    hint: "Listing kategori spec (HEAD) veya listing-categories proxy'si bozuk olabilir."
  },
  {
    name: "listing-categories path health (via gateway)",
    url: `${api}/api/v1/listing-categories/health`,
    hint: "listing-service kapali veya /api/v1/listing-categories/health proxy yanlis."
  },
  {
    name: "user-service public profile (via gateway)",
    url: `${api}/api/v1/users/00000000-0000-0000-0000-000000000000`,
    hint: "user-service veya gateway /api/v1/users proxy'si kapali olabilir.",
    /** DB yok: 200 persisted:false; DB var ve kayit yok: 404 */
    okStatuses: [200, 404]
  },
  {
    name: "notification-service health (via gateway)",
    url: `${api}/api/v1/notifications/health`,
    hint: "notification-service kapali veya gateway /api/v1/notifications/health proxy yanlis."
  },
  {
    name: "offer-service health (via gateway)",
    url: `${api}/api/v1/offers/health`,
    hint: "offer-service kapali veya gateway /api/v1/offers/health proxy yanlis."
  },
  {
    name: "messaging-service health (via gateway)",
    url: `${api}/api/v1/conversations/health`,
    hint: "messaging-service kapali veya gateway /api/v1/conversations/health proxy yanlis."
  },
  {
    name: "payment-service health (via gateway)",
    url: `${api}/api/v1/payments/health`,
    hint: "payment-service kapali veya gateway /api/v1/payments/health proxy yanlis."
  },
  {
    name: "payments-secure path health (via gateway)",
    url: `${api}/api/v1/payments-secure/health`,
    hint: "payment-service kapali veya gateway /api/v1/payments-secure/health proxy yanlis."
  },
  {
    name: "user-service health (via gateway)",
    url: `${api}/api/v1/users/health`,
    hint: "user-service kapali veya gateway /api/v1/users/health proxy yanlis."
  },
  {
    name: "auth path health (via gateway)",
    url: `${api}/api/v1/auth/health`,
    hint: "user-service kapali veya gateway /api/v1/auth/health proxy yanlis (auth rate limit disinda)."
  },
  {
    name: "verifications path health (via gateway)",
    url: `${api}/api/v1/verifications/health`,
    hint: "user-service kapali veya gateway /api/v1/verifications/health proxy yanlis."
  },
  {
    name: "reviews path health (via gateway)",
    url: `${api}/api/v1/reviews/health`,
    hint: "user-service kapali veya gateway /api/v1/reviews/health proxy yanlis."
  },
  {
    name: "ai-service health (via gateway)",
    url: `${api}/api/v1/ai/health`,
    hint: "ai-service kapali veya gateway /api/v1/ai/health proxy yanlis."
  },
  {
    name: "admin-service health (via gateway)",
    url: `${api}/api/v1/admin/health`,
    hint: "admin-service kapali veya gateway /api/v1/admin/health proxy yanlis."
  },
  {
    name: "gateway JWT required (GET /users/me)",
    url: `${api}/api/v1/users/me`,
    hint: "Gateway `requireAuth` zinciri veya /api/v1/users rotasi bozuk olabilir.",
    okStatuses: [401]
  },
  {
    name: "gateway JWT required (GET /conversations)",
    url: `${api}/api/v1/conversations`,
    hint: "Gateway `requireAuth` veya /api/v1/conversations proxy zinciri bozuk olabilir.",
    okStatuses: [401]
  },
  {
    name: "gateway JWT required (GET /offers/sent)",
    url: `${api}/api/v1/offers/sent`,
    hint: "Gateway `requireAuth` veya /api/v1/offers proxy zinciri bozuk olabilir.",
    okStatuses: [401]
  },
  {
    name: "gateway JWT required (GET /notifications)",
    url: `${api}/api/v1/notifications?limit=1`,
    hint: "Gateway `requireAuth` veya /api/v1/notifications proxy zinciri bozuk olabilir.",
    okStatuses: [401]
  },
  {
    name: "gateway JWT required (GET /ai)",
    url: `${api}/api/v1/ai/smoke-probe`,
    hint: "Gateway `requireAuth` veya /api/v1/ai proxy zinciri bozuk olabilir.",
    okStatuses: [401]
  },
  {
    name: "gateway JWT required (GET /reviews)",
    url: `${api}/api/v1/reviews/smoke-probe`,
    hint: "Gateway `requireAuth` veya /api/v1/reviews proxy zinciri bozuk olabilir.",
    okStatuses: [401]
  },
  {
    name: "gateway JWT required (GET /verifications)",
    url: `${api}/api/v1/verifications/smoke-probe`,
    hint: "Gateway `requireAuth` veya /api/v1/verifications proxy zinciri bozuk olabilir.",
    okStatuses: [401]
  },
  {
    name: "gateway JWT required (GET /payments)",
    url: `${api}/api/v1/payments`,
    hint: "Gateway `requireAuth` veya /api/v1/payments proxy zinciri bozuk olabilir.",
    okStatuses: [401]
  },
  {
    name: "gateway JWT required (GET /payments-secure)",
    url: `${api}/api/v1/payments-secure`,
    hint: "Gateway `requireAuth` (payments-secure zinciri) bozuk olabilir.",
    okStatuses: [401]
  },
  {
    name: "gateway admin key required (GET /admin)",
    url: `${api}/api/v1/admin/smoke-probe`,
    hint: "Gateway `requireAdmin` (x-admin-key) veya /api/v1/admin proxy zinciri bozuk olabilir.",
    okStatuses: [403]
  },
  {
    name: "gateway JWT required (POST /listings)",
    url: `${api}/api/v1/listings`,
    method: "POST",
    body: "{}",
    hint: "Gateway `requireListingWriteAuth` (POST) veya /api/v1/listings proxy zinciri bozuk olabilir.",
    okStatuses: [401]
  }
];

if (process.argv.includes("--list")) {
  if (wantsJson) {
    console.log(
      JSON.stringify(
        {
          kind: "smoke_check_list",
          schemaVersion: 1,
          apiBase: api,
          apiSource,
          fetchTimeoutMs,
          node: process.version,
          count: checks.length,
          checks: checks.map((c) => {
            const method = typeof c.method === "string" ? c.method : "GET";
            return {
              method,
              name: c.name,
              url: c.url,
              expectHttpOk: !Array.isArray(c.okStatuses),
              okStatuses: Array.isArray(c.okStatuses) ? c.okStatuses.slice().sort((a, b) => a - b) : null,
              requestIdEcho: REQUEST_ID_ECHO_CHECKS.has(c.name),
              body: c.body !== undefined
            };
          })
        },
        null,
        2
      )
    );
  } else {
    console.log(`apiBase\t${api}`);
    console.log(`count\t${checks.length}`);
    for (const c of checks) {
      const method = typeof c.method === "string" ? c.method : "GET";
      const expectStatus = Array.isArray(c.okStatuses) ? c.okStatuses.slice().sort((a, b) => a - b).join(",") : "2xx";
      console.log(`${method}\t${expectStatus}\t${c.name}\t${c.url}`);
    }
  }
  process.exit(0);
}

let failed = false;
const results = [];

if (!wantsJson && wantsVerbose) {
  console.log(`Smoke: apiBase=${api} apiSource=${apiSource} fetchTimeoutMs=${fetchTimeoutMs} failFast=${failFast}`);
}

for (const c of checks) {
  const checkStarted = Date.now();
  const durationMs = () => Date.now() - checkStarted;
  const fetchTimeout = createFetchTimeout(fetchTimeoutMs);
  try {
    const requestId = crypto.randomUUID();
    const method = typeof c.method === "string" ? c.method : "GET";
    /** @type {Record<string, string>} */
    const headers = {
      Accept: typeof c.accept === "string" ? c.accept : "application/json",
      "x-request-id": requestId
    };
    if (c.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(c.url, {
      method,
      headers,
      signal: fetchTimeout.signal,
      ...(c.body !== undefined ? { body: c.body } : {})
    });
    const httpOk = Array.isArray(c.okStatuses) ? c.okStatuses.includes(res.status) : res.ok;
    if (!httpOk) {
      failed = true;
      const ms = durationMs();
      const item = {
        ok: false,
        name: c.name,
        status: res.status,
        statusText: res.statusText,
        hint: c.hint,
        durationMs: ms
      };
      results.push(item);
      if (!wantsJson) {
        console.error(`✗ ${c.name}: ${res.status} ${res.statusText}${wantsVerbose ? ` [${ms}ms]` : ""}`);
        console.error(`  ↳ Cozum: ${c.hint}`);
      }
      if (failFast) break;
      continue;
    }
    if (REQUEST_ID_ECHO_CHECKS.has(c.name)) {
      const echoFail = requestIdEchoFailure(c.name, res, requestId);
      if (echoFail) {
        failed = true;
        const ms = durationMs();
        results.push({ ...echoFail, durationMs: ms });
        if (!wantsJson) {
          console.error(`✗ ${echoFail.name}: ${echoFail.statusText}${wantsVerbose ? ` [${ms}ms]` : ""}`);
          console.error(`  ↳ Cozum: ${echoFail.hint}`);
        }
        if (failFast) break;
        continue;
      }
    }
    if (c.name === "listing category spec") {
      const json = await res.json().catch(() => null);
      const hasFields = Boolean(json && Array.isArray(json.fields) && json.fields.length > 0);
      if (!hasFields) {
        failed = true;
        const ms = durationMs();
        const item = {
          ok: false,
          name: c.name,
          status: 200,
          statusText: "Invalid payload",
          hint: "Response `fields` array icermeli.",
          durationMs: ms
        };
        results.push(item);
        if (!wantsJson) {
          console.error(`✗ ${c.name}: payload gecersiz${wantsVerbose ? ` [${ms}ms]` : ""}`);
          console.error("  ↳ Cozum: Response `fields` array icermeli.");
        }
        if (failFast) break;
        continue;
      }
    }
    if (Array.isArray(c.expectTextContains) && c.expectTextContains.length > 0) {
      const text = await res.text().catch(() => "");
      const allPresent = c.expectTextContains.every((token) => text.includes(token));
      if (!allPresent) {
        failed = true;
        const ms = durationMs();
        const item = {
          ok: false,
          name: c.name,
          status: res.status,
          statusText: "Invalid metrics payload",
          hint: `Metrics body expected tokens: ${c.expectTextContains.join(" | ")}`,
          durationMs: ms
        };
        results.push(item);
        if (!wantsJson) {
          console.error(`✗ ${c.name}: payload gecersiz${wantsVerbose ? ` [${ms}ms]` : ""}`);
          console.error(`  ↳ Cozum: ${item.hint}`);
        }
        if (failFast) break;
        continue;
      }
    }
    const msOk = durationMs();
    results.push({
      ok: true,
      name: c.name,
      status: res.status,
      statusText: res.statusText,
      durationMs: msOk,
      ...(REQUEST_ID_ECHO_CHECKS.has(c.name) ? { requestIdEcho: true } : {})
    });
    if (!wantsJson) console.log(`✓ ${c.name}: ok${wantsVerbose ? ` (${msOk}ms)` : ""}`);
  } catch (e) {
    failed = true;
    const err = e instanceof Error ? e.message : "network error";
    const ms = durationMs();
    results.push({ ok: false, name: c.name, status: 0, statusText: err, hint: c.hint, durationMs: ms });
    if (!wantsJson) {
      console.error(`✗ ${c.name}: ${err}${wantsVerbose ? ` [${ms}ms]` : ""}`);
      console.error(`  ↳ Cozum: ${c.hint}`);
    }
    if (failFast) break;
  } finally {
    fetchTimeout.cancel();
  }
}

if (failed) {
  if (wantsJson) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          apiBase: api,
          totalWallMs: Date.now() - smokeStarted,
          meta: smokeMeta(),
          failedCount: results.filter((r) => !r.ok).length,
          results
        },
        null,
        2
      )
    );
  } else {
    console.error("\nSmoke readiness FAILED.");
    console.error("\nSummary:");
    for (const row of results) {
      if (row.ok) continue;
      console.error(`- ${row.name}: ${row.status} ${row.statusText}`);
    }
    if (failFast && results.length < checks.length) {
      console.error(`\nErken cikis: ${checks.length - results.length} kontrol calistirilmadi.`);
    }
    console.error(`\nToplam sure: ${Date.now() - smokeStarted}ms`);
  }
  process.exit(1);
}

if (wantsJson) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        apiBase: api,
        totalWallMs: Date.now() - smokeStarted,
        meta: smokeMeta(),
        failedCount: 0,
        results
      },
      null,
      2
    )
  );
} else {
  console.log("\nSmoke readiness PASSED.");
  console.log(`Toplam sure: ${Date.now() - smokeStarted}ms`);
}
