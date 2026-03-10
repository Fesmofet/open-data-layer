# Governance Resolution

**Back:** [Spec index](README.md) · **Related:** [architecture](architecture.md), [governance-bootstrap](governance-bootstrap.md), [vote-semantics](vote-semantics.md), [authority-entity](authority-entity.md), [social-account-ingestion](social-account-ingestion.md)

## 1) Purpose

Define how Query/Masking Service constructs an effective governance snapshot from a governance object indexed on-chain.

A governance object is a regular object in `objects_core` with `objectType = 'governance'`. Its updates follow the same multi-cardinality write and vote semantics as all other objects.

## 2) Governance update types

All update types are **multi-cardinality** (accumulate, never replace). No length restriction on value lists.

| `updateType`      | Value format                              | Meaning |
|-------------------|-------------------------------------------|---------|
| `admin`           | text — Hive account name                 | Account granted admin role in this governance context |
| `trusted`         | text — Hive account name                 | Account granted trusted role in this governance context |
| `validityCutoff`  | JSON — `{ account: string, timestamp: number }` | Actions by this account after `timestamp` (unix) are treated as untrusted; historical valid work remains |
| `blacklist`       | text — Hive account name                 | Account flagged for reward eligibility (informational only, not enforced in V2) |
| `whitelist`       | text — Hive account name                 | Account protected from appearing in the resolved `muted` set regardless of who muted them |
| `inheritsFrom`    | text — `objectId` of another governance object | Merge `admin` and `trusted` lists from the referenced governance object into this one (one level only) |
| `authority`       | text — Hive account name                 | When present, restricts object search scope to objects where at least one `authority` account holds an `object_authority` record (see [authority-entity.md](authority-entity.md)) |

## 3) Write rules

- Only the governance object `creator` may submit updates (`update_create`) to a governance object.
- At the indexer level, all events are stored as neutral state.
- At query layer, updates whose `update.creator` ≠ governance object `creator` are excluded before resolution.
- Only the creator's own validity votes (`for` / `against`) are considered when resolving governance update entries. Admin, trusted, and curator filter mechanics do not apply to governance objects.

## 4) Snapshot construction

The resolved governance snapshot is computed at request time in five steps.

### Step 1: Resolve own update lists

For each update type, include only entries where `update.creator == governance.creator`. An entry is valid if the creator voted `for` it (or no vote exists, defaulting to valid); it is excluded if the creator voted `against` it.

- `admin` → resolved set of account strings
- `trusted` → resolved set of account strings
- `validityCutoff` → resolved list of `{ account: string, timestamp: number }`
- `blacklist` → resolved set of account strings
- `whitelist` → resolved set of account strings
- `inheritsFrom` → resolved set of governance `objectId` strings
- `authority` → resolved set of account strings

### Step 2: Resolve inherited admin and trusted

For each `objectId` in `inheritsFrom`:

- Load the referenced governance object from `objects_core` (must have `objectType = 'governance'`).
- Resolve **only** its `admin` and `trusted` update lists: include entries where `update.creator == that object's creator`, valid if the creator voted `for` (or no vote, defaulting to valid).
- **Do not** follow `inheritsFrom` entries of the referenced object — one level only.

### Step 3: Merge admin and trusted sets

```
admins  = own admins  ∪ inherited admins  (union, deduplicated)
trusted = own trusted ∪ inherited trusted (union, deduplicated)
```

`validityCutoff`, `blacklist`, `whitelist`, and `muted` are **not** inherited — they come from the root governance object only.

### Step 4: Aggregate muted accounts

For every account in `admins ∪ trusted` (merged set from step 3):

- Load their active mutes from `social_mutes_current` (`WHERE muter = account`).
- Union all results into a single `muted` set.

### Step 5: Apply whitelist filter

Remove every account that appears in `whitelist` from the aggregated `muted` set.

Whitelisted accounts are never present in the resolved `muted` set, regardless of who muted them.

### Output snapshot

```typescript
{
  admins:          string[];
  trusted:         string[];
  validityCutoff:  { account: string; timestamp: number }[];
  blacklist:       string[];
  whitelist:       string[];
  inheritsFrom:    string[];
  authority:       string[];
  muted:           string[];
}
```

## 5) validityCutoff semantics

`validityCutoff` entries describe accounts whose **new** actions became untrusted after a given point in time.

- Actions by `account` with `block_time < timestamp` remain valid under normal vote semantics.
- Actions by `account` with `block_time >= timestamp` are excluded from trusted resolution (treated as if the account is not in the `trusted` set for those actions).
- Historical valid work (votes, updates) created before the cutoff is not retroactively invalidated.

Use case: a trusted account was compromised at a known date. The cutoff preserves the historical contribution while discarding post-compromise actions.

## 6) authority filter semantics

When the resolved `authority` set is non-empty, it acts as a **search scope restriction** applied before any other query filters.

Query execution with a non-empty `authority`:

1. Look up `object_authority` for all entries where `username ∈ authority` (any `authorityType`, any `targetKind = 'object'`).
2. Collect the resulting set of `targetId` values — these are the **eligible object IDs**.
3. Restrict the object search to only those eligible IDs. Objects not present in the eligible set are excluded from results entirely, regardless of other filters.

When `authority` is empty, no scope restriction is applied — all objects are candidates.

Use case: a governance context scoped to a specific curator's catalogue — only objects that curator has explicitly claimed authority over are visible in search results for that governance.

## 8) Role domains

Data domain:

- `admin`
- `trusted`

Social domain:

- `moderator`

Role effects are domain-scoped and must not leak across domains.

## 9) Caching and invalidation

### Cache key

At minimum:

- governance object `objectId`,
- `objects_core.seq` of the governance object at resolution time,
- index checkpoint / `resolved_at_block`.

### Invalidation triggers

- Any update to the governance object (`objects_core.seq` increases),
- Any validity vote change on a governance update,
- Any update to a governance object referenced in `inheritsFrom` (`objects_core.seq` of the inherited object increases),
- Mute graph change for any account in `admins ∪ trusted` (including inherited),
- TTL expiry.

## 10) Governance ownership constraint

- Governance object updates are valid only when authored by the governance object `creator`.
- Any non-creator update attempt must fail with `UNAUTHORIZED_GOVERNANCE_OP` at the indexer level (or be filtered at query layer).

## 11) Determinism and observability

- Same indexed state and same governance `objectId` must produce the same snapshot hash.
- Resolution logs should include: cache hit/miss, resolved_at_block, elapsed time.

## 12) Optional trust signals (non-authoritative)

The following signals may inform auxiliary ranking or freshness scoring but must not replace authoritative governance rules:

- profile → website linkage with reciprocal `llm.txt` account proof,
- subscription/payment signal,
- account heartbeat/activity recency.

These signals are advisory and must be clearly separated from decisive role resolution.
