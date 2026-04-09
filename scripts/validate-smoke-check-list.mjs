import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const smokeScript = path.join(__dirname, "smoke-prod-readiness.mjs");

const r = spawnSync(process.execPath, [smokeScript, "--list", "--json"], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
  // Validate deterministic base profile (metrics check disabled by default).
  env: { ...process.env, SMOKE_CHECK_METRICS: "0" }
});

if (r.error) {
  console.error(r.error);
  process.exit(1);
}
if (r.status !== 0) {
  console.error(r.stderr || r.stdout || `exit ${r.status}`);
  process.exit(r.status ?? 1);
}

let j;
try {
  j = JSON.parse(r.stdout);
} catch (e) {
  console.error("Invalid JSON from smoke --list --json:", e);
  process.exit(1);
}

if (j.kind !== "smoke_check_list" || j.schemaVersion !== 1 || j.count !== j.checks.length || j.count < 1) {
  console.error("Smoke checklist validation failed:", j);
  process.exit(1);
}

const checkNames = new Set();

if (typeof j.apiBase !== "string" || j.apiBase.trim().length < 8 || !/^https?:\/\//i.test(j.apiBase.trim())) {
  console.error("Smoke checklist: apiBase gecersiz veya eksik:", j.apiBase);
  process.exit(1);
}

const allowedApiSource = new Set(["SMOKE_API_URL", "NEXT_PUBLIC_API_URL", "EXPO_PUBLIC_API_URL", "default"]);
if (typeof j.apiSource !== "string" || !allowedApiSource.has(j.apiSource)) {
  console.error("Smoke checklist: apiSource gecersiz veya eksik:", j.apiSource);
  process.exit(1);
}

if (typeof j.fetchTimeoutMs !== "number" || !Number.isFinite(j.fetchTimeoutMs) || j.fetchTimeoutMs < 1000) {
  console.error("Smoke checklist: fetchTimeoutMs gecersiz veya eksik:", j.fetchTimeoutMs);
  process.exit(1);
}

if (typeof j.node !== "string" || !j.node.startsWith("v")) {
  console.error("Smoke checklist: node surumu eksik veya gecersiz:", j.node);
  process.exit(1);
}

if (!Array.isArray(j.checks)) {
  console.error("Smoke checklist: checks[] dizi degil");
  process.exit(1);
}

const baseNorm = j.apiBase.trim().replace(/\/+$/, "");
const allowedMethods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

for (let i = 0; i < j.checks.length; i++) {
  const c = j.checks[i];
  if (!c || typeof c !== "object") {
    console.error(`Smoke checklist: checks[${i}] nesne degil`);
    process.exit(1);
  }
  if (typeof c.name !== "string" || !c.name.trim()) {
    console.error("Smoke checklist: name bos veya eksik, index=", i);
    process.exit(1);
  }
  if (checkNames.has(c.name)) {
    console.error("Smoke checklist: tekrarlayan kontrol adi:", c.name);
    process.exit(1);
  }
  checkNames.add(c.name);
  if (typeof c.method !== "string" || !allowedMethods.has(c.method)) {
    console.error("Smoke checklist: method gecersiz:", c.name, c.method);
    process.exit(1);
  }
  if (typeof c.url !== "string" || !c.url.trim()) {
    console.error("Smoke checklist: url bos:", c.name);
    process.exit(1);
  }
  const u = c.url.trim();
  if (u !== baseNorm && !u.startsWith(`${baseNorm}/`)) {
    console.error("Smoke checklist: url apiBase ile uyusmuyor:", c.name, u);
    process.exit(1);
  }
  if (typeof c.expectHttpOk !== "boolean") {
    console.error("Smoke checklist: expectHttpOk boolean degil:", c.name);
    process.exit(1);
  }
  if (typeof c.requestIdEcho !== "boolean") {
    console.error("Smoke checklist: requestIdEcho boolean degil:", c.name);
    process.exit(1);
  }
  if (typeof c.body !== "boolean") {
    console.error("Smoke checklist: body boolean degil:", c.name);
    process.exit(1);
  }
  if (c.expectHttpOk) {
    if (c.okStatuses != null) {
      console.error("Smoke checklist: expectHttpOk true iken okStatuses null degil:", c.name, c.okStatuses);
      process.exit(1);
    }
  } else {
    if (!Array.isArray(c.okStatuses) || c.okStatuses.length < 1) {
      console.error("Smoke checklist: expectHttpOk false iken okStatuses dizi olmali:", c.name);
      process.exit(1);
    }
    for (const code of c.okStatuses) {
      if (typeof code !== "number" || !Number.isInteger(code) || code < 100 || code > 599) {
        console.error("Smoke checklist: gecersiz HTTP durum kodu:", c.name, code);
        process.exit(1);
      }
    }
  }
}

console.log(
  `smoke checklist ok: ${j.count} checks (apiBase=${j.apiBase}, apiSource=${j.apiSource}, fetchTimeoutMs=${j.fetchTimeoutMs}, node=${j.node})`
);
