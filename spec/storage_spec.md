# Storage Specification (V1)

## 1) Primary write path

- Primary publishing/storage path is Hive.
- Indexer ingests canonical Hive events and stores neutral state.

## 2) Overflow path

- Overflow path is IPFS for large imports and queue backlog drain.
- Offloaded payloads must remain addressable from index/query flow.
- CDN may be layered on top of IPFS for delivery performance.

## 3) Deferred Arweave integration points

- Arweave remains optional deferred backend for permanence strategy.
- Integration points to keep:
  - overflow backend interface abstraction,
  - recorded content reference metadata,
  - deterministic retrieval contract independent of backend.

## 4) Required persisted datasets

- canonical events log,
- objects/updates raw state,
- raw validity votes and raw rank votes,
- governance objects and reference edges,
- social/account datasets,
- overflow reference records.

## 5) Determinism guarantees

- Same source stream and same backend references must produce same query-visible state.
- Backend choice (Hive-only vs Hive+IPFS) must not change deterministic query semantics.
