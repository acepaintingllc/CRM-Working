# System Architecture

## Purpose

This repo is a Next.js + Supabase CRM for a residential painting business. It contains operational CRM surfaces, quote/estimate workflows, jobs workflow management, and Estimator V2.

Use this document for top-level ownership boundaries. Use the area docs for implementation rules.

## Read Next

| Change area | Source of truth |
| --- | --- |
| Route handlers, services, validation, response envelopes | `docs/architecture/app-architecture-standards.md` |
| CRM page layout, shared UI primitives, visual exceptions | `docs/architecture/crm-ui-system.md` |
| Quote, estimate, pricing, products, rates, flags, Estimator V2 | `docs/architecture/quote-estimate-architecture.md` |
| Jobs, stages, schedules, calendar, workflow/email transitions | `docs/architecture/jobs-architecture.md` |
| New feature or page build | `docs/templates/feature-page-prompt-template.md` |

## Ownership Boundaries

| Area | Owns | Canonical layers |
| --- | --- | --- |
| Pages | Route composition, layout wiring, view selection | `app/**/page.tsx`, route-local `_components` |
| Controller hooks | Page orchestration, resource state, user actions | route-local `_hooks` |
| Route handlers | Auth, parsing, delegation, envelope mapping | `app/api/**/route.ts` |
| Services/domain | Business rules, persistence, normalization, contract shaping | `lib/**` |
| Validation/parsing | Canonical input normalization and validation | shared domain parsers/normalizers |
| Types | Shared API/domain contracts | `types/**`, domain-local types |
| CRM UI | Standard operational page primitives and visual rules | `docs/architecture/crm-ui-system.md`, shared CRM components |
| Jobs workflow | Status/stage definitions and schedule/workflow side effects | `lib/jobs/**`, `lib/server/jobScheduleSync.ts` |
| Estimate/quote domain | Pricing, estimate contracts, products/rates/flags, Estimator V2 logic | `lib/estimator/**`, quote/estimate docs |

## Default Layering Rule

1. Page renders and composes.
2. Hook coordinates page behavior.
3. Client helper calls the API.
4. Route authenticates, parses, delegates, and maps response.
5. Service/domain owns business rules and persistence.
6. Shared types keep UI, API, and database contracts aligned.

Do not move rules upward into pages or route handlers just because the first caller is local.

## Where Changes Belong

| Need | Put it here |
| --- | --- |
| New API request/response behavior | route handler plus service/domain contract |
| New business rule | shared service/domain module for that area |
| New validation rule | canonical parser/normalizer, with route using it |
| New page-level workflow | route-local hook, using shared client/service boundaries |
| New reusable UI pattern | shared CRM UI primitive only after a second real use case |
| One-off dense editor behavior | route-local workspace components/hooks, documented by the area doc |
| Jobs stage or schedule side effect | `lib/jobs/types.ts` and/or `lib/server/jobScheduleSync.ts` |
| Quote/estimate calculation or pricing change | quote/estimate domain modules, not UI components |

## Shared-First Rules

- Reuse existing services, clients, hooks, UI primitives, SQL patterns, and types before adding new ones.
- Extend the canonical shared path when behavior already exists.
- Keep DB, API, type, and UI contracts in sync when any one changes.
- Prefer one owner for each rule. If multiple surfaces need it, move it to the shared owner.
- Keep route handlers thin and pages render-focused.

## Anti-Patterns

- Direct database access from pages/components.
- Business rules embedded in React components or route handlers.
- Bespoke response envelopes for standard CRM CRUD routes.
- Parallel `quote*` and `estimate*` shared abstractions for the same domain concept.
- Status, stage, schedule, or workflow-email side effects patched inline outside the jobs owners.
- Custom CRM page chrome when shared CRM primitives fit.
- Broad refactors, formatting churn, or speculative abstractions while solving a narrow task.

## Estimate Naming Rule

Use `Estimate` for shared quote/estimate domain logic, services, types, and canonical modules. Use `Quote` for user-facing labels and route aliases. Do not create duplicate shared abstractions by naming one quote and one estimate for the same behavior.

## Estimator V2 Invariants

Keep detailed implementation guidance in `docs/architecture/quote-estimate-architecture.md`, but do not lose these system constraints:

- `Job` can own multiple active estimate versions for revisions, split scopes, combined scopes, and options.
- Estimator calculations must keep input, derived, override, and effective values separate.
- Calculation flow is input -> derived -> overrides -> effective values -> room/estimate rollups -> estimate-level pricing policies -> outputs.
- Estimate-level labor rounding and job minimum adjustments are internal pricing policies, not customer-facing line items by default.
- Hidden/internal pricing adjustments must remain auditable and allocatable where required.
- Shared charges, partial room work, manual pricing, prep trips, access charges, and non-rectangular/approximate geometry must not be blocked by schema or UI choices.
- Unresolved product behavior, material allocation, package/rules-engine scope, proposal output, and snapshot strategy must stay explicit rather than guessed in code.
