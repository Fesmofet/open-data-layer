# Query Benchmark CLI Runbook

Ordered commands to run benchmark scenarios for both strategies:

- `composition` (default in `docker-compose.yml`)
- `decomposition` (run apps with `QUERY_STRATEGY=decomposition`)

## 0) Prerequisites

```powershell
pnpm install
```

## 1) Clean start (optional but recommended)

Use this when you want a fully fresh DB state before reseeding.

```powershell
docker compose down -v
```

## 2) Start databases

```powershell
docker compose up -d mongodb postgres
```

## 3) Seed deterministic data

Default seed count in compose is `10000`. Override `SEED_COUNT` if needed.

```powershell
docker compose run --rm seed
```

## 4) Run benchmark: composition strategy

### 4.1 Start both query apps (composition)

```powershell
docker compose up -d query-mongo query-postgres
```

### 4.2 Run benchmark + report

```powershell
cd spec/benchmarks/query-strategy
$env:MONGO_URL="http://localhost:3001/api"
$env:POSTGRES_URL="http://localhost:3002/api"
$env:ITERATIONS="50"
$env:REPORT_FILE="bench-report-composition.json"
node run.js
node report.js
```

`bench-report-composition.json` is written. To print the markdown report: `$env:REPORT_FILE="bench-report-composition.json"; node report.js`

## 5) Run benchmark: decomposition strategy

Compose pins app env to composition, so run app processes directly with env override.

### 5.1 Stop compose app containers (keep DBs running)

```powershell
docker compose stop query-mongo query-postgres
```

### 5.2 Terminal A: start query-mongo in decomposition

```powershell
$env:MONGO_URI="mongodb://localhost:27017/odl-query"
$env:QUERY_STRATEGY="decomposition"
$env:PORT="3001"
pnpm nx serve query-mongo
```

### 5.3 Terminal B: start query-postgres in decomposition

```powershell
$env:DATABASE_URL="postgres://postgres:postgres@localhost:5432/odl_query"
$env:QUERY_STRATEGY="decomposition"
$env:PORT="3002"
pnpm nx serve query-postgres
```

### 5.4 Terminal C: run benchmark + report

```powershell
cd spec/benchmarks/query-strategy
$env:MONGO_URL="http://localhost:3001/api"
$env:POSTGRES_URL="http://localhost:3002/api"
$env:ITERATIONS="50"
$env:REPORT_FILE="bench-report-decomposition.json"
node run.js
node report.js
```

`bench-report-decomposition.json` is written for comparison with composition.

## 6) What is covered in each run

Current `run.js` scenarios:

- Geo: `by_object_id`, `list_page_1`, `list_page_mid`, `bbox_small`, `bbox_large`, `radius_small`, `radius_large`
- Tags/mixed: `tags_all`, `tags_any`, `mixed`
- Exact body: `exact_body`
- Text search: `text_contains`, `text_fulltext`
- Rejection semantics: `rejected_hidden`, `rejected_visible`

## 7) Shutdown

```powershell
docker compose down
```

To also delete DB volumes:

```powershell
docker compose down -v
```
