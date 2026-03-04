# Services Architecture (V2)

## 1) Overview

V2 is split into four deployable services:

- `Indexer Service` (write path, blockchain ingestion)
- `Query/Masking Service` (read path, governance policy application)
- `Dashboard/Admin/Billing Service` (plans, subscriptions, governance UX, analytics)
- `API Gateway/Rate-Limit Service` (token validation, quota/rate enforcement, usage metering)

This split is mandatory for scalability, monetization controls, and deterministic governance masking.

Design alignment:

- Keep transport layer agnostic where possible (HTTP + MCP now, extensible to WebSocket/RPC later).
- Keep business logic in services, not controllers.
- Keep monorepo distribution model for open-source assembly.

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
Indexer persists parsed posts and moderation-related raw state; muted filtering is resolved at query time.
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

## 4) Dashboard/Admin/Billing Service responsibilities

- Manage user subscriptions and plan entitlements.
- Expose governance management UX and policy profile controls.
- Store billing/plan metadata and usage analytics views.
- Publish access-token policy records for gateway enforcement.

## 5) API Gateway/Rate-Limit Service responsibilities

- Validate access tokens issued/managed by Dashboard/Admin/Billing Service.
- Enforce per-plan rate limits and quotas.
- Record request usage statistics for billing/analytics.
- Gate access to Query/Masking Service endpoints.

## 6) Service contract

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
- raw validity/rank votes for query-time resolution
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

### Dashboard -> Gateway contract

Minimum required fields:

- `token_id` / token hash
- `plan_id`
- `quota_policy`
- `rate_limit_policy`
- `governance_entitlements` (e.g., custom governance allowed or not)
- token lifecycle flags (active, revoked, expires_at)

### Gateway -> Query contract

- Authenticated subject and token metadata.
- Effective plan policy context (speed class, quotas, governance entitlement).
- Optional enforced governance constraints from plan.

## 7) Two-phase query pipeline (normative)

1. **Candidate phase (search/geo):**
   - Run full-text + geo + structural filters on neutral indexes.
   - Return bounded candidate set (update/object/post ids with base scores).
2. **Governance phase (mask + winner resolve):**
   - Resolve `resolved_governance_snapshot`.
   - Apply global and request masks to candidates.
   - Compute final winners for single/multi semantics and return ranked response.

Governance must be applied before final winner selection.

## 8) Determinism rules

- Indexer determinism: same event stream => same neutral state.
- Query determinism: same neutral state + same governance input => same response.
- Cross-service versioning must prevent mixed interpretation of governance schema versions.
- Gateway enforcement determinism: same token state and same request => same allow/deny and policy application result.

## 9) Failure domains

- Indexer failure must not corrupt query governance cache; query can continue on last consistent snapshot.
- Query failure must not affect indexer ingestion.
- Retries and partial failures must preserve idempotence guarantees.
- Gateway failure must fail closed for protected endpoints.
- Dashboard/Billing failure must not corrupt existing token validation snapshots in gateway.

## 10) Non-functional requirements (performance/capacity)

### Query SLA target

- For standard two-phase queries (text/geo filters + governance masking), target latency is:
  - `P95 < 200ms`
- This target applies under agreed production workload profile and warmed caches.
- Plan-specific latency classes may be enforced by gateway policy (e.g., slower class for free tier).

### Indexer capacity target

- Indexer must be able to sustain at least:
  - `10,000,000` object creations per day,
  - `350,000,000` update creations per day.
- Capacity target assumes horizontal scaling and partitioning are allowed by deployment architecture.

### Gateway/Billing observability targets

- Gateway must emit per-token usage metrics suitable for billing-grade aggregation.
- Dashboard/Billing must support plan-level usage visibility (requests, quota usage, throttling events).
