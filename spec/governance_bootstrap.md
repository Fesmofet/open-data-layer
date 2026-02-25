# Governance bootstrap

## Root of trust: bootstrap_allowlist

The indexer MUST have a **fixed** list of accounts allowed to perform the one-time genesis operation. This list is configured at deploy time (e.g. in config or env) and MUST NOT be changed without a coordinated upgrade.

- Config key (example): `governance.bootstrap_allowlist`
- Type: list of Hive account names (strings).
- Recommended size: 3–5 accounts.

Only an account in `bootstrap_allowlist` may emit the **first** valid `create_committee` event.

## Single create_committee rule

1. **Before any create_committee is applied**
   - State: `governance_initialized = false`, `genesis_tx_id = null`.

2. **Processing create_committee events (in canonical order)**
   - Canonical order: `(block_num, trx_index, op_index, transaction_id)`.
   - For each `create_committee` event in order:
     - If `governance_initialized` is already `true`: reject with `DUPLICATE_GENESIS`. Do not apply.
     - If `creator` is **not** in `bootstrap_allowlist`: reject with `UNAUTHORIZED_GOVERNANCE_OP`. Do not apply.
     - If payload is invalid: reject with `INVALID_GOVERNANCE_PAYLOAD`. Do not apply.
     - Otherwise: apply the event, set `governance_initialized = true`, set `genesis_tx_id = transaction_id`, persist committee id, threshold, members.

3. **After the first valid create_committee**
   - Every subsequent `create_committee` (any block, any creator) is rejected with `DUPLICATE_GENESIS`.
   - No second committee creation is ever accepted.

## Validity of the first create_committee

The **first** valid `create_committee` is the one that:
- Has `creator` in `bootstrap_allowlist`,
- Passes payload validation (schema + business rules),
- Is the earliest such event when ordered by `(block_num, trx_index, op_index, transaction_id)`.

## Determinism

- Re-indexing must yield the same genesis: same `genesis_tx_id`, same `governance_initialized = true` after the same event.
- The bootstrap_allowlist is part of the indexer configuration, not on-chain; it must be identical across indexer instances for the same network.
