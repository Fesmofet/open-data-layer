# Canonical Error Codes (V2)

V2 separates write-path processing errors from query/masking errors.

## 1) Indexer write-path reject codes

Indexer MUST persist reject code whenever an event is not applied to neutral state.

### Objects namespace (`od.objects.v1`)

| Code | When |
|------|------|
| `OBJECT_ALREADY_EXISTS` | An object with this `object_id` already exists in neutral/materialized state. |
| `INVALID_OBJECT_PAYLOAD` | Payload failed schema or business validation. |

### Governance object operations (`object_type = governance`)

| Code | When |
|------|------|
| `INVALID_GOVERNANCE_PAYLOAD` | Governance object payload or governance update payload failed schema/business validation. |
| `UNAUTHORIZED_GOVERNANCE_OP` | Governance object update/vote is authored by an account other than governance object creator, or otherwise violates governance ownership rules. |

### Object type entity operations (`object_type` registry)

| Code | When |
|------|------|
| `INVALID_OBJECT_TYPE_PAYLOAD` | `object_type` entity payload failed schema/business validation (for example missing `name` or invalid update lists). |
| `UNAUTHORIZED_OBJECT_TYPE_OP` | `object_type` create/update is attempted by account other than main governance creator. |
| `UNSUPPORTED_UPDATE_TYPE` | `update_create.update_type` is not listed in target object's `object_type.supported_updates`. |

### Updates namespace (`od.updates.v1`)

| Code | When |
|------|------|
| `OBJECT_NOT_FOUND` | Referenced `object_id` does not exist (for `update_create`). |
| `UPDATE_NOT_FOUND` | Referenced `update_id` does not exist (for `update_vote`). |
| `INVALID_UPDATE_PAYLOAD` | Update payload failed schema or business validation. |
| `INVALID_RANK_PAYLOAD` | `rank_vote` payload failed schema or business validation. |
| `UNSUPPORTED_RANK_TARGET` | `rank_vote` is applied to an update whose target update type has `single` cardinality. |

### Hive social/account ingestion

| Code | When |
|------|------|
| `INVALID_SOCIAL_PAYLOAD` | `mute`, `follow/unfollow`, or `reblog` payload is malformed or misses required fields. |
| `INVALID_BULK_MUTE_PAYLOAD` | Bulk mute payload is malformed or contains invalid target account set. |
| `INVALID_ACCOUNT_PAYLOAD` | `create_account` or `update_account` (v1/v2) payload cannot be parsed into normalized account projection. |
| `POST_AUTHOR_MUTED_BY_GOVERNANCE` | Query-time governance filtering reason: post author is muted by effective owner/moderator set in current governance context. |

### Generic write-path codes

| Code | When |
|------|------|
| `UNKNOWN_ACTION` | Action is not recognized for the namespace. |
| `INVALID_PAYLOAD` | Malformed JSON or invalid envelope. |

## 2) Query/masking error codes

Query service MUST return stable machine-readable codes for governance resolution and policy execution.

| Code | When |
|------|------|
| `GOVERNANCE_NOT_FOUND` | Requested governance object or profile does not exist. |
| `INVALID_GOVERNANCE_REFERENCE` | Governance input format is invalid or references unsupported target. |
| `GOVERNANCE_RESOLUTION_FAILED` | Governance graph cannot be resolved (cycle/depth/consistency violation). |
| `TRUST_CUTOFF_APPLIED` | Account contribution excluded due to governance trust validity cutoff. |
| `ROLE_REQUIRED` | No decisive role is present in current governance context for validity resolution. |
| `ROLE_REQUIRED_FOR_RANK` | No decisive role is present in current governance context for rank resolution. |
| `PLAN_ENTITLEMENT_REQUIRED` | Requested governance capability is not available in current subscription plan. |
| `GLOBAL_POLICY_VIOLATION` | Request attempts to bypass or conflict with mandatory global policy. |
| `MASK_EVALUATION_TIMEOUT` | Query mask computation exceeded configured timeout budget. |
| `RATE_LIMIT_EXCEEDED` | Request exceeded configured rate limit. |
| `QUOTA_EXCEEDED` | Request exceeded subscription quota allocation. |
