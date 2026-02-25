# Vote semantics: revote = replace, dynamic validity

**Note:** The muted-list gating rule (creator must not be muted by any governance participant at event time) applies only to **create** operations (`object_create`, `update_create`). It does **not** apply to `update_vote`.

## One active vote per (update_id, voter)

- Uniqueness key: `(update_id, voter)`.
- At any time, at most **one** vote from `voter` counts toward `weight` for `update_id`.
- Stored as current vote row: `(update_id, voter) -> effective_vote, raw_vote, block_time`.

## Revote = replace

When a new `update_vote` event is processed for the same `(update_id, voter)`:

1. Load current vote for `(update_id, voter)` if any; let `old_effective_vote` be its effective value, or 0 if none.
2. Compute `new_effective_vote = sign(vote) * role_weight(voter_role_at_vote_block_time)`. If voter has no role, reject with `ROLE_REQUIRED` and do not change state.
3. Delta: `delta = new_effective_vote - old_effective_vote`.
4. Update: `weight(update_id) += delta`.
5. Persist current vote for `(update_id, voter)` as the new vote (replace previous).
6. Recompute status (see below).

No separate "remove vote" action required: a revote with opposite sign (or zero weight) effectively replaces the previous contribution.

## Dynamic validity

After every applied change that affects an update's weight (create or vote/revote):

- If `weight(update_id) >= 0` then `status(update_id) = VALID`.
- If `weight(update_id) < 0` then `status(update_id) = REJECTED`.

Status can change multiple times over time (VALID → REJECTED → VALID etc.) as votes are added or replaced. No finalization window: validity is always current.

## Effective vote formula

- `effective_vote = sign(vote) * role_weight(role)`.
- `vote` is the raw vote from payload (+1 or -1, or extended per schema).
- `role` is the voter's role at **vote event block time** (not "now").
- `role_weight(role)` is from the role matrix (e.g. reviewer=1, trusted=2). If no role, the vote is not applied and event is rejected with `ROLE_REQUIRED`.

## Initial state for update_create

- On `update_create`: `weight = 0`, `status = VALID` (since 0 >= 0).

## Determinism

- Same event stream must produce same `weight` and `status` after each event.
- Role is resolved at `vote_block_time` so reindex gives same result.
