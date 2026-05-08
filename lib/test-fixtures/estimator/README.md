Estimating confidence suite

Run `npm run test:estimating-confidence` before merging quote-system, Estimate V2, pricing, persistence, summary, or customer-send changes.

This gate covers:
- estimator math and pricing-policy reconciliation
- canonical fixture structure contracts
- preview/server parity
- save/load persistence parity
- customer total chain parity across load, summary, and send
- save-controller and displayed-total state behavior
- summary derivation and readiness behavior
- customer-send and customer-quote total parity
- historical estimate setting/catalog comparison behavior

The suite is intentionally explicit and must not be skipped before quote-system changes. Its tests currently live across:
- `lib/estimator/__tests__`
- `lib/server/estimate-feedback/__tests__`
- `lib/server/estimate-v2/__tests__`
- `lib/server/customer-send/__tests__`
- `lib/customer-estimates/__tests__`
- `app/crm/estimates/[id]/v2/**/__tests__`
