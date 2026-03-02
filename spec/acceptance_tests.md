# Acceptance test cases (V2)

These cases validate both services:

- Indexer Service (deterministic neutral state)
- Query/Masking Service (governance mask behavior per request)

Canonical event order is:
`(block_num, trx_index, op_index, transaction_id)`.

---

## A) Indexer Service: object and update semantics

### AC-I1: First object_create wins
- **Setup**: Empty state.
- **Events**: Two `object_create` with same `object_id`, A first then B.
- **Expect**: A is stored; B rejected with `OBJECT_ALREADY_EXISTS`.

### AC-I2: object_create retry remains rejected
- **Setup**: Object already exists.
- **Events**: Repeat `object_create` for same `object_id`.
- **Expect**: Rejected with `OBJECT_ALREADY_EXISTS`; no state mutation.

### AC-I3: Revote replaces previous vote
- **Setup**: Update U exists, voter V has valid role.
- **Events**: `update_vote` +1, then `update_vote` -1 by same voter.
- **Expect**: Single active vote for `(U, V)`; weight adjusted by delta only.

### AC-I4: Missing role rejects vote
- **Setup**: Update U exists, voter has no role.
- **Events**: `update_vote` by voter.
- **Expect**: Rejected with `ROLE_REQUIRED`.

### AC-I5: Full reindex determinism
- **Setup**: Mixed stream with duplicates and revotes.
- **Action**: Reindex same stream twice from empty state.
- **Expect**: Same neutral state and same reject log hash.

### AC-I6: Governance object is creator-owned for updates
- **Setup**: Governance object G created by account A (`object_type = governance`).
- **Events**: `update_create` targeting G from account B.
- **Expect**: Rejected with `UNAUTHORIZED_GOVERNANCE_OP`.

### AC-I7: Governance update vote is creator-owned
- **Setup**: Governance object G created by A; governance update U exists on G.
- **Events**: `update_vote` on U from B.
- **Expect**: Rejected with `UNAUTHORIZED_GOVERNANCE_OP`.

### AC-I8: LWW for single field from same creator
- **Setup**: Object O exists; field `name` is single-value semantics.
- **Events**: Creator A publishes update U1 for `name`, then newer update U2 for `name`.
- **Expect**: Current state keeps only U2 as A's active contribution for `name`; U1 is removed from current base view for that key scope.

### AC-I9: Only main governance can create object_type
- **Setup**: Main governance creator is A.
- **Events**: Account B attempts to create object_type `product`.
- **Expect**: Rejected with `UNAUTHORIZED_OBJECT_TYPE_OP`.

### AC-I10: Main governance creates valid object_type
- **Setup**: Main governance creator is A.
- **Events**: A creates object_type `product` with `supported_updates` and `supposed_updates`.
- **Expect**: object_type entity is stored and available for subsequent update validation.

### AC-I11: Unsupported update type is rejected by indexer
- **Setup**: Object O has object_type `product`; `supported_updates = [price_update]`.
- **Events**: `update_create` for O with `update_type = nutrition_update`.
- **Expect**: Rejected with `UNSUPPORTED_UPDATE_TYPE`.

### AC-I12: supposed_updates are metadata only
- **Setup**: object_type `product` has `supposed_updates = [auto_price_sync]`, but no automation engine configured.
- **Action**: Index and query normal object/update flow.
- **Expect**: Indexer behavior is unchanged by `supposed_updates`; values are stored/exposed as metadata only.

### AC-I13: Hive post parsing extracts object links
- **Setup**: Hive post body/metadata contains reference to object `obj-1` of type `product`.
- **Action**: Index post event.
- **Expect**: Parsed posts dataset stores linkage to `obj-1` and `product`.

### AC-I14: Muted post author is not persisted in posts dataset
- **Setup**: Post author P is in muted list of effective owner/moderator set at post block time.
- **Action**: Index post event from P.
- **Expect**: Post is skipped from queryable posts dataset.

### AC-I15: Follow and unfollow produce current edge state
- **Setup**: Account A follows B, then unfollows B.
- **Action**: Index both events in canonical order.
- **Expect**: `social_follows_current` has no active edge A->B after unfollow.

### AC-I16: Mute relation is materialized
- **Setup**: Account A mutes B.
- **Action**: Index mute event.
- **Expect**: `social_mutes_current` contains active mute A->B.

### AC-I17: Reblog relation is persisted
- **Setup**: Account A reblogs post P.
- **Action**: Index reblog event.
- **Expect**: `social_reblogs_log` contains deterministic relation A->P with event metadata.

### AC-I18: create_account populates initial account projection
- **Setup**: New account A appears via `create_account`.
- **Action**: Index event.
- **Expect**: `accounts_current` contains A with available profile projection fields.

### AC-I19: update_account v1/v2 updates unified projection
- **Setup**: Account A exists; two update events arrive (v1 then v2).
- **Action**: Index both in canonical order.
- **Expect**: single normalized `accounts_current` record reflects latest deterministic values for `name`, `alias`, `json_metadata`, `profile_image`.

---

## B) Query/Masking Service: governance behavior

### AC-Q1: Same indexed state, different governance, different output
- **Setup**: Indexed neutral state contains entries from multiple creators.
- **Action**: Query once with governance G1, once with governance G2.
- **Expect**: Responses differ according to mask policies; indexed state unchanged.

### AC-Q2: Same indexed state, same governance, identical output
- **Setup**: Fixed neutral state and governance input.
- **Action**: Repeat identical query multiple times.
- **Expect**: Same response payload/order each run.

### AC-Q3: Global policy precedence
- **Setup**: Global policy blocks creator C; request governance would allow C.
- **Action**: Query with that request governance.
- **Expect**: C remains filtered; no bypass of global policy.

### AC-Q4: Governance reference missing
- **Setup**: Request references unknown governance id/profile.
- **Action**: Query.
- **Expect**: Error code `GOVERNANCE_NOT_FOUND`.

### AC-Q5: Governance resolution cycle/depth protection
- **Setup**: Governance graph contains cycle or exceeds configured trust depth.
- **Action**: Query.
- **Expect**: Error code `GOVERNANCE_RESOLUTION_FAILED`.

### AC-Q6: Cache invalidation on governance update
- **Setup**: Query result cached for governance G.
- **Action**: Apply governance event that changes role/trust in G, then query again.
- **Expect**: Cache invalidated; new response reflects updated governance.

### AC-Q7: Same text+geo query, different governance, different winners
- **Setup**: Two valid candidate updates match same text+geo query; G1 allows creator A, G2 denies A.
- **Action**: Execute identical query with G1 then G2.
- **Expect**: Winner set differs between responses.

### AC-Q8: Same governance hash gives identical result
- **Setup**: Fixed neutral state and fixed `resolved_governance_snapshot.snapshot_hash`.
- **Action**: Execute identical text+geo query repeatedly.
- **Expect**: Identical winner set, order, and pagination boundary each run.

### AC-Q9: Governance cache invalidation after governance object update
- **Setup**: Cached snapshot exists for governance object G (`snapshot_hash = H1`).
- **Action**: Apply update to governance object G, then execute same query.
- **Expect**: Previous snapshot invalidated, new snapshot hash `H2 != H1`, response reflects new governance rules.

---

## C) Overflow behavior (publishing path)

### AC-OF1: Large import triggers overflow path
- **Setup**: Import size exceeds configured Hive-only threshold.
- **Action**: Run publisher.
- **Expect**: Overflow strategy selects Arweave path per policy.

### AC-OF2: Queue backlog triggers overflow drain
- **Setup**: Queue depth and age exceed overflow thresholds.
- **Action**: Run publisher scheduling cycle.
- **Expect**: Backlog batch is offloaded to Arweave according to policy limits.

### AC-OF3: Accepted vs finalized tracking
- **Setup**: Transaction accepted but not yet finalized.
- **Action**: Poll status until TTL/confirmation boundary.
- **Expect**: State transitions are deterministic (`accepted` -> `confirmed` or retry/fail branch).

---

## D) Non-functional requirements

### Benchmark protocol (minimum, mandatory)
- **Warmup**: 10 minutes before metric collection.
- **Measured duration**: 30 minutes continuous load after warmup.
- **Sampling window**: rolling 60-second windows; report aggregate P50/P95/P99 for full measured duration.
- **Candidate set size (two-phase query)**: fixed `candidate_set_size = 1000` for benchmark runs unless test case explicitly overrides it.
- **Governance snapshot mode**: warmed cache and fixed `resolved_governance_snapshot.snapshot_hash` during latency benchmark.
- **Dataset profile**: production-like distribution of object types, updates, geo points, and text tokens.

### AC-NF1: Query latency P95 under target profile
- **Setup**: Production-like dataset and governance cache warm-up complete.
- **Action**: Run representative two-phase query benchmark (text+geo+governance) for fixed duration.
- **Expect**: Query latency `P95 < 200ms`.

### AC-NF2: Indexer object creation capacity
- **Setup**: Continuous ingest benchmark with canonical ordering enabled.
- **Action**: Feed object create workload for 24h equivalent run.
- **Expect**: Sustained throughput supports at least `10,000,000` object creates/day.

### AC-NF3: Indexer update creation capacity
- **Setup**: Continuous ingest benchmark with mixed update payloads and validation enabled.
- **Action**: Feed update create workload for 24h equivalent run.
- **Expect**: Sustained throughput supports at least `350,000,000` update creates/day.
