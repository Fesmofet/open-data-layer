# Governance Resolution (V2)

## 1) Purpose

Define how Query/Masking Service computes an effective governance mask from governance declarations indexed on-chain.

## 2) Inputs

- Neutral indexed governance declarations (`object_type = governance`).
- Global/platform governance profile.
- Request governance reference (or subscription default profile).
- Resolution parameters:
  - max trust depth,
  - max visited nodes,
  - timeout budget.

## 3) Role domains

Data domain:

- `owner`
- `admin`
- `trusted`

Social domain:

- `moderator`

Role effects must be domain-scoped and cannot silently leak across domains.

## 4) Precedence model

Resolution order:

1. Global policy resolution.
2. Request governance resolution.
3. Merge with precedence:
   - global denies/restrictions always win,
   - request governance can add stricter filtering.

## 5) Trust traversal

- Graph traversal must be deterministic (stable node ordering).
- Traversal stops at configured depth and node limit.
- Cycle detection is mandatory.
- On cycle/limit violation, return `GOVERNANCE_RESOLUTION_FAILED`.

## 6) Effective mask output

The resolved mask output must include:

- allowed/denied account sets by domain,
- role map for voting and moderation interpretation,
- metadata (source governance refs, resolved depth, version/hash).

### resolved_governance_snapshot (normative format)

Snapshot object:

- `snapshot_hash`: deterministic hash of full resolved snapshot content.
- `governance_ref`: request governance reference used for resolution.
- `global_policy_version`: applied global policy version.
- `resolution_algo_version`: governance resolution algorithm version.
- `resolved_at_block`: block height (or index checkpoint) used for consistency.
- `ttl_seconds`: snapshot TTL.
- `expires_at_unix`: absolute expiry timestamp.
- `allow_sets`:
  - `data_domain_accounts`
  - `social_domain_accounts`
- `deny_sets`:
  - `global_denies`
  - `request_denies`
- `role_map`: effective account-to-role mapping by domain.
- `moderation_sets`:
  - `owner_accounts`
  - `moderator_accounts`
  - `muted_subject_accounts`

## 7) Caching and invalidation

### Cache key

At minimum:

- governance reference(s),
- global policy version,
- resolution algorithm version.
- index checkpoint / resolved_at_block.

### Invalidation triggers

- governance declaration update,
- role assignment change,
- trust edge change,
- global policy update,
- algorithm version change.
- TTL expiry (`now >= expires_at_unix`).
- index checkpoint change when strict consistency mode is enabled.

## 8) Governance ownership constraint

- Governance object updates and governance update votes are valid only when authored by the governance object `creator`.
- Any non-creator governance mutation attempt must fail with `UNAUTHORIZED_GOVERNANCE_OP`.

## 9) Determinism and observability

- Same inputs must produce same mask hash.
- Resolution logs should include:
  - cache hit/miss,
  - nodes traversed,
  - depth reached,
  - elapsed time.
