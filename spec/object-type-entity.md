# Object Type Entity

**Back:** [Spec index](README.md) · **Related:** [object-uniqueness](object-uniqueness.md), [vote-semantics](vote-semantics.md), [reject-codes](reject-codes.md)

## 1) Purpose

`object_type` is a governance-controlled registry entity that defines what update kinds are valid for objects of a given type.

Examples of `name`:

- `product`
- `recipe`

## 2) Schema (logical)

- `name`: string, unique type name.
- `supported_updates`: list of update type identifiers allowed for this object type.
- `supposed_updates`: list of update type identifiers intended for future automation.

## 3) Ownership and write rules

- `object_type` entities are created and updated only through Hive events.
- Only main governance creator may create/update `object_type` entities.
- Unauthorized operations must be rejected with `UNAUTHORIZED_OBJECT_TYPE_OP`.

## 4) Indexer validation behavior

For every `update_create`:

1. Resolve target object's `object_type`.
2. Resolve matching `object_type` entity by `name`.
3. Verify `update_type` is listed in `supported_updates`.
4. If not listed, reject with `UNSUPPORTED_UPDATE_TYPE`.

## 5) supposed_updates semantics

- `supposed_updates` is metadata for automation planning.
- It does not directly change indexer accept/reject behavior.
- Automation execution mechanism is explicitly out of scope in current V2 spec.
