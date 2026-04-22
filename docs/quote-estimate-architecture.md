# Quote / Estimate Architecture

This is the maintenance contract for quote work.

## Canonical ownership

- `app/crm/estimates/[id]/v2` is the only canonical Estimator V2 editor/summary implementation.
- `app/crm/quotes/[id]` is the quote-facing route alias and composition layer only.
- Do not recreate quote-side `_components`, `_state`, `_lib`, or `summary/_*` trees for V2 behavior.

## Where new quote work belongs

- Quote-facing routing, labeling, navigation, and route-local composition belong under `app/crm/quotes`.
- Shared business logic belongs in `lib/estimator`, `lib/customer-estimates`, or existing shared quote domain modules.
- Shared send/review orchestration belongs in the estimate-side shared customer-send module and is consumed by both route families.
- Supporting quote admin pages should extend the existing hook + page-content + small-section pattern, not page-level orchestration.

## Guardrails

- `Estimate` remains the canonical internal domain term for shared logic.
- `Quote` is the user-facing label and route alias.
- If a quote feature would duplicate estimate-side shared logic, move the logic to the canonical shared module instead.
- Keep route entrypoints thin: resolve params, mount canonical content, and apply quote-specific labels/navigation only.
