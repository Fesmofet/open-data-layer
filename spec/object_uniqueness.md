# Object uniqueness and collision behavior

## Precondition: muted list (create operations)

Before any business validation for **create** operations (`object_create`, `update_create`):

- The indexer MUST check whether `creator` is in the **muted list** (Hive muted list) of **any** governance participant at **event time** (block time of the event).
- **Governance participants** = committee members + governance-role holders (see [spec_governance.md](../spec_governance.md)).
- If there exists at least one participant such that `creator` is muted by that participant at event time, the event is **rejected** with `CREATOR_MUTED_BY_GOVERNANCE`.
- This check is performed **before** uniqueness, payload, or referential checks so that the reject reason is unambiguous.
- Same rule applies to both `object_create` (od.objects.v1) and `update_create` (od.updates.v1). It does **not** apply to `update_vote`.

Determinism: muted state is evaluated at event block time so reindex yields the same accept/reject result.

**Validation order for create events** (object_create and update_create):

1. Canonical order applied.
2. **Muted check** at event time: if creator muted by any governance participant → reject `CREATOR_MUTED_BY_GOVERNANCE`.
3. Business validation (payload, uniqueness, object existence for update_create, etc.).
4. Apply state change.

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
