# Governance Resolution

**Back:** [Spec index](README.md) · **Related:** [architecture](architecture.md), [governance-bootstrap](governance-bootstrap.md), [vote-semantics](vote-semantics.md)

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
  - trust cutoff reference (block height/time) where applicable.

## 3) Role domains

Data domain:

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
- Governance may include references to other governance objects; referenced role lists are merged by deterministic precedence.

## 6) Effective mask output

The resolved mask output must include:

- allowed/denied account sets by domain,
- role map for voting and moderation interpretation,
- metadata (source governance refs, resolved depth, version/hash).

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
- trust cutoff change,
- whitelist/blacklist change,
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

## 10) Optional trust signals (non-authoritative)

The following signals may be stored and used as auxiliary ranking/freshness factors, but must not replace authoritative governance rules:

- profile->website linkage with reciprocal `llm.txt` account proof,
- subscription/payment signal,
- account heartbeat/activity recency.

These signals are advisory and should be clearly separated from decisive governance role resolution.
