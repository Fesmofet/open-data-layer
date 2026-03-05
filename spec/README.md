# Open Data Layer Specification — Start Here

This is the **single entry point** for the Open Data project specification. Use it to find every document you need and to onboard quickly.

---

## 1. Purpose and scope

The spec defines a deterministic architecture for:

- Indexing blockchain object/update events
- Resolving competing updates with vote semantics
- Applying governance as **request-time masks** (query layer)
- Overflow publishing (Hive baseline + IPFS, Arweave deferred)

**Normative** = binding for implementations. **Informative** = context, examples, or future work.

---

## 2. Who this is for

| Role | Focus |
|------|--------|
| **Indexer** | Write path, event validation, neutral state, object/update/vote storage |
| **Query / Masking** | Governance resolution, mask precedence, ranking, two-phase query |
| **Platform** | Gateway, billing, plan entitlements, overflow policy |

---

## 3. 10-minute onboarding path

1. Read **Architecture baseline** below (four services).
2. Skim [architecture.md](architecture.md) for service boundaries and contracts.
3. Read [governance-resolution.md](governance-resolution.md) for how masks are computed.
4. For full narrative: [../spec_governance_updates.md](../spec_governance_updates.md) (end-to-end summary).

---

## 4. Architecture baseline

Four-service model (normative):

- **Indexer Service** — stores canonical neutral state; no tenant governance filtering.
- **Query/Masking Service** — applies governance masks per request.
- **Dashboard/Admin/Billing Service** — plans, governance entitlements, usage.
- **API Gateway/Rate-Limit Service** — tokens, quotas, speed classes.

Details: [architecture.md](architecture.md).

---

## 5. Spec map (all documents)

### Core domain and write path

| Doc | Description |
|-----|-------------|
| [object-uniqueness.md](object-uniqueness.md) | `object_id` global uniqueness, first-write-wins, collision rules |
| [object-type-entity.md](object-type-entity.md) | Governance-controlled `object_type` registry (`supported_updates`, `supposed_updates`) |
| [vote-semantics.md](vote-semantics.md) | Query-time validity and rank resolution; raw vote storage |
| [reject-codes.md](reject-codes.md) | Canonical indexer and query/masking error codes |

### Governance and query

| Doc | Description |
|-----|-------------|
| [governance-bootstrap.md](governance-bootstrap.md) | V2 initialization; main governance reference; no global lock |
| [governance-resolution.md](governance-resolution.md) | Role precedence, trust traversal, cache invalidation, snapshot format |

### Storage and overflow

| Doc | Description |
|-----|-------------|
| [storage.md](storage.md) | Primary write path (Hive), overflow (IPFS), required datasets |
| [overflow-strategy.md](overflow-strategy.md) | When to use Hive vs IPFS; triggers, lifecycle, Arweave deferred |

### Social, platform, validation

| Doc | Description |
|-----|-------------|
| [social-account-ingestion.md](social-account-ingestion.md) | Follow/mute/reblog/account ingestion and merge rules |
| [monetization.md](monetization.md) | Plan tiers, entitlement mapping, gateway enforcement |
| [acceptance-tests.md](acceptance-tests.md) | Acceptance criteria and non-functional targets |

### Schemas and config

| Resource | Description |
|---------|-------------|
| [schemas/](schemas/) | JSON Schema for ODL events (`odl_event_envelope`, `object_create`, `update_create`, `update_vote`, `rank_vote`, `object_type_*`) |
| [config_example.yaml](config_example.yaml) | Example indexer/governance bootstrap config |

---

## 6. Role-based reading paths

**Indexer:**  
[architecture.md](architecture.md) → [object-uniqueness.md](object-uniqueness.md) → [object-type-entity.md](object-type-entity.md) → [vote-semantics.md](vote-semantics.md) → [reject-codes.md](reject-codes.md) → [storage.md](storage.md) → [social-account-ingestion.md](social-account-ingestion.md)

**Query / Masking:**  
[architecture.md](architecture.md) → [governance-resolution.md](governance-resolution.md) → [vote-semantics.md](vote-semantics.md) → [reject-codes.md](reject-codes.md)

**Platform (gateway / billing / overflow):**  
[architecture.md](architecture.md) → [monetization.md](monetization.md) → [overflow-strategy.md](overflow-strategy.md)

---

## 7. ODL event ids and envelope

- Main network `custom_json.id`: `odl-mainnet`
- Test network `custom_json.id`: `odl-testnet`

Envelope shape:

```json
{
  "events": [
    { "action": "string", "v": 1, "payload": {} }
  ]
}
```

Actions: `object_create`, `update_create`, `update_vote`, `rank_vote`. Governance is expressed as objects with `object_type = governance` (no separate namespace).

