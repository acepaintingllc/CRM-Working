# App Architecture Standards

This is the default architecture for ordinary CRM features. Follow these rules unless a slice has a documented reason to differ, such as Estimator V2.

## Route handlers

- Authenticate first with `requireSessionUserOrg`.
- Parse params/body with shared route helpers.
- Normalize and validate input in domain modules, not inline in the route.
- Call a service/domain function for persistence and business rules.
- Return stable envelopes:
  - read responses: `{ data }`
  - successful writes: `{ data, notice? }`
  - failures: `{ error }` with meaningful status codes

## Client data flows

- Use the shared authenticated API client in `lib/client/api.ts`.
- Use `useResource` for standard read-only resource loading.
- Use `useEditableResource` for standard CRUD/settings-style load/save flows.
- Keep page components thin; move orchestration into hooks or client-domain helpers.

## Form and validation ownership

- Canonical validation belongs in domain parsers/normalizers.
- Components collect input and render UI state; they should not own business rules.
- Client-side validation may improve UX, but it must not become the only source of truth.

## Business logic placement

- Shared business logic belongs in `lib/*` service/domain modules.
- Route handlers and pages coordinate, but do not own core rules.
- Presentational components should render view models, not compute domain decisions.

## Estimate vs quote naming

- `Estimate` is the canonical internal domain term for shared services, types, hooks, and helpers.
- `Quote` remains an allowed user-facing label and route alias.
- Do not introduce parallel `quote*` and `estimate*` shared abstractions for the same concept.

## Allowed exception

- Estimator V2 may keep its custom state architecture where its complexity materially exceeds standard CRUD flows.
