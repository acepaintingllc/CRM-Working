# Engineering Guidance

Read this before making code changes in this repository.

## Read The Right Docs First

- Read `ARCHITECTURE.md` before substantive app or estimator changes.
- Read `docs/app-architecture-standards.md` before changing route handlers, services, validation, or response contracts.
- Read `docs/crm-ui-system.md` before adding or changing CRM UI.
- Read `docs/quote-estimate-architecture.md` and `docs/quotes-system.md` for quote, estimate, pricing, products, rates, flags, or Estimator V2 work.
- Read `docs/jobs-architecture.md` for jobs, schedules, calendar, stages, or workflow/email transitions.
- For new feature or page builds, use `docs/feature-page-prompt-template.md` as the detailed workflow.

## Work From The Existing System First

- Look for an existing shared solution before adding custom logic.
- Prefer existing helpers, types, components, hooks, SQL patterns, and app conventions over one-off implementations.
- If similar behavior already exists in another feature, reuse or extend the shared path when that keeps the system simpler.
- Only create a new abstraction when it removes real duplication, clarifies ownership, or matches an established pattern.
- Do not introduce duplicate job, quote, estimate, API, or UI abstractions when a canonical one already exists.

## Think Beyond The Immediate Bug

- Consider the broader workflow, data model, permissions, and user experience affected by a change.
- Avoid fixing one screen or edge case in isolation if the same rule should apply elsewhere.
- Check whether the issue points to a missing shared contract, validation rule, database constraint, or test coverage.
- Preserve behavior that other parts of the CRM may depend on unless the requested change clearly requires altering it.
- Before writing, identify the canonical owner for the change: page, shared UI, hook, route handler, service, domain module, parser, validator, migration, or test.

## Respect App Boundaries

- Route handlers must authenticate with the project-standard org/session guard.
- Route handlers should parse inputs with shared helpers, delegate business logic to service/domain modules, and return project-standard envelopes.
- Do not put business rules directly in pages or components when they belong in shared domain, validation, or service code.
- Do not bypass shared clients, services, sync layers, or action layers with direct database or fetch calls.
- Keep database, API, type, and UI contracts aligned when any one of them changes.

## Use Product Vocabulary Precisely

- Use `Estimate` for shared quote/estimate domain logic and canonical modules.
- Use `Quote` for user-facing labels and route aliases where the product language requires it.
- In estimator work, keep input, derived, override, and effective values clearly separated.
- Keep job status, stage, schedule, and workflow side effects in the canonical jobs architecture.

## Default To Shared CRM UI

- Use shared CRM UI primitives by default for standard CRM screens.
- Diverge only for dense workspace/editor flows where the shared UI is materially insufficient.
- Do not add duplicate UI primitives when an existing component can be reused or extended.

## Keep Changes Scoped And Consistent

- Make the smallest complete change that solves the problem correctly.
- Do not mix unrelated refactors, formatting churn, or speculative cleanup into task-focused work.
- Match the surrounding file style, naming, error handling, and UI patterns.
- Keep SQL migrations additive and compatible unless a destructive migration is explicitly requested.
- If a one-off is unavoidable, keep it minimal, isolated, and easy to remove later.

## Verify The Right Layer

- Add or update tests when behavior, calculations, database contracts, or shared utilities change.
- Run the most relevant checks available for the touched area.
- If a check cannot be run, state that clearly with the reason.
- Before finishing, check for duplicated business rules, parallel abstractions, missing auth, mismatched response envelopes, and contract drift.

## Communicate Tradeoffs

- Call out when a local fix is intentionally chosen over a broader shared change.
- Surface assumptions about schema, product behavior, or workflow before they become hidden constraints.
- If multiple parts of the app need the same rule, name the shared place where that rule should live.
- Mention API contract impact when endpoint paths, request/response shapes, schema, status behavior, or persisted state changes.
- Mention test coverage and any remaining risk for calculations, migrations, workflow side effects, or permissions.
