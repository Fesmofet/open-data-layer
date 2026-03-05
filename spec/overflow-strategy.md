# Overflow Strategy (Hive + IPFS, Arweave deferred)

**Back:** [Spec index](README.md) · **Related:** [storage](storage.md), [architecture](architecture.md)

## 1) Goal

Provide a deterministic policy for when publishing stays on Hive and when it offloads to IPFS.

## 2) Baseline and emergency paths

- Baseline path: Hive publish flow.
- Emergency/offload path: IPFS.

IPFS is used for:

- large initial import files,
- backlog drain when publish queue growth exceeds policy limits.

## 3) Trigger policies

Overflow policy should use configurable thresholds, for example:

- max file size for Hive-only mode,
- queue depth threshold,
- queue age threshold,
- estimated publish completion SLA breach.

If one or more thresholds are exceeded, scheduler may switch batch to IPFS.

## 4) Chunking and status lifecycle

- Payloads may be chunked for transport.
- Each chunk/batch tracks lifecycle states:
  - `queued`
  - `accepted`
  - `confirmed`
  - `failed`
- `accepted` is not final; confirmation must be polled until success/fail/TTL expiry.

## 5) Polling and TTL

- Poll transaction/chunk confirmation at bounded intervals.
- Use retry/backoff policy.
- If TTL expires without confirmation, mark failed and apply retry/escalation policy.

## 6) Cost and predictability

- Publisher should compute cost estimate before offload and record it in operation metadata.
- Cost estimation should be stored with batch id for audit and SLA analysis.

## 7) Read path implications

- Offloaded batches must remain discoverable by index/query flow through recorded references.
- Query behavior must remain deterministic regardless of Hive-only vs overflow path used at publish time.
- IPFS should be treated as origin/source layer; CDN may be used for distribution acceleration.

## 8) Arweave integration status

- Arweave remains a strategic permanence option.
- Arweave integration is deferred in current implementation scope due to tooling/throughput complexity.
- Design should preserve extension points to add Arweave as optional secondary permanence backend later.

## 9) Minimum observability

Required metrics:

- queue depth and queue age,
- overflow trigger count,
- accepted-to-confirmed latency,
- failure/retry count,
- estimated vs actual cost.
