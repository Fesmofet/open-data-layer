# Governance V2 (English reference)

This file keeps a legacy name for compatibility, but its content is the canonical English Governance V2 summary.

## 1) Governance in V2

Governance is a **query-time policy layer** applied over already indexed blockchain data.

- The indexer stores canonical events and neutral materialized state.
- Governance masks are applied by the query service per request.
- Different governance inputs may produce different API views over the same indexed state.

## 2) Service model

### Indexer Service

- Ingests blockchain events in canonical order.
- Validates payload/syntax and references.
- Builds neutral state (`objects`, `updates`, `votes`, governance declarations).
- Does not apply tenant governance filtering.

### Query/Masking Service

- Receives request + governance context.
- Resolves governance graph (owner/admin/trusted/moderator rules).
- Applies mask precedence and returns filtered/ranked response.
- Supports cache + invalidation for governance resolution.

### Dashboard/Admin/Billing Service

- Manages subscriptions, plan entitlements, governance UX, and usage analytics.

### API Gateway/Rate-Limit Service

- Validates access tokens, enforces plan limits, and records usage before forwarding to query service.

## 3) Governance layers and precedence

Two masks are applied in fixed order:

1. Global/platform governance (operator-level safety/legal restrictions).
2. Request governance (tenant/subscription/user-selected policy).

Request governance cannot bypass global restrictions.

## 4) Roles and functional domains

- `owner`, `admin`, `trusted` operate in the data domain (object/update trust and data quality).
- `moderator` operates in the social domain (feed/review/social presentation controls).
- Role precedence is deterministic and defined in `spec/governance_resolution.md`.

## 5) Governance objects and trust nesting

- Governance is declared on-chain as objects/events.
- No singleton bootstrap committee is required in V2.
- Trust may be nested (for example, trusted depth rules), but depth and traversal limits must be explicit.
- Resolution output must be deterministic for the same block range and governance input.

## 6) Determinism requirements

- Indexer determinism: same input stream => same neutral state.
- Query determinism: same neutral state + same governance inputs => same filtered response.
- Governance changes must trigger deterministic cache invalidation and recomputation.

## 7) Overflow and operational policy

- Default publish path is Hive.
- IPFS is the emergency/offload path for:
  - large initial imports,
  - backlog drain when update queue overflows.
- Arweave is deferred and kept as future permanence extension.
- Confirmation lifecycle (`accepted` vs finalized), polling, and TTL are specified in `spec/overflow_strategy.md`.

## 8) Where to read full normative rules

- Service boundaries: `spec/services_architecture.md`
- Governance graph/masks: `spec/governance_resolution.md`
- Overflow strategy: `spec/overflow_strategy.md`
- End-to-end spec: `spec_governance_updates.md`
