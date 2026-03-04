# Monetization and Plan Entitlements (V1)

## 1) Purpose

Define subscription tiers, entitlement boundaries, and SLA/quota dimensions enforced by gateway and billing services.

## 2) Draft plan tiers

### Free plan

- Slower service class (example target class around 500ms for some endpoints).
- Strict quota/rate limits.
- No custom governance override entitlement.

### Low paid tier (draft ~5 USD/month)

- Faster response class than free plan.
- Limited quota of "fast" requests.
- Limited governance customization according to policy.

### Higher tier (draft ~20+ USD/month)

- Larger throughput/quota envelope.
- Custom governance layer entitlement enabled (premium capability).

## 3) Entitlement mapping

Entitlements are plan-derived and enforced at gateway:

- max requests per period,
- max rate (requests/sec or requests/min),
- speed class,
- governance capabilities:
  - `can_use_custom_governance`
  - `can_use_governance_overrides`
  - optional trust-depth limits per plan.

## 4) Enforcement path

1. Dashboard/Billing stores plan and token policy.
2. Gateway validates token and resolves effective entitlements.
3. Query receives request with enforced policy context.
4. Usage statistics emitted back to billing analytics.

## 5) Error semantics

- Missing entitlement for premium governance features should surface `PLAN_ENTITLEMENT_REQUIRED`.
- Quota/rate violations should surface existing rate/quota error codes.

## 6) Observability

Required metrics:

- per-plan request volume,
- per-token usage and throttling events,
- quota consumption velocity,
- latency by plan/speed class.
