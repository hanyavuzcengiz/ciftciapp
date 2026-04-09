import fs from "node:fs";

const SUMMARY_PATH = process.env.GITHUB_STEP_SUMMARY;
if (!SUMMARY_PATH) process.exit(0);

const warnMs = Math.max(1, Number(process.env.SMOKE_SLOW_CHECK_WARN_MS || 5000));
const failOnSlow = String(process.env.SMOKE_FAIL_ON_SLOW_CHECKS || "").toLowerCase() === "true";
const metricsEnabled = String(process.env.SMOKE_METRICS_ENABLED || "").toLowerCase() === "true";

const files = [
  ["Base profile", "/tmp/smoke-base.json"],
  ["Metrics profile", "/tmp/smoke-metrics.json"]
];

/** @param {Array<{durationMs?: number}>} rows */
function p95(rows) {
  const values = rows
    .map((r) => (typeof r.durationMs === "number" ? r.durationMs : null))
    .filter((v) => v !== null)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const idx = Math.max(0, Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1));
  return values[idx];
}

let out = "## Smoke Summary\n\n";
out += `- metrics smoke: ${metricsEnabled ? "enabled" : "disabled"}\n`;
out += `- slow check warning threshold: ${warnMs}ms\n\n`;
out += `- fail on slow checks: ${failOnSlow ? "enabled" : "disabled"}\n\n`;
out += "| Profile | OK | Failed | Checks | Total Wall (ms) | P95 (ms) | Max (ms) | API Base |\n";
out += "|---|---:|---:|---:|---:|---:|---:|---|\n";

const sloBreaches = [];

for (const [label, path] of files) {
  if (!fs.existsSync(path)) {
    out += `| ${label} | n/a | n/a | n/a | n/a | n/a | n/a | n/a |\n`;
    continue;
  }
  try {
    const j = JSON.parse(fs.readFileSync(path, "utf8"));
    const rows = Array.isArray(j.results) ? j.results.filter((r) => r && typeof r.durationMs === "number") : [];
    const checks = Array.isArray(j.results) ? j.results.length : "n/a";
    const fail = typeof j.failedCount === "number" ? j.failedCount : "n/a";
    const ok = typeof j.ok === "boolean" ? (j.ok ? "yes" : "no") : "n/a";
    const wall = typeof j.totalWallMs === "number" ? j.totalWallMs : "n/a";
    const p95Ms = p95(rows);
    const maxMs = rows.length ? rows.reduce((m, r) => Math.max(m, r.durationMs), 0) : null;
    const apiBase = typeof j.apiBase === "string" ? j.apiBase : "n/a";
    out += `| ${label} | ${ok} | ${fail} | ${checks} | ${wall} | ${p95Ms ?? "n/a"} | ${maxMs ?? "n/a"} | ${apiBase} |\n`;

    const failures = Array.isArray(j.results) ? j.results.filter((r) => r && r.ok === false).slice(0, 3) : [];
    if (failures.length) {
      out += `\n### ${label} - First failures\n`;
      for (const f of failures) {
        const name = f.name || "unknown";
        const status = String(f.status ?? "n/a");
        const text = f.statusText || "";
        const hint = f.hint ? ` | hint: ${f.hint}` : "";
        out += `- ${name} (${status}${text ? `: ${text}` : ""})${hint}\n`;
      }
      out += "\n";
    }

    const slow = rows.slice().sort((a, b) => b.durationMs - a.durationMs).slice(0, 3);
    if (slow.length) {
      out += `### ${label} - Slowest checks\n`;
      for (const r of slow) {
        out += `- ${r.name || "unknown"} (${r.durationMs}ms)\n`;
      }
      out += "\n";
    }

    const over = rows.filter((r) => r.durationMs >= warnMs).sort((a, b) => b.durationMs - a.durationMs);
    if (over.length) {
      out += `> WARNING: ${label} has ${over.length} check(s) >= ${warnMs}ms. Slowest: ${over[0].name || "unknown"} (${over[0].durationMs}ms)\n\n`;
      if (failOnSlow) {
        sloBreaches.push({ label, overCount: over.length, slowest: over[0] });
      }
    }
  } catch {
    out += `| ${label} | parse-error | n/a | n/a | n/a | n/a | n/a | n/a |\n`;
  }
}

if (failOnSlow && sloBreaches.length) {
  out += "## SLO Gate\n\n";
  for (const b of sloBreaches) {
    out += `- ${b.label}: ${b.overCount} check(s) >= ${warnMs}ms (slowest: ${b.slowest.name || "unknown"} ${b.slowest.durationMs}ms)\n`;
  }
  out += "\n";
}

fs.appendFileSync(SUMMARY_PATH, out);

if (failOnSlow && sloBreaches.length) {
  process.exitCode = 1;
}
