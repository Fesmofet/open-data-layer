
In our architrecture we need 2 more services 
- dashboard/admin for managing users subscription, usage statistic etc
- service for validating access token given on dasshboard and write statistic, rate limiting and access to main query service
### Proposed tiers

1. **Free plan**  
   - Slow API/service (example target mentioned: ~500ms class responses for some endpoints).  
   - Useful for broad access and adoption.

2. **Low paid tier (~$5/month, draft)**  
   - Faster responses, but with quota-limited "fast" requests.

3. **Higher tier (~$20+/month, draft)**  
   - Larger quota + ability to apply custom governance layer (premium feature).

### Core monetization logic

- Users pay for:  
  - speed/throughput,  
  - quota,  
  - governance customization/overrides (expensive capability).

## 3) Governance model evolution

### 3.1 Trust and verification

For trusted accounts/publishers, discussed basic verification chain:

- account profile links website,
- website contains `llm.txt` linking back to account,
- plus subscription/payment signal.

This is useful but acknowledged as a weak trust signal by itself (easy to spoof structurally).

### 3.2 Account health signals

Idea raised: track account "heartbeat" (activity recency/update frequency) as an additional trust/freshness indicator.  
Status: exploratory, no final decision.

### 3.3 Time-bounded trust validity

Important governance safety concept agreed:

- Need a **trust validity cutoff** (similar to compromise date), not just hard removal.
- Use case: account was valid historically but got compromised later.
- After cutoff date, new actions are untrusted; historical valid work may remain.
- maybe better implemntation will be track current block number and make it marker instead of just date

This avoids destructive rollback of all past contributions when compromise is discovered.


## 4) Muting/restriction/list mechanics

### 4.1 `mute`

we support hive mute operation and make our own opperation for bulk write (many accounts to mute collection/table)

### 4.2 Scope logic discussed

- Moderator mute primarily affects social/posts visibility.
- Trusted actor mutes may apply within scope of their governed objects. ( we now it by authority update it can be either administrative or ownership)
### 4.3 Whitelist/blacklist direction

Two tracks emerged:

- **Blacklist** as future eligibility control (not necessarily full mute/removal).
- **Whitelist** as override/protection mechanism against inherited mutes/blocks.

its two type of updates on governance object
---

## 5) Trusted-account scalability and nested governance

### Problem

Directly maintaining very large trusted lists (e.g., thousands of merchants) is hard.

### Explored options
 governance can include references to other governance objects, then merge role lists (`admins`, `moderators`, `trusted`, etc.).
   - Helps with aggregation and delegation without duplicating huge lists manually.



## 6) Storage and overflow strategy (IPFS vs Arweave)

### Current practical direction

Adopt **IPFS overflow path** as near-term practical mechanism.

Reasons:

- Local IPFS likely necessary for assets (e.g., images/avatars).
- Better resilience if a publisher/service goes offline (pinning can be taken over by others).
- Provides capacity "escape hatch" for large ingest scenarios.

### CDN relationship

- IPFS alone is not a CDN replacement by default.
- Likely architecture: **IPFS as source/origin**, CDN as distribution layer for fast geo delivery.

### Arweave status

- Keep in architecture for permanence objective.
- Implementation can be postponed due to high complexity and unclear infra behaviors observed during research.
- Research noted inconsistencies/complexity around transaction sizing, bundling (e.g., ANS-102), tooling layers, and practical throughput constraints.


## 7) Service decomposition (important alignment)

Even under "one server product", responsibilities should be split into deployable components:

1. **Indexer / writer service**  
   - Parse/validate/ingest/write.

2. **Query/read service**  
   - Apply governance logic, filtering, caching, query behavior.

3. **Dashboard/admin/billing service**  
   - Config, governance management UX, analytics, billing integration.

4. **Rate-limit/API gateway service**  
   - Enforce API tokens, plan limits, queueing, logging/events.

Additional alignment:

- Keep transport layer agnostic where possible (HTTP + MCP now, extensible to WebSocket/RPC later).
- Put business logic in services, not controllers.
- Keep monorepo approach for open-source distribution and simpler assembly.

---

## 8) Governance + billing coupling

Key product insight repeated:

- Trusted status is effectively tied to subscription/resource contribution.
- Premium governance features become sustainable only with paid plans.
- Platform governance remains the base layer; user governance is applied on top with clear boundaries.



## 10) Suggested immediate artifacts to produce

1. Governance spec v1:
   - entities,
   - role semantics,
   - merge and precedence rules,
   - time-validity fields.

2. Storage spec v1:
   - primary write path,
   - IPFS overflow path,
   - Arweave deferred integration points.

3. Service boundaries doc:
   - indexer/query/dashboard/rate-limiter contracts,
   - shared schemas/events,
   - deployment topologies (single host vs scaled).

4. Monetization spec:
   - plan limits,
   - SLA targets,
   - governance entitlement mapping.
