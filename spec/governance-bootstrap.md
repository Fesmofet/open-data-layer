# Governance Bootstrap

**Back:** [Spec index](README.md) · **Related:** [governance-resolution](governance-resolution.md), [architecture](architecture.md)

## Status of bootstrap model

- Governance declarations are indexed as regular governance objects/events.
- Governance is selected and applied in the Query/Masking service.

## Initialization principles

### Indexer initialization

- The indexer starts with empty neutral governance state.
- Governance declarations are accepted based on schema/business validity and canonical ordering.
- No global one-time lock (`governance_initialized`) is used.

### Query service initialization

- Query service must have a configured global policy baseline.
- Request governance may be provided per request or via subscription profile mapping.
- If request governance is absent, service uses configured default profile.

### Main governance reference

- Deployment must define a deterministic main governance reference (for example, `main_governance_object_id`).
- `object_type` entities are open: any user may create types or submit updates. Governance admins act as implicit curators at query time (see [object-type-entity.md](object-type-entity.md)).
- All indexer instances in the same environment must use identical main governance reference.

## Governance declaration lifecycle

1. Governance declaration arrives as an object with `object_type = governance` via Hive events.
2. Indexer validates payload and persists object/update event.
3. Governance object updates and governance update votes are allowed only for the governance object `creator`.
4. Query service may reference this governance in later requests.
5. Governance resolution cache updates when referenced declarations change.

## Determinism requirements

- Same indexed event stream must produce same governance declaration set.
- Same governance inputs and same indexed state must produce same effective mask.
- Governance cache invalidation must be deterministic and replay-safe.

## Compatibility note

Implementations that still expose legacy bootstrap controls may keep them as deployment-specific guardrails, but they are non-normative for V2 behavior.
