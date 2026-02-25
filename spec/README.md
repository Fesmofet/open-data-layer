# Open Data consensus spec (Hive v2)

Specification for object creation, updates, votes, and governance.

## Layout

- **schemas/** — JSON Schema for events (object_create, create_committee, update_create, update_vote).
- **reject_codes.md** — Canonical reject codes for all namespaces.
- **object_uniqueness.md** — object_id uniqueness and collision rules.
- **governance_bootstrap.md** — bootstrap_allowlist and single create_committee.
- **vote_semantics.md** — revote = replace, dynamic validity.
- **acceptance_tests.md** — Acceptance test cases (object uniqueness, revote, reindex determinism, governance).
- **config_example.yaml** — Example governance bootstrap config.

## Namespaces

- `od.objects.v1` — object_create
- `od.governance.v1` — create_committee, grant_role, revoke_role
- `od.updates.v1` — update_create, update_vote

## Running schema checks

From repo root:

```bash
node spec/validate_schemas.js
```

Or with Node: `node spec/validate_schemas.js` (validates JSON and required fields).
