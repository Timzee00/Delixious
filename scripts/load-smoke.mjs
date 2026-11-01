#!/usr/bin/env node
/**
 * Safe read-only staging load smoke test. Never targets production hosts.
 * Example:
 *  BASE_URL=https://delixious-staging.onrender.com CONCURRENCY=10 REQUESTS=150 node scripts/load-smoke.mjs
 */
const base = process.env.BASE_URL || '';
const concurrency = Number(process.env.CONCURRENCY || 10);
const requestCount = Number(process.env.REQUESTS || 150);
const p95LimitMs = Number(process.env.P95_LIMIT_MS || 2000);
const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 8000);

if (!base) {
  console.error('BASE_URL is required. Use a staging deployment, not production.');
  process.exit(2);
}

let target;
try { target = new URL(base); }
catch { console.error('BASE_URL must be a valid absolute URL.'); process.exit(2); }
if (target.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(target.hostname)) {
  console.error('Non-local targets must use HTTPS.');
  process.exit(2);
}

const production = new Set([
  'delixious.netlify.app',
  'delixious-backend.onrender.com',
]);
if (production.has(target.hostname) ||
    (target.hostname.endsWith('delixious.com') && !target.hostname.includes('staging')) ||
    !(/staging|preview|localhost|127\.0\.0\.1/i).test(target.hostname)) {
  console.error('Refusing to load-test a non-staging host: ' + target.hostname);
  process.exit(2);
}
if (![concurrency, requestCount, p95LimitMs, timeoutMs].every(Number.isSafeInteger)
  || concurrency < 1 || concurrency > 100
  || requestCount < 1 || requestCount > 10000
  || p95LimitMs < 1 || timeoutMs < 100) {
  console.error('Invalid limits. CONCURRENCY 1–100, REQUESTS 1–10,000.');
  process.exit(2);
}

const paths = ['/health', '/api/restaurants?page=1&limit=12', '/api/menu-items/feed?page=1&limit=12'];
const records = [];
let cursor = 0;

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const result = await fetch(new URL(path, target), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal,
    });
    // Consume the response body to avoid measuring only headers.
    await result.arrayBuffer();
    records.push({ path: path.split('?')[0], ms: performance.now() - start, ok: result.ok, status: result.status });
  } catch (error) {
    records.push({ path: path.split('?')[0], ms: performance.now() - start, ok: false, status: error?.name || 'network-error' });
  } finally { clearTimeout(timer); }
}
async function worker() {
  while (cursor < requestCount) {
    const i = cursor++;
    await request(paths[i % paths.length]);
  }
}
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]);
};

console.log(`Staging smoke: ${target.origin}; ${requestCount} requests, ${concurrency} concurrent workers`);
await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, () => worker()));
for (const path of paths) {
  const entries = records.filter(row => row.path === path.split('?')[0]);
  console.log(JSON.stringify({
    route: path.split('?')[0], requests: entries.length,
    failures: entries.filter(row => !row.ok).length,
    p50_ms: percentile(entries.map(row => row.ms), .5),
    p95_ms: percentile(entries.map(row => row.ms), .95),
    p99_ms: percentile(entries.map(row => row.ms), .99),
  }));
}
const failures = records.filter(row => !row.ok);
const p95 = percentile(records.map(row => row.ms), .95);
console.log(JSON.stringify({ total: records.length, failures: failures.length, p95_ms: p95, limit_ms: p95LimitMs }));
if (failures.length || p95 > p95LimitMs) process.exitCode = 1;
