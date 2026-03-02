# Social and Account Ingestion (V2)

## 1) Scope

This document defines deterministic ingestion and normalization for Hive social/account operations:

- `mute`
- `follow`
- `unfollow`
- `reblog`
- `create_account`
- `update_account` (v1/v2)

It is normative for Indexer Service storage schema and merge behavior.

## 2) Canonical ordering

All social/account events are applied in canonical order:

`(block_num ASC, trx_index ASC, op_index ASC, transaction_id ASC)`

All conflict resolution and merge behavior in this document uses this ordering.

## 3) Collections / tables

## 3.1 `social_follows_current`

Active follow edge state.

- `follower` (string, PK part)
- `following` (string, PK part)
- `is_following` (boolean)
- `updated_block_num` (int)
- `updated_trx_index` (int)
- `updated_op_index` (int)
- `updated_transaction_id` (string)
- `updated_at_unix` (bigint, event time)

Primary key: `(follower, following)`

Semantics:

- `follow` sets `is_following = true`
- `unfollow` sets `is_following = false`

## 3.2 `social_mutes_current`

Active mute edge state.

- `muter` (string, PK part)
- `muted` (string, PK part)
- `is_muted` (boolean)
- `updated_block_num` (int)
- `updated_trx_index` (int)
- `updated_op_index` (int)
- `updated_transaction_id` (string)
- `updated_at_unix` (bigint, event time)

Primary key: `(muter, muted)`

Semantics:

- `mute` sets `is_muted = true`
- if blockchain provides explicit unmute operation, it sets `is_muted = false`

## 3.3 `social_reblogs_log`

Append-only reblog log.

- `reblog_id` (string, PK; deterministic hash or tx/op composite)
- `account` (string)
- `author` (string, original post author)
- `permlink` (string, original post permlink)
- `block_num` (int)
- `trx_index` (int)
- `op_index` (int)
- `transaction_id` (string)
- `event_time_unix` (bigint)

Recommended unique key: `(account, author, permlink, block_num, trx_index, op_index, transaction_id)`

## 3.4 `accounts_current`

Unified account projection (v1/v2).

- `account` (string, PK)
- `name` (string, nullable)
- `alias` (string, nullable)
- `json_metadata_raw` (string, nullable)
- `profile_image` (string, nullable)
- `last_source_version` (enum: `create_account` | `update_account_v1` | `update_account_v2`)
- `updated_block_num` (int)
- `updated_trx_index` (int)
- `updated_op_index` (int)
- `updated_transaction_id` (string)
- `updated_at_unix` (bigint, event time)

## 3.5 `social_account_events_log` (optional but recommended)

Raw normalized event log for debugging/replay.

- `event_id` (string, PK)
- `event_kind` (enum)
- `actor` (string)
- `subject` (string, nullable)
- `payload_raw` (json/text)
- canonical order fields + event time
- `apply_status` (applied/rejected/skipped)
- `reject_code` (nullable)

## 4) Account normalization fields

Current projected user fields:

- `name`
- `alias`
- `json_metadata_raw`
- `profile_image`

Extraction:

- `profile_image` is extracted from `json_metadata` profile section when present.
- If extraction fails, keep `profile_image = null` and preserve `json_metadata_raw`.

## 5) Merge rules for `update_account` v1/v2

## 5.1 Source of truth (conflict rule)

When multiple account update events conflict:

1. **Primary source of truth** is the latest valid event by canonical ordering.
2. Version (`v1` vs `v2`) does not override recency.
3. If two candidate values originate from the same winning event and both versions are available in parsed payload, prefer v2 field mapping, then fallback to v1 mapping.

In short:

- **Recency first**
- **Within same event: v2 mapping first, v1 fallback**

## 5.2 Field-level merge policy

For each incoming valid account event:

- `name`: overwrite if incoming normalized value is present (non-empty after trim).
- `alias`: overwrite if incoming normalized value is present.
- `json_metadata_raw`: overwrite with incoming raw metadata if incoming metadata exists.
- `profile_image`:
  - set to extracted value when extraction succeeds;
  - if incoming metadata exists but image is absent/invalid, set to `null` (do not keep stale image from older metadata).

Rationale: `profile_image` must reflect current metadata snapshot, not historical fallback.

## 5.3 Invalid payload handling

- If `create_account` / `update_account` payload cannot be normalized, reject with `INVALID_ACCOUNT_PAYLOAD`.
- Rejects do not mutate `accounts_current`.

## 6) Determinism and replay guarantees

- Replaying the same block range must yield identical `accounts_current`, `social_follows_current`, `social_mutes_current`, and `social_reblogs_log`.
- Merge outcomes must be identical across nodes for the same canonical stream.

## 7) Relationship to governance filters

- Social/account ingestion itself is neutral and deterministic.
- Governance masks are applied at query time.
- Exception already defined in core spec: parsed posts may be excluded from queryable posts dataset when author is muted by effective owner/moderator governance set at post block time.
