# App Architecture Standards

## Purpose

Default rules for CRM route handlers, services, validation, client data flows, and response contracts. Follow this doc unless a feature-specific architecture doc gives a narrower rule.

## Request Lifecycle

| Layer | Owns | Must not own |
| --- | --- | --- |
| Page/component | Rendering, form inputs, local UI state | persistence, canonical validation, business rules |
| Hook/controller | Page orchestration, resource state, user actions | durable domain decisions |
| Client helper | Authenticated API calls and endpoint shape | server-only rules |
| Route handler | auth, param/body parsing, delegation, envelope/status mapping | business logic, ad hoc normalization |
| Service/domain | rules, validation orchestration, persistence, enrichment, contract data shaping | JSX or browser-only behavior |
| Parser/normalizer | canonical input shape and validation | UI messaging/layout |

## Route Handlers

- Authenticate first with `requireSessionUserOrg`.
- Parse params/body with shared route helpers.
- Normalize and validate through shared domain parsers/normalizers.
- Delegate persistence and business rules to a service/domain function.
- Return standard envelopes and meaningful HTTP status codes.

## Response Envelopes

| Operation | Success | Failure |
| --- | --- | --- |
| Read | `{ data }` | `{ error }` |
| Write | `{ data, notice? }` | `{ error }` |
| Delete | `{ data: { ok: true }, notice? }` unless area doc says otherwise | `{ error }` |

Avoid bespoke `job`, `jobs`, `quote`, `ok`, or mixed payloads for standard CRM CRUD routes.

## Client Data Flows

- Use `lib/client/api.ts` for authenticated API calls.
- Use `useResource` for standard read-only loading.
- Use `useEditableResource` for standard CRUD/settings load-save flows.
- Keep page components thin; move orchestration into route-local hooks or client-domain helpers.
- Use URL-backed filters when navigation should preserve list state.

## Standard CRM Page Defaults

| Page type | Default structure |
| --- | --- |
| List | `CrmPageShell`, `CrmPageHeader`, filters/search, `CrmResourceState` |
| Detail | `CrmDetailLayout`, one orchestration hook, shared notice/retry/delete/copy handling |
| Create/edit | `CrmEntityFormPage`, one orchestration hook, render-only form, detail-first navigation on save |
| Settings | `useEditableResource`, shared resource states, render-only controls |

UI primitives and allowed visual exceptions are defined in `docs/architecture/crm-ui-system.md`.

## Validation And Business Rules

- Canonical validation belongs in domain parsers/normalizers.
- Client validation may improve UX, but cannot be the only source of truth.
- Shared business logic belongs in `lib/**` service/domain modules.
- Presentational components should render view models, not compute durable domain decisions.
- Route handlers and pages coordinate behavior; they do not own core rules.

## Dense Editor Exceptions

Estimator V2, quote editor/workspace routes, quote home panels, products, and rates/flags editors may use denser route-local state when the workflow materially exceeds standard CRUD.

Allowed dense-editor traits:

- CRM shell/resource-state framing still applies unless the area doc says otherwise.
- Route-local reducer/state machines are allowed for complex inline editing.
- Pure view-model builders are preferred for computed display state.
- Unsaved-change guards belong in controller hooks.
- Shared domain modules still own business rules, contracts, pricing, and persistence.

See `docs/architecture/quote-estimate-architecture.md` for quote/estimate-specific rules.

## Anti-Patterns

- Inline request validation that differs from the service/domain parser.
- Fetching API routes directly from components when a shared client/helper exists.
- Returning new envelope shapes for a standard CRUD route.
- Duplicating the same business rule in client and server code without a shared owner.
- Adding a new hook, service, or parser parallel to an existing canonical one.
