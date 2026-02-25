# Reject codes

All event processing rejections use these canonical codes. Indexer MUST persist reject code when an event is not applied.

## Objects namespace (od.objects.v1)

| Code | When |
|------|------|
| `OBJECT_ALREADY_EXISTS` | An object with this `object_id` already exists in materialized state. |
| `CREATOR_MUTED_BY_GOVERNANCE` | `creator` is in the muted list of at least one governance participant at event time. |
| `INVALID_OBJECT_PAYLOAD` | Payload failed JSON schema or business validation (e.g. missing required field, invalid format). |

## Governance namespace (od.governance.v1)

| Code | When |
|------|------|
| `DUPLICATE_GENESIS` | A valid `create_committee` was already applied; no further create_committee allowed. |
| `UNAUTHORIZED_GOVERNANCE_OP` | Creator not in bootstrap_allowlist (for create_committee) or insufficient authority for grant/revoke. |
| `INVALID_GOVERNANCE_PAYLOAD` | Payload failed schema or validation. |

## Updates namespace (od.updates.v1)

| Code | When |
|------|------|
| `UPDATE_NOT_FOUND` | Referenced `update_id` does not exist. |
| `OBJECT_NOT_FOUND` | Referenced `object_id` does not exist (e.g. for update_create). |
| `CREATOR_MUTED_BY_GOVERNANCE` | For `update_create`: `creator` is in the muted list of at least one governance participant at event time. |
| `ROLE_REQUIRED` | Voter has no valid role at vote event block time. |
| `INVALID_UPDATE_PAYLOAD` | Payload failed schema or validation. |

## Generic

| Code | When |
|------|------|
| `UNKNOWN_ACTION` | Action string not recognized for the namespace. |
| `INVALID_PAYLOAD` | Malformed JSON or unknown namespace. |
