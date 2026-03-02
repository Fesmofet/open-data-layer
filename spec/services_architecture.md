# Services Architecture (V2)

## 1) Overview

V2 is split into two independent services:

- `Indexer Service` (write path, blockchain ingestion)
- `Query/Masking Service` (read path, governance policy application)

This split is mandatory for scalability and deterministic governance masking.

## 2) Indexer Service responsibilities

- Read blockchain events in canonical order.
- Validate payload and write-path business invariants.
- Persist:
  - canonical event log,
  - neutral materialized state,
  - governance declarations as regular objects (`object_type = governance`, as data, not final filtering result).
  - `object_type` registry entities (`name`, `supported_updates`, `supposed_updates`).
  - parsed Hive posts dataset (metadata/body extraction + object links).
- Expose neutral read contract for query service.

Indexer does not apply tenant/request governance filtering.
Indexer does validate `update_create` against `object_type.supported_updates`.
Indexer parses Hive post metadata/body and extracts potential object references.
Indexer skips persisting posts whose author is muted by governance owner/moderator set resolved at post block time.
Indexer parses and persists Hive social/account operations:
- `mute` relations,
- `follow` / `unfollow` relations,
- `reblog` actions,
- `create_account`,
- `update_account` (v1/v2 forms).
For user profile projection, indexer currently stores only:
- `name`,
- `alias`,
- raw `json_metadata`,
- `profile_image` extracted from `json_metadata`.

## 3) Query/Masking Service responsibilities

- Receive API requests with governance context.
- Resolve effective governance set (global + request scope).
- Apply mask and precedence rules.
- Return filtered/ranked data to client.
- Maintain governance resolution cache with deterministic invalidation.

## 4) Service contract

### Indexer -> Query data contract

Minimum required datasets:

- objects state
- updates state and vote aggregates
- governance declarations (`object_type = governance`) and role/trust edges
- object type registry state (`object_type` entity set)
- parsed posts index with object links (`post_id -> object_type, object_ref`)
- social graph/state:
  - mutes
  - follows
  - reblogs
- accounts projection (v1/v2 unified):
  - `account`
  - `name`
  - `alias`
  - `json_metadata`
  - `profile_image`
- event metadata required for deterministic tie-breaks

### Query input contract

Each query must include:

- resource/filter parameters,
- governance context (governance id/profile or explicit policy ref),
- optional pagination/sort controls.

## 5) Two-phase query pipeline (normative)

1. **Candidate phase (search/geo):**
   - Run full-text + geo + structural filters on neutral indexes.
   - Return bounded candidate set (update/object/post ids with base scores).
2. **Governance phase (mask + winner resolve):**
   - Resolve `resolved_governance_snapshot`.
   - Apply global and request masks to candidates.
   - Compute final winners for single/multi semantics and return ranked response.

Governance must be applied before final winner selection.

## 6) Determinism rules

- Indexer determinism: same event stream => same neutral state.
- Query determinism: same neutral state + same governance input => same response.
- Cross-service versioning must prevent mixed interpretation of governance schema versions.

## 7) Failure domains

- Indexer failure must not corrupt query governance cache; query can continue on last consistent snapshot.
- Query failure must not affect indexer ingestion.
- Retries and partial failures must preserve idempotence guarantees.

## 8) Non-functional requirements (performance/capacity)

### Query SLA target

- For standard two-phase queries (text/geo filters + governance masking), target latency is:
  - `P95 < 200ms`
- This target applies under agreed production workload profile and warmed caches.

### Indexer capacity target

- Indexer must be able to sustain at least:
  - `10,000,000` object creations per day,
  - `350,000,000` update creations per day.
- Capacity target assumes horizontal scaling and partitioning are allowed by deployment architecture.
