/**
 * Read bench-report.json and print a markdown summary.
 * Includes latency/throughput per scenario and correctness (Mongo vs Postgres parity).
 */
import fs from 'fs';

const reportFile = process.env.REPORT_FILE || 'bench-report.json';
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
console.log('# Query strategy benchmark report\n');
console.log(`Iterations per scenario: ${report.iterations}\n`);
console.log('## Latency and throughput\n');
console.log('| Scenario | Mongo p50 (ms) | Mongo p95 | Mongo req/s | Postgres p50 (ms) | Postgres p95 | Postgres req/s |');
console.log('|----------|----------------|-----------|-------------|-------------------|--------------|----------------|');
for (const s of report.scenarios) {
  const m = s.mongo;
  const p = s.postgres;
  console.log(
    `| ${s.name} | ${m.p50.toFixed(2)} | ${m.p95.toFixed(2)} | ${m.reqPerSec.toFixed(1)} | ${p.p50.toFixed(2)} | ${p.p95.toFixed(2)} | ${p.reqPerSec.toFixed(1)} |`
  );
}
console.log('\n## Correctness (Mongo vs Postgres parity)\n');
console.log('| Scenario | Pass | Total match | Length match | Ids match | Mongo total | Postgres total |');
console.log('|----------|------|-------------|--------------|------------|-------------|----------------|');
for (const s of report.scenarios) {
  const c = s.correctness;
  if (!c) {
    console.log(`| ${s.name} | - | - | - | - | - | - |`);
    continue;
  }
  if (c.reason) {
    console.log(`| ${s.name} | ❌ | - | - | - | - | ${String(c.reason).replace(/\|/g, ' ')} |`);
    continue;
  }
  const pass = c.pass ? '✅' : '❌';
  console.log(
    `| ${s.name} | ${pass} | ${c.totalMatch} | ${c.lengthMatch} | ${c.idsMatch} | ${c.mongoTotal ?? '-'} | ${c.postgresTotal ?? '-'} |`
  );
}
console.log('\n## Rejection semantics\n');
console.log('| Scenario | Pass | Mongo | Postgres | Detail |');
console.log('|----------|------|-------|----------|--------|');
for (const s of report.scenarios) {
  const sem = s.semantics;
  if (!sem) {
    console.log(`| ${s.name} | - | - | - | - |`);
    continue;
  }
  const pass = sem.pass ? '✅' : '❌';
  const mongoPass = sem.mongo ? (sem.mongo.pass ? '✅' : '❌') : '-';
  const postgresPass = sem.postgres ? (sem.postgres.pass ? '✅' : '❌') : '-';
  const details = [];
  if (sem.mongo && !sem.mongo.pass && sem.mongo.message) details.push(`Mongo: ${sem.mongo.message}`);
  if (sem.postgres && !sem.postgres.pass && sem.postgres.message) details.push(`Postgres: ${sem.postgres.message}`);
  if (sem.mongo?.rejectedCount != null) details.push(`Mongo rejected: ${sem.mongo.rejectedCount}`);
  if (sem.postgres?.rejectedCount != null) details.push(`Postgres rejected: ${sem.postgres.rejectedCount}`);
  const detail = details.length ? details.join('; ').replace(/\|/g, ' ') : (sem.message ?? '-');
  console.log(`| ${s.name} | ${pass} | ${mongoPass} | ${postgresPass} | ${String(detail).replace(/\|/g, ' ')} |`);
}
console.log('\n');
