# Engineering Guidance

## Purpose

Use this file as the routing and guardrails checklist before code changes. It points agents to the right source of truth, then keeps implementation scoped, shared-first, and aligned across layers.

## Read These Docs First

- `ARCHITECTURE.md` before substantive app or Estimator V2 changes.
- `docs/architecture/app-architecture-standards.md` before changing route handlers, services, validation, or response contracts.
- `docs/architecture/crm-ui-system.md` before adding or changing CRM UI.
- `docs/architecture/quote-estimate-architecture.md` for quote, estimate, pricing, products, rates, flags, or Estimator V2 work.
- `docs/architecture/jobs-architecture.md` for jobs, schedules, calendar, stages, or workflow/email transitions.
- `docs/templates/feature-page-prompt-template.md` for new feature or page builds.

## Shared-First Implementation Rules

- Reuse existing helpers, services, hooks, components, SQL patterns, types, and app conventions before adding custom code.
- Extend the canonical shared path when similar behavior already exists.
- Add an abstraction only when it removes real duplication, clarifies ownership, or matches an established pattern.
- Use shared CRM UI primitives for standard CRM screens; diverge only for dense workspace/editor flows that need it.
- Keep changes small and task-focused. Avoid unrelated refactors, formatting churn, and speculative cleanup.

## Ownership And Boundary Rules

- Identify the owner before editing: page, shared UI, hook, route handler, service, domain module, parser, validator, migration, or test.
- Keep route handlers thin: authenticate with the standard org/session guard, parse with shared helpers, delegate to service/domain code, and return standard envelopes.
- Keep business rules out of pages/components when they belong in shared domain, validation, or service modules.
- Do not bypass shared clients, services, sync layers, or action layers with direct database or fetch calls.
- Keep DB, API, type, and UI contracts aligned when any one changes.
- Use `Estimate` for shared quote/estimate domain logic and canonical modules; use `Quote` for user-facing labels and route aliases.
- Keep job status, stage, schedule, and workflow side effects inside the canonical jobs architecture.
- In estimator work, keep input, derived, override, and effective values separate.

## Verification Rules

- Add or update tests when behavior, calculations, database contracts, response contracts, or shared utilities change.
- Test the layer you touched: reducer/state, hook/controller, domain helper, route handler, service, or UI.
- Run the most relevant checks available for the touched area.
- Before finishing, check for duplicate business rules, parallel abstractions, missing auth, mismatched envelopes, and contract drift.
- If a check cannot run, state the reason.

## Communication Expectations For Tradeoffs

- Call out when a local fix is intentionally chosen over a broader shared change.
- Surface assumptions about schema, product behavior, permissions, or workflow.
- If one rule must apply in multiple places, name the shared owner where it should live.
- Mention API contract impact when paths, request/response shapes, schema, status behavior, or persisted state change.
- Mention test coverage and remaining risk for calculations, migrations, workflow side effects, or permissions.
