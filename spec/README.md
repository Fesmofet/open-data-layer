# Open Data V2 Specification

Specification for deterministic indexing plus request-time governance masking.

## Architecture baseline

V2 is a four-service model:

- `Indexer Service` stores canonical neutral state.
- `Query/Masking Service` applies governance masks per request.
- `Dashboard/Admin/Billing Service` manages plans and governance entitlements.
- `API Gateway/Rate-Limit Service` enforces tokens, quotas, and speed classes.

## Layout

- **schemas/** — JSON Schema for blockchain events.
  - includes `odl_event_envelope.json` for unified ODL `custom_json` envelope.
  - includes draft `object_type_create.json` and `object_type_update.json` for `object_type` registry lifecycle.
  - includes `rank_vote.json` for ranking channel votes.
- **reject_codes.md** — Canonical processing and API/query error codes.
- **object_uniqueness.md** — object_id uniqueness and collision rules.
- **object_type_entity.md** — governance-controlled `object_type` registry (`name`, `supported_updates`, `supposed_updates`).
- **vote_semantics.md** — query-time validity and ranking vote resolution.
- **governance_bootstrap.md** — V2 governance initialization model (bootstrap replacement note).
- **governance_resolution.md** — role precedence, trust graph traversal, cache invalidation.
- **services_architecture.md** — indexer/query boundary and contract.
- **social_account_ingestion.md** — social/account ingestion schema and v1/v2 metadata merge rules.
- **overflow_strategy.md** — Hive baseline publishing and IPFS overflow policy (Arweave deferred).
- **storage_spec.md** — primary write path, overflow backend, and deferred permanence integration points.
- **monetization_spec.md** — plan tiers, entitlement mapping, gateway/billing enforcement model.
- **acceptance_tests.md** — acceptance test cases across both services.

## ODL event ids and envelope

- Main network `custom_json.id`: `odl-mainnet`
- Test network `custom_json.id`: `odl-testnet`

ODL event envelope:

```json
{
  "events": [
    {
      "action": "string",
      "v": 1,
      "payload": {}
    }
  ]
}
```

Action space in `events[].action`:

- object writes: `object_create`
- update writes: `update_create`, `update_vote`, `rank_vote`
- Governance declarations are written as objects with `object_type = governance` (no separate governance namespace).

## Core references

- End-to-end summary: `../spec_governance_updates.md`
- Governance overview: `../GOVERNANCE_RU.md`

## Running schema checks

From repo root:

```bash
node spec/validate_schemas.js
```
