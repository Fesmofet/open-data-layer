# Vote semantics: query-time validity and rank resolution

Votes are stored as neutral raw events by the Indexer Service.
All role-based interpretation is resolved in Query/Masking Service using governance context/snapshot.

## A) Validity channel (`update_vote`)

### Storage model

- One active raw validity vote per `(update_id, voter)`.
- Revote replaces previous vote for the same key.
- Indexer stores raw vote payload and canonical event metadata only.

### Query-time decisive resolution

Validity is derived at query time with tiered hierarchy:

1. `owner` always wins.
2. if no owner vote exists, latest `admin` wins (LWAW).
3. if no owner/admin vote exists, latest `trusted` wins (LWTW).
4. if no decisive vote exists, fallback is baseline `VALID`.

`latest` is determined by canonical order:
`(block_num, trx_index, op_index, transaction_id)`.

### Output

- Query layer derives `final_status` (`VALID` or `REJECTED`) from decisive validity vote.
- Indexer does not persist authoritative `final_status` from role logic.

## B) Ranking channel (`rank_vote`)

`rank_vote` is a separate operation and does not mutate `final_status`.

### Payload contract (logical)

- Namespace: `od.updates.v1`
- Action: `rank_vote`
- Required fields:
  - `v`
  - `action = rank_vote`
  - `update_id`
  - `voter`
  - `rank` (`1..10000`)
  - `transaction_id`
- Optional:
  - `rank_context` (default `default`)

### Storage model

- One active raw rank vote per `(update_id, voter, rank_context)`.
- Revote replaces previous vote for the same key.

### Query-time decisive ranking resolution

Ranking uses the same hierarchy:

1. `owner` always wins.
2. if no owner vote exists, latest `admin` wins (LWAW).
3. if no owner/admin vote exists, latest `trusted` wins (LWTW).

`latest` is determined by canonical order:
`(block_num, trx_index, op_index, transaction_id)`.

### Ranking output

- Decisive rank vote yields `rank_score` (`1..10000`) per update/context.
- `rank_score` is used with other ranking signals.
- Validity remains controlled by validity channel.

### Tie-break when `rank_score` is equal

For updates with equal `rank_score` in same `rank_context`:

1. latest decisive rank vote by canonical order (`block_num DESC`, `trx_index DESC`, `op_index DESC`, `transaction_id DESC`);
2. latest update event by canonical order (`block_num DESC`, `trx_index DESC`, `op_index DESC`, `transaction_id DESC`);
3. `update_id ASC`.

## C) LWW for single-value fields (same creator)

For update types targeting a single-value field:

- Key scope: `(object_id, field_key, creator)`.
- Newer `update_create` from same creator for same field replaces previous current update in that scope.

## Determinism

- Same event stream must produce identical stored raw vote state.
- Same governance context/snapshot must produce identical `final_status` and ranking output.
