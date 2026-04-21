# CRM Home

Lightweight guardrails for changes in `app/crm/_home`.

## Architecture

- `lib/crm/home/*`: data semantics only. Fetch orchestration, parsing, selectors, state helpers, and source-status rules live here.
- `app/crm/_home/viewModel.ts`: UI-facing decisions only. Convert domain data and source states into card-ready view models here.
- `app/crm/_home/components/*`: presentation only. Cards and primitives should render view models, not own business rules.

## Test Layers

- `lib/crm/__tests__/home*.test.ts`
  - Owns selector/state/loader semantics, malformed payload handling, source-status transitions, and partial refresh behavior.
  - Should not test card markup or interaction details.
- `app/crm/_home/__tests__`
  - Owns hook, view-model, and page composition behavior.
  - Should cover UI-facing decisions, source combinations, and high-value page regressions.
- `app/crm/_home/components/**/__tests__`
  - Owns component/primitives interaction, accessibility, and visual-state branching.
  - Should not re-test loader rules or duplicate view-model permutations already covered above.

## Change Checklist

- No business rules in cards.
- No raw source booleans or error maps passed into presentational components unless the component is intentionally low-level.
- No repeated card markup outside shared primitives or descriptor-driven rendering.
- No new interactive dashboard behavior without a colocated component or page interaction test.
- Prefer shared home test helpers for source-state fixtures instead of hand-building the same state in multiple tests.

## Testing Expectations

- Add data-shape/source-status regressions to the lib home tests.
- Add UI decision regressions to `viewModel.test.ts` or `CrmHomePageContent.test.tsx`.
- Add interaction/accessibility regressions to colocated component tests.
- Run `npm.cmd run test` after changes to this area.
