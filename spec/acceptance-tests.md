# Acceptance test cases

**Back:** [Spec index](README.md) · **Related:** [architecture](architecture.md), [governance-resolution](governance-resolution.md), [overflow-strategy](overflow-strategy.md)

These cases validate core services:

- Indexer Service (deterministic neutral state)
- Query/Masking Service (governance mask behavior per request)
- API Gateway/Rate-Limit Service (token and entitlement enforcement)

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
- **Events**: `update_vote` with `vote = for`, then `vote = against`, then `vote = remove` by same voter.
- **Expect**: Last `remove` clears active raw validity vote for `(U, V)`; if sequence ends on `for/against`, single latest value remains.

### AC-I4: Missing role does not reject raw vote ingestion
- **Setup**: Update U exists, voter currently has no role in governance context.
- **Events**: `update_vote` by voter with valid payload.
- **Expect**: Event is ingested as raw vote state; role impact is resolved later at query time.

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
- **Expect**: Parsed post and linkage are stored; muted filtering is applied in query phase.

### AC-I15: Follow and unfollow produce current edge state
- **Setup**: Account A follows B, then unfollows B.
- **Action**: Index both events in canonical order.
- **Expect**: `social_follows_current` has no active edge A->B after unfollow.

### AC-I16: Mute relation is materialized
- **Setup**: Account A mutes B.
- **Action**: Index mute event.
- **Expect**: `social_mutes_current` contains active mute A->B.

### AC-I16a: Bulk mute operation is materialized
- **Setup**: Governance bulk mute operation contains targets B1..Bn from actor A.
- **Action**: Index bulk mute event.
- **Expect**: `social_mutes_current` contains active mute edges A->B1..A->Bn deterministically.

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

### AC-I20: rank_vote admin LWAW
- **Setup**: Update U has rank values from multiple admins set in sequence.
- **Action**: Compute ranking signal for U.
- **Expect**: decisive ranking signal equals latest admin `rank` value by canonical order.

### AC-I21: rank_vote trusted LWTW when admin absent
- **Setup**: No admin rank vote for update U; trusted users set different rank values in sequence.
- **Action**: Compute ranking signal for U.
- **Expect**: decisive ranking signal equals latest trusted `rank` value by canonical order.

### AC-I23: rank_vote does not change validity status
- **Setup**: Update U has fixed validity outcome from `update_vote`.
- **Action**: Apply several `rank_vote` events.
- **Expect**: U `VALID/REJECTED` status remains unchanged; only ranking signal changes.

### AC-I24: Tie-break when rank_score is equal
- **Setup**: Updates U1 and U2 have identical final `rank_score` in same `rank_context`.
- **Action**: Compute ordered ranking list.
- **Expect**: tie-break uses deterministic order: decisive rank vote canonical order, then update canonical order, then `update_id ASC`.

### AC-I25: rank_vote rejected for single-cardinality target
- **Setup**: Update U targets a field/update type with `single` cardinality.
- **Action**: Submit `rank_vote` for U.
- **Expect**: Rejected with `UNSUPPORTED_RANK_TARGET`.

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

### AC-Q10: Missing decisive role in context for validity resolution
- **Setup**: Query context has no admin/trusted vote applicable for update U.
- **Action**: Resolve validity in query service.
- **Expect**: Query returns fallback validity behavior; if strict mode is enabled, returns `ROLE_REQUIRED`.

### AC-Q11: Missing decisive role in context for rank resolution
- **Setup**: Query context has no admin/trusted rank vote applicable for update U.
- **Action**: Resolve rank in query service.
- **Expect**: Query returns fallback ranking behavior; if strict mode is enabled, returns `ROLE_REQUIRED_FOR_RANK`.

### AC-Q12: Governance references merge deterministically
- **Setup**: Governance G references governance G1 and G2 with overlapping role sets.
- **Action**: Resolve governance snapshot repeatedly.
- **Expect**: Merged role/mute/list output is identical for identical inputs.

### AC-Q13: Trust cutoff preserves historical actions
- **Setup**: Trusted account T has actions before and after configured cutoff block.
- **Action**: Resolve query snapshot with trust cutoff active.
- **Expect**: pre-cutoff actions remain valid; post-cutoff actions are excluded from trusted resolution.

### AC-Q14: Whitelist and blacklist updates are applied by precedence
- **Setup**: Same account appears in both whitelist and blacklist through inherited governance references.
- **Action**: Resolve query snapshot.
- **Expect**: Effective allow/deny result follows deterministic precedence rules and is stable across re-runs.

### AC-Q15: Plan-based governance entitlement enforcement
- **Setup**: Free-tier token without custom governance entitlement.
- **Action**: Request query with custom governance override.
- **Expect**: Gateway/query denies or downgrades request per plan policy.

### AC-Q16: Gateway token validation and usage metering
- **Setup**: Valid active token mapped to paid plan.
- **Action**: Send authorized query through gateway.
- **Expect**: Request is forwarded to query service and usage counters are incremented for billing analytics.

---

## C) Overflow behavior (publishing path)

### AC-OF1: Large import triggers overflow path
- **Setup**: Import size exceeds configured Hive-only threshold.
- **Action**: Run publisher.
- **Expect**: Overflow strategy selects IPFS path per policy.

### AC-OF2: Queue backlog triggers overflow drain
- **Setup**: Queue depth and age exceed overflow thresholds.
- **Action**: Run publisher scheduling cycle.
- **Expect**: Backlog batch is offloaded to IPFS according to policy limits.

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
