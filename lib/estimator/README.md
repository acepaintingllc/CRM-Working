# Shared Estimator Domain

Use this folder for estimator logic that should not live directly in the route.

Examples:

- calculators
- input normalization
- mapping and serializer helpers
- reusable validation helpers
- model constants and shared re-exports in `models.ts`

Current wall calculator files:

- `walls.ts` (main orchestration and output shape)
- `wallsHelpers.ts` (numeric helpers, settings resolution, segment math)
- `wallsTypes.ts` (shared wall-calculation types)
- `wallsSummaryPricing.ts` (summary snapshot + pricing-readiness validation)
- `v2WallsValidation.ts` (client-draft validation for v2 walls editor)
- `v2WallsSanitize.ts` (draft normalization for RECT/SEG scope+segment state)
- `v2WallsAutosave.ts` (autosave gating, status text, request race tracking)

Pre-summary / pre-pricing quality gates:

- estimator fixtures and contract tests green
- v2 draft sanitize + validation tests green
- route payload normalization tests green
- pricing-readiness checks report zero issues for saved wall calculations

Keep UI-only code out of this folder.
