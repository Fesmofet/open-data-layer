# Object Authority Entity

**Back:** [Spec index](README.md) · **Related:** [vote-semantics](vote-semantics.md), [governance-resolution](governance-resolution.md), [object-type-entity](object-type-entity.md)

## 1. Purpose

`object_authority` is an open registry that records which users have claimed authority roles on specific targets (regular objects or object types). Any user may claim or relinquish authority via Hive events. The indexer stores all valid claims as neutral state without permission checks.

Authority drives the **curator filter** applied during ResolvedView assembly when the authority holder is also a governance admin or trusted member.

## 2. Schema (logical)

- `targetId`: string — the ID of the target (`objectId` for regular objects, `typeId` for object types)
- `targetKind`: `'object'` | `'object_type'` — discriminates between the two target namespaces
- `username`: string — Hive account
- `authorityType`: `'ownership'` | `'administrative'`

Unique key: `(targetId, targetKind, username, authorityType)` — a user may hold multiple roles on the same target.

## 3. Write rules

Written exclusively via Hive events. Any user may submit:

- `action: 'add_object_authority'` — insert `(targetId, targetKind, username, authorityType)` for the signing account (no-op if already exists)
- `action: 'remove_object_authority'` — delete `(targetId, targetKind, username, authorityType)` for the signing account

Authority events do **not** increment `objects_core.seq` or `object_types_core` state. They are written directly to `object_authority` and do not affect content state of the target.

## 4. Effect on ResolvedView: curator filter

Authority with `authorityType = 'ownership'` triggers a curator filter when the holder is also a member of the resolved governance `admins` or `trusted` sets.

### Rule

For a given target and governance snapshot, define the curator set:

```
C = { ownership holders for (targetId, targetKind) } ∩ { governance admins ∪ governance trusted }
```

If `C` is non-empty, only updates satisfying **at least one** of the following are treated as valid for this governance context:

- **A)** The update was **created by** a member of `C`
- **B)** The update has a positive **validity vote from** a member of `C`

Updates that satisfy neither condition are treated as invalid, regardless of other votes or their own validity-vote tally.

If `C` is empty (no overlap), normal vote semantics apply without the curator filter.

### Curator filter applied per target per governance snapshot

The filter is request-scoped. The same target may appear with different validity results under different governance snapshots depending on who holds ownership in each governance context.

## 5. Indexer behavior

The indexer stores all authority events as neutral state. No permission check is performed — any user can claim ownership on any target. The semantic weight of that claim depends entirely on the governance snapshot at query time.

## 6. Payload shape (Hive custom_json)

```json
{ "action": "add_object_authority",    "v": 1, "payload": { "targetId": "product123", "targetKind": "object",      "authorityType": "ownership" } }
{ "action": "add_object_authority",    "v": 1, "payload": { "targetId": "product",    "targetKind": "object_type", "authorityType": "ownership" } }
{ "action": "remove_object_authority", "v": 1, "payload": { "targetId": "product123", "targetKind": "object",      "authorityType": "ownership" } }
```

The `username` is taken from the Hive transaction signing account, not from the payload.
