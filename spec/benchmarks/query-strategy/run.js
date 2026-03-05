/**
 * Benchmark runner: identical workload against query-mongo and query-postgres.
 * Scenarios: by object_id, bbox, radius, tags, tagsAny, mixed, exact body, text (contains/fulltext), rejected hidden/visible.
 * Outputs: p50/p95/p99 latency, req/s, correctness (parity) per scenario and per app.
 *
 * Usage: MONGO_URL=http://localhost:3001/api POSTGRES_URL=http://localhost:3002/api ITERATIONS=50 node run.js
 */
const MONGO_BASE = process.env.MONGO_URL || 'http://localhost:3001/api';
const POSTGRES_BASE = process.env.POSTGRES_URL || 'http://localhost:3002/api';
const ITERATIONS = parseInt(process.env.ITERATIONS || '50', 10);

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, i)];
}

async function measure(url) {
  const start = performance.now();
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await res.text();
  const end = performance.now();
  if (!res.ok) throw new Error(`${res.status} ${body}`);
  return { latency: end - start, body };
}

async function fetchJson(base, url) {
  const res = await fetch(`${base}${url}`, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return JSON.parse(text);
}

/** Normalize by-id response to single item or null for parity comparison. */
function normalizeByIdResponse(res) {
  if (res == null) return null;
  if (Array.isArray(res.data) && res.data.length <= 1) {
    return res.data[0] ?? null;
  }
  if (typeof res.objectId === 'string') return res;
  return null;
}

/** Compare Mongo vs Postgres result. For list: same total, length, objectIds (sorted). For by-id: same objectId and decisive fields or both null. */
function correctness(mongoResult, postgresResult, scenarioName) {
  if (scenarioName === 'by_object_id') {
    const m = normalizeByIdResponse(mongoResult);
    const p = normalizeByIdResponse(postgresResult);
    if (m == null && p == null) return { pass: true, totalMatch: true, lengthMatch: true, idsMatch: true, mongoTotal: 0, postgresTotal: 0 };
    if (m == null || p == null) return { pass: false, reason: 'by-id shape mismatch: one null one present', totalMatch: false, lengthMatch: false, idsMatch: false, mongoTotal: m ? 1 : 0, postgresTotal: p ? 1 : 0 };
    const idMatch = m.objectId === p.objectId;
    const decisiveMatch = (m.finalStatus === p.finalStatus) && (m.decisiveRole === p.decisiveRole) && (m.rejectedBy === p.rejectedBy);
    const pass = idMatch && decisiveMatch;
    return {
      pass,
      totalMatch: idMatch,
      lengthMatch: true,
      idsMatch: decisiveMatch,
      mongoTotal: 1,
      postgresTotal: 1,
      reason: pass ? undefined : 'by-id objectId or decisive fields differ',
    };
  }
  if (!mongoResult?.data || !postgresResult?.data) return { pass: false, reason: 'missing data' };
  const mTotal = mongoResult.total ?? 0;
  const pTotal = postgresResult.total ?? 0;
  const mIds = mongoResult.data.map((d) => d.objectId).sort();
  const pIds = postgresResult.data.map((d) => d.objectId).sort();
  const totalMatch = mTotal === pTotal;
  const lengthMatch = mongoResult.data.length === postgresResult.data.length;
  const idsMatch = mIds.length === pIds.length && mIds.every((id, i) => id === pIds[i]);
  return {
    pass: totalMatch && lengthMatch && idsMatch,
    totalMatch,
    lengthMatch,
    idsMatch,
    mongoTotal: mTotal,
    postgresTotal: pTotal,
  };
}

/**
 * Check rejection semantics per DB. rejected_hidden: no finalStatus=REJECTED. rejected_visible: at least one REJECTED row with decisiveRole and rejectedBy.
 * Returns { pass, mongo: { pass, message? }, postgres: { pass, message? } } so report can show per-DB detail.
 */
function rejectionSemantics(scenarioName, mongoData, postgresData) {
  function checkHidden(data) {
    const arr = data?.data ?? [];
    const hasRejected = arr.some((d) => d.finalStatus === 'REJECTED');
    return { pass: !hasRejected, message: hasRejected ? 'rejected_hidden must not return finalStatus=REJECTED' : 'ok' };
  }
  function checkVisible(data) {
    const arr = data?.data ?? [];
    const rejected = arr.filter((d) => d.finalStatus === 'REJECTED');
    const missingMeta = rejected.some((d) => d.decisiveRole == null || d.rejectedBy == null);
    const nonZeroRejected = rejected.length > 0;
    const pass = nonZeroRejected && !missingMeta;
    let message = 'ok';
    if (!nonZeroRejected) message = 'rejected_visible must include at least one finalStatus=REJECTED row';
    else if (missingMeta) message = 'rejected rows must expose decisiveRole and rejectedBy';
    return { pass, rejectedCount: rejected.length, message };
  }
  if (scenarioName === 'rejected_hidden') {
    const mongo = checkHidden(mongoData);
    const postgres = checkHidden(postgresData);
    return { pass: mongo.pass && postgres.pass, mongo, postgres };
  }
  if (scenarioName === 'rejected_visible') {
    const mongo = checkVisible(mongoData);
    const postgres = checkVisible(postgresData);
    return { pass: mongo.pass && postgres.pass, mongo, postgres };
  }
  return null;
}

async function runScenario(name, buildUrl, options = {}) {
  const { checkCorrectness = true } = options;
  const results = { name, mongo: [], postgres: [] };
  for (let i = 0; i < ITERATIONS; i++) {
    const url = typeof buildUrl === 'function' ? buildUrl(i) : buildUrl;
    try {
      const out = await measure(`${MONGO_BASE}${url}`);
      results.mongo.push(out.latency);
    } catch (e) {
      results.mongo.push(-1);
    }
    try {
      const out = await measure(`${POSTGRES_BASE}${url}`);
      results.postgres.push(out.latency);
    } catch (e) {
      results.postgres.push(-1);
    }
  }
  const validM = results.mongo.filter((t) => t >= 0).sort((a, b) => a - b);
  const validP = results.postgres.filter((t) => t >= 0).sort((a, b) => a - b);
  const scenarioResult = {
    name,
    mongo: {
      count: validM.length,
      p50: percentile(validM, 50),
      p95: percentile(validM, 95),
      p99: percentile(validM, 99),
      reqPerSec: validM.length > 0 ? (1000 / (validM.reduce((a, b) => a + b, 0) / validM.length)) : 0,
    },
    postgres: {
      count: validP.length,
      p50: percentile(validP, 50),
      p95: percentile(validP, 95),
      p99: percentile(validP, 99),
      reqPerSec: validP.length > 0 ? (1000 / (validP.reduce((a, b) => a + b, 0) / validP.length)) : 0,
    },
  };
  if (checkCorrectness) {
    try {
      const url = typeof buildUrl === 'function' ? buildUrl(0) : buildUrl;
      const [mongoData, postgresData] = await Promise.all([
        fetchJson(MONGO_BASE, url),
        fetchJson(POSTGRES_BASE, url),
      ]);
      scenarioResult.correctness = correctness(mongoData, postgresData, name);
      const semantics = rejectionSemantics(name, mongoData, postgresData);
      if (semantics) scenarioResult.semantics = semantics;
    } catch (e) {
      scenarioResult.correctness = { pass: false, reason: e.message };
    }
  }
  return scenarioResult;
}

/** Deterministic RNG matching tools/seed/run.js mulberry32(SEED_SEED). */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BENCH_SEED = parseInt(process.env.SEED_SEED || '42', 10);
const TAGS = ['restaurant', 'cafe', 'park', 'museum', 'shop', 'hotel', 'beach', 'hike', 'city', 'nature'];

/** Yield updateBodyExact for place at index i using same logic as tools/seed/run.js generatePlaces. */
function getUpdateBodyExactForPlaceIndex(i) {
  const rng = mulberry32(BENCH_SEED);
  for (let k = 0; k <= i; k++) {
    rng(); // lng
    rng(); // lat
    const numTags = Math.floor(rng() * 5) + 1;
    const tags = [];
    const used = new Set();
    while (tags.length < numTags) {
      const t = TAGS[Math.floor(rng() * TAGS.length)];
      if (!used.has(t)) {
        used.add(t);
        tags.push(t);
      }
    }
    const name = `Place ${k}`;
    const body = `Description for place ${k} with tags ${tags.join(' ')}.`;
    const updateBodyExact = JSON.stringify({ name, body, tags });
    if (k === i) return updateBodyExact;
  }
  return null;
}

/** Exact payload for place-0 with default seed; matches seeded data so exact_body returns 1 row. */
const SAMPLE_UPDATE_BODY_EXACT = encodeURIComponent(getUpdateBodyExactForPlaceIndex(0));

async function main() {
  const scenarios = [
    // Geo
    ['by_object_id', (i) => `/places/place-${i % 1000}`],
    ['list_page_1', () => '/places?page=1&limit=20'],
    ['list_page_mid', () => '/places?page=500&limit=20'],
    ['bbox_small', () => '/places?minLng=-0.1&minLat=51.4&maxLng=0.1&maxLat=51.6&limit=20'],
    ['bbox_large', () => '/places?minLng=-10&minLat=40&maxLng=10&maxLat=60&limit=100'],
    ['radius_small', () => '/places?lat=51.5&lng=0&radiusMeters=5000&limit=20'],
    ['radius_large', () => '/places?lat=51.5&lng=0&radiusMeters=500000&limit=100'],
    // Tags
    ['tags_all', () => '/places?tags=restaurant&tags=cafe&limit=20'],
    ['tags_any', () => '/places?tagsAny=park&tagsAny=museum&limit=20'],
    ['mixed', () => '/places?minLng=-1&minLat=51&maxLng=1&maxLat=52&tagsAny=restaurant&limit=20'],
    // Exact update body
    ['exact_body', () => `/places?updateBodyExact=${SAMPLE_UPDATE_BODY_EXACT}&limit=20`],
    // Text search
    ['text_contains', () => '/places?textQuery=Place&textMode=contains&limit=20'],
    ['text_fulltext', () => '/places?textQuery=Place&textMode=fulltext&limit=20'],
    // Rejection: default excludes rejected (governance owner=user-0 so place-0 etc. are REJECTED and hidden)
    ['rejected_hidden', () => '/places?page=1&limit=50&owner=user-0'],
    // Rejection: include rejected (returns all rows; rejected have finalStatus, decisiveRole, rejectedBy)
    ['rejected_visible', () => '/places?page=1&limit=50&includeRejected=true&owner=user-0'],
  ];

  const report = { iterations: ITERATIONS, scenarios: [] };
  for (const [name, url] of scenarios) {
    const result = await runScenario(name, url);
    report.scenarios.push(result);
    console.log(JSON.stringify(result, null, 2));
  }
  const fs = await import('fs');
  const reportFile = process.env.REPORT_FILE || 'bench-report.json';
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log('Wrote ' + reportFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
