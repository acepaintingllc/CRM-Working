# Canonical Historical Fixtures

This folder contains canonical Estimator V2 fixtures used for business validation.

Rules:
- Historical-style scenarios use `metadata.sourceType = manually_crafted`.
- Historical-style scenarios use `metadata.expectedTotalSource = hand_verified`.
- Expected totals are business truth.
- Do not regenerate expected totals from the current calculator just to make tests pass.
- If current behavior differs from a hand-verified fixture, record the reason with `comparisonNotes`, `knownDifferenceNotes`, and `expectedMismatches`.
- A future imported historical scenario may plug in through the harness adapter seam, but no DB import/export workflow is part of this fixture layer today.

Allowed mismatch categories:
- `expected_rounding_difference`
- `known_old_system_bug`
- `intended_behavior_change`
- `actual_defect`

Use the comparison harness in [estimateV2HistoricalComparisonHarness.ts](/C:/Users/ehrha/Documents/ace-crm-working/lib/estimator/__tests__/estimateV2HistoricalComparisonHarness.ts) to classify differences and keep the explanation local to this fixture area.
