# Object Type Entity

**Back:** [Spec index](README.md) · **Related:** [authority-entity](authority-entity.md), [vote-semantics](vote-semantics.md), [governance-resolution](governance-resolution.md)

## 1. Purpose

`object_type` defines what update kinds are supported (and planned) for objects of a given type — for example `product`, `recipe`, `place`.

It is modelled as a parallel object system: any user may create a type or submit updates to it. The core governance admins act as implicit curators for the `object_types` collections, meaning their votes and authorship determine which update entries are treated as valid at query time.

## 2. Collections

`object_type` lives in its own pair of collections, separate from the main object graph.

| Collection | Role |
|------------|------|
| **object_types_core** | One document per type. Holds `typeId` (unique) and `creator`. No embedded arrays. |
| **object_type_updates** | One document per update entry. References `typeId`. Both update types are multi-cardinality. |

Validity votes and rank votes on object_type updates reuse the shared `validity_votes` and `rank_votes` collections — `updateId` is globally unique across both systems.

## 3. Schema (logical)

### object_types_core

- `typeId`: string, globally unique (e.g. `product`, `recipe`).
- `creator`: string, Hive account that submitted `object_type_create`.

### object_type_updates

- `updateId`: string, globally unique.
- `typeId`: string — FK to `object_types_core`.
- `updateType`: `'supported_updates'` | `'supposed_updates'`
- `value`: string — the update type identifier being registered (e.g. `name`, `price`, `location`).
- `cardinality`: always `'multi'` — entries accumulate; none replace another.

## 4. Write operations (Hive events)

Any user may submit either operation. No permission check at indexer level.

### `object_type_create`

Creates a new type if `typeId` does not already exist (first-write-wins). Ignored if `typeId` already exists.

```json
{ "action": "object_type_create", "v": 1, "payload": { "typeId": "product" } }
```

### `object_type_update`

Appends one entry to `object_type_updates` for the given `typeId` and `updateType`.

```json
{ "action": "object_type_update", "v": 1, "payload": { "typeId": "product", "updateType": "supported_updates", "value": "price" } }
```

`creator` / `voter` is taken from the Hive transaction signing account.

## 5. Curator filter for object_types

Governance admins must explicitly claim ownership on the specific object_types they want to curate, using the same `add_object_authority` event described in [authority-entity.md](authority-entity.md):

```json
{ "action": "add_object_authority", "v": 1, "payload": { "targetId": "product", "targetKind": "object_type", "authorityType": "ownership" } }
```

The curator set for a given `typeId` is then computed identically to the main object system:

```
C = { ownership holders in object_authority for typeId } ∩ { governance admins ∪ governance trusted }
```

If `C` is non-empty, the curator filter applies: an update entry in `object_type_updates` is valid only if:

- **A)** It was **created by** a member of `C`, or
- **B)** It has a positive **validity vote** from a member of `C`.

If `C` is empty (no governance admin has claimed ownership on this type), normal vote semantics apply — any user's votes count.

Entries stored by neutral indexer state remain in `object_type_updates` regardless; only the resolved view is affected.

## 6. supposed_updates semantics

- `supposed_updates` entries represent update types intended for future automation.
- They do not affect current indexer accept/reject behavior.
- Subject to the same curator filter as `supported_updates`.
- Automation execution is out of scope in the current V2 spec.

## 7. Index recommendations

| Collection | Index | Purpose |
|------------|-------|---------|
| **object_types_core** | `{ typeId: 1 }` (unique) | Primary lookup. |
| **object_types_core** | `{ creator: 1 }` | Filter by creator. |
| **object_type_updates** | `{ updateId: 1 }` (unique) | Lookup by update. |
| **object_type_updates** | `{ typeId: 1, updateType: 1 }` | Load all entries for a type; filter by kind. |
