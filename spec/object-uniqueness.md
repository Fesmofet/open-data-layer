# Object uniqueness and collision behavior

**Back:** [Spec index](README.md) · **Related:** [object-type-entity](object-type-entity.md), [reject-codes](reject-codes.md), [acceptance-tests](acceptance-tests.md)

## Scope

This file defines write-path uniqueness rules for the Indexer Service.

- Governance-based creator filtering is a Query/Masking concern in V2.
- Indexer uniqueness logic is independent of request governance masks.

## Rule: global uniqueness of object_id

- `object_id` is chosen by the creator in the `object_create` payload.
- Uniqueness is **global**: at most one object per `object_id` in the system.
- If an object with the given `object_id` already exists in materialized state, the event is **rejected** with `OBJECT_ALREADY_EXISTS`. The object is **not** created under any circumstances.

## Canonical order for race resolution

Events are applied in **canonical order**:

```
(block_num ASC, trx_index ASC, op_index ASC, transaction_id ASC)
```

When multiple `object_create` events with the **same** `object_id` exist (e.g. in the same block or across blocks):

1. Sort all such events by the canonical order above.
2. Apply the **first** valid event (payload valid, creator matches, etc.): create the object and record `created_tx_id`, `created_block`, `creator`.
3. All **subsequent** events with the same `object_id` are rejected with `OBJECT_ALREADY_EXISTS`, regardless of block or creator.

## Determinism

- Re-indexing the same block range must yield the same result: exactly one object per `object_id`, created by the first valid `object_create` in canonical order.
- Reject decisions must be stable: once an event is rejected as `OBJECT_ALREADY_EXISTS`, it remains rejected on reindex.

## Idempotency

- A second `object_create` with the same `object_id` (e.g. retry by same creator) is **never** accepted after the first successful create. No "replace" or "upsert" semantics.
