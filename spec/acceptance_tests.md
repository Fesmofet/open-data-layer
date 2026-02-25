# Acceptance test cases

These cases MUST pass for the indexer to be considered correct. Events are applied in canonical order `(block_num, trx_index, op_index, transaction_id)`.

---

## Object uniqueness

### AC-O1: First object_create wins
- **Setup**: Empty state.
- **Events**: Two `object_create` with same `object_id`, different creators; first in canonical order from creator A, second from B.
- **Expect**: One object created (creator A); second event rejected with `OBJECT_ALREADY_EXISTS`.

### AC-O2: Same object_id in same block (tie-break by trx_index)
- **Setup**: Empty state.
- **Events**: Two `object_create` in same block, same `object_id`; trx_index 0 from A, trx_index 1 from B.
- **Expect**: Object created by A; event from B rejected with `OBJECT_ALREADY_EXISTS`.

### AC-O3: Retry same creator
- **Setup**: Object `obj1` already exists (creator A).
- **Events**: New `object_create` for `obj1` from A (retry).
- **Expect**: Rejected with `OBJECT_ALREADY_EXISTS`; state unchanged.

### AC-O4: Reindex determinism (object)
- **Setup**: Apply stream S that contains two `object_create` for same `object_id` (A first, B second). Record final state hash (e.g. hash of objects_current).
- **Action**: Re-index same stream S from scratch.
- **Expect**: Same state hash; same single object; same reject for second event.

### AC-O5: object_create rejected when creator muted by governance participant
- **Setup**: Governance initialized; committee member or governance-role holder P has creator C in P's Hive muted list at event block time.
- **Events**: `object_create` with `creator` = C, valid payload, unique `object_id`.
- **Expect**: Rejected with `CREATOR_MUTED_BY_GOVERNANCE`; no object created.

### AC-O6: object_create accepted when creator not muted
- **Setup**: Governance initialized; creator C is not muted by any governance participant at event block time.
- **Events**: `object_create` from C, valid payload, unique `object_id`.
- **Expect**: Object created; no muted reject.

---

## Muted list (update_create)

### AC-M1: update_create rejected when creator muted by governance participant
- **Setup**: Object O exists; governance participant P has creator C in P's muted list at event block time.
- **Events**: `update_create` with `creator` = C, valid payload, `object_id` = O.
- **Expect**: Rejected with `CREATOR_MUTED_BY_GOVERNANCE`; no update created.

### AC-M2: Reindex determinism with muted snapshot at event_time
- **Setup**: At block T1, creator C is muted by participant P; at block T2, C is unmuted. Stream S has `object_create` from C at T1 and same `object_id` from C at T2.
- **Action**: Index S; then re-index S from scratch with same muted-state snapshots per block.
- **Expect**: First event rejected with `CREATOR_MUTED_BY_GOVERNANCE`; second event creates object. Reindex yields identical result.

---

## Revote = replace

### AC-V1: First vote applies
- **Setup**: One `update_create` for update U (weight 0, VALID). Voter V has role weight 1.
- **Events**: `update_vote` U, voter V, vote +1.
- **Expect**: U.weight = 1, U.status = VALID; one current vote (U, V).

### AC-V2: Revote replaces
- **Setup**: U has weight 1; current vote (U, V) = +1 (effective +1).
- **Events**: `update_vote` U, voter V, vote -1.
- **Expect**: old effective +1 removed, new effective -1 added; U.weight = 0; U.status = VALID; current vote (U, V) = -1.

### AC-V3: Revote same sign (no-op delta)
- **Setup**: U has weight 1; (U, V) = +1.
- **Events**: `update_vote` U, voter V, vote +1 again.
- **Expect**: U.weight = 1 (delta 0); status VALID; current vote still +1.

### AC-V4: No role → reject
- **Setup**: U exists; voter V has no role.
- **Events**: `update_vote` U, voter V, vote +1.
- **Expect**: Rejected with `ROLE_REQUIRED`; U.weight unchanged; no vote stored for (U, V).

---

## Dynamic validity

### AC-D1: Weight crosses zero downward
- **Setup**: U has weight 1, status VALID; (U, V1)=+1.
- **Events**: `update_vote` U, voter V2 (weight 2), vote -1 → effective -2.
- **Expect**: U.weight = -1; U.status = REJECTED.

### AC-D2: Weight crosses zero upward
- **Setup**: U has weight -1, status REJECTED (e.g. one -1 vote).
- **Events**: `update_vote` U, voter V2, vote +1 (effective +2).
- **Expect**: U.weight = 1; U.status = VALID.

---

## Reindex determinism (global)

### AC-R1: Full reindex idempotence
- **Setup**: Stream S with mix of object_create, update_create, update_vote; some duplicates and revotes.
- **Action**: Index S once → state A. Reset state, index S again → state B.
- **Expect**: A and B identical (same objects_current, updates_current, update_votes_current, governance_state; same reject log).

### AC-R2: Order sensitivity
- **Setup**: Two blocks: block 1 has object_create for `oid` by A; block 2 has object_create for `oid` by B.
- **Expect**: Object created by A. Swap block order in test (B first, A second): object created by B. Proves canonical order is applied.

---

## Governance bootstrap

### AC-G1: First valid create_committee applies
- **Setup**: governance_initialized = false; bootstrap_allowlist = [F1].
- **Events**: create_committee from F1, valid payload.
- **Expect**: governance_initialized = true; genesis_tx_id set; committee stored.

### AC-G2: Second create_committee rejected
- **Setup**: governance_initialized = true (genesis already applied).
- **Events**: create_committee from F1 or any account.
- **Expect**: Rejected with `DUPLICATE_GENESIS`; state unchanged.

### AC-G3: create_committee from non-allowlist rejected
- **Setup**: governance_initialized = false; bootstrap_allowlist = [F1].
- **Events**: create_committee from account X (not in list).
- **Expect**: Rejected with `UNAUTHORIZED_GOVERNANCE_OP`; governance_initialized remains false.
