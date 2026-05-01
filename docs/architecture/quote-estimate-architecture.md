# Quote / Estimate Architecture

This is the canonical architecture path for quote, estimate, pricing, products, rates, flags, customer-send, and Estimator V2 work.

## Product Vocabulary

- `Estimate` is the canonical internal domain term for shared logic, types, hooks, services, calculations, and persisted estimate/version behavior.
- `Quote` is the user-facing label and route alias where the CRM presents estimates to users or customers.
- Do not create parallel quote and estimate abstractions for the same concept.
- In estimator work, keep input, derived, override, and effective values separate.

## Canonical Ownership

- `app/crm/estimates/[id]/v2` owns the Estimator V2 editor, details, summary, and shared estimate-side route behavior.
- `app/crm/quotes/[id]` is a thin quote-facing route alias and composition layer.
- Do not recreate quote-side `_components`, `_state`, `_lib`, or `summary/_*` trees for V2 behavior.
- Shared estimate/quote domain logic belongs in `lib/estimator`, `types/estimator`, `lib/customer-estimates`, `lib/quotes`, or existing server service modules.
- Shared send/review orchestration belongs in the estimate-side shared customer-send module and is consumed by both route families.

## System Surfaces

The quote system covers:

- Quote Home: `/crm/quotes`
- Version creation: `/crm/quotes/create?job=X`
- Quote Defaults: `/crm/quotes/defaults`
- Products: `/crm/quotes/products`
- Rates / Flags: `/crm/quotes/rates`
- Quote detail alias: `/crm/quotes/[id]`
- Quote summary alias: `/crm/quotes/[id]/summary`
- Send Quote: `/crm/quotes/[id]/send`

## Layer Contract

Every quote admin page should follow the existing page facade pattern unless the canonical estimate route owns the behavior:

```text
Page -> Content -> hook facade -> controller/state -> VM builder -> data hook -> lib domain -> API client -> route handler -> service -> repository
```

- Page: resolve params/search params and mount content or a documented server wrapper.
- Content: call one public hook facade and pass the VM to presentation components.
- Hook facade: compose data, controller, and VM; keep mutation logic in the controller.
- Controller/state: orchestrate mutations, resource sync, transitions, and dirty-state handling.
- VM builder: pure state/resource to UI shape; no hooks, fetches, navigation, or mutations.
- Data hook: fetch resources through shared resource helpers; no state-machine awareness.
- Lib domain: validation, normalization, draft conversion, and read-model helpers.
- API client: all quote-surface fetches go through `lib/quotes/client.ts`.
- Route handler: authenticate, parse, delegate, return envelope.
- Service: domain orchestration and read-model construction.
- Repository: direct Supabase queries and RPC calls only.

## Existing Abstractions To Reuse

- `useDenseQuoteAdminOrchestrator` for dense admin editors with row editing and discard confirmation.
- `useResource` for standard resource loading, refresh, loading, and error state.
- `lib/quotes/client.ts` for quote API calls.
- `lib/quotes/collectionData.ts` for Quote Home/job/version read-model helpers.
- `lib/quotes/productsForm.ts` for product validation, normalization, payloads, and status/family semantics.
- `lib/quotes/defaultsForm.ts` plus `quoteDefaultsPageVm.ts` for Quote Defaults sections.
- `lib/quotes/ratesFlagsDraftAdapters.ts` and `ratesFlagsForm.ts` for rates/flags category behavior.
- `lib/quotes/versionCreation.ts`, `useQuoteVersionWorkflow.ts`, and estimate-collection version services for new version creation.
- Existing CRM UI primitives from `docs/architecture/crm-ui-system.md` for standard CRM screens.

## Where Changes Belong

| Change | Canonical owner |
|---|---|
| Estimator V2 editor/detail/summary behavior | `app/crm/estimates/[id]/v2`, `lib/estimator`, `types/estimator` |
| Quote-facing labels, navigation, and route composition | `app/crm/quotes` |
| Quote Home read models | `lib/quotes/collectionData.ts`, `lib/server/estimate-collection/homeService.ts`, matching repository module |
| Product catalog behavior | `lib/quotes/productsForm.ts`, existing products controller/VM/data flow |
| Quote Defaults fields or sections | `lib/quotes/defaultsForm.ts`, `quoteDefaultsPageVm.ts`, render-only defaults form sections |
| Rates/flags categories | `lib/quotes/ratesFlagsDraftAdapters.ts`, `lib/quotes/ratesFlagsForm.ts` |
| Version creation behavior | `lib/quotes/versionCreation.ts`, `useQuoteVersionWorkflow.ts`, estimate-collection version service |
| Public quote acceptance | `lib/server/estimatePublicPortal.ts`, `lib/server/accepted-estimates/service.ts` |
| Customer send/review flow | estimate-side shared customer-send module |
| Route handler contracts | `app/api/.../route.ts`, shared parser/service/envelope helpers |
| Database access | repository modules under `lib/server/estimate-collection` or the relevant canonical server package |

## Server And API Rules

- Every route handler must call the project-standard org/session guard before business logic.
- Route handlers parse inputs, call service/domain modules, and return standard envelopes:
  - read: `{ data }`
  - successful write: `{ data, notice? }`
  - failure: `{ error }` with a meaningful HTTP status
- Services own orchestration and read models; repositories own raw database access.
- Route handlers, hooks, components, and server wrappers must not import repository modules directly.
- Public quote acceptance preserves the public version snapshot, marks the canonical estimate accepted, sets the estimate version state to `live`, and links `jobs.linked_estimate_id`.

## Rates, Flags, Products, And Settings Boundaries

- Rates/flags category-specific behavior belongs in draft adapters and form validation, not VM switch statements or components.
- Products editor data should use the existing visible rows plus `allKnownData` pattern; do not add a second product cache.
- Defaults sections must extend domain validation/normalization, VM section shape, and render-only form sections together.
- Pricing policy helpers and estimator rollups belong in shared estimator modules, not route-local UI code.

## Quote Home Bootstrap Exception

Quote Home may server-render an initial bootstrap payload so authenticated users land on populated summary/job/version data. This exception is limited:

- `app/crm/quotes/page.tsx` remains a route entrypoint and mounts a clearly named server wrapper.
- The server wrapper may perform auth/session checking and load only initial Quote Home read-model data.
- Bootstrap reads must go through server service aliases, not repositories.
- Bootstrap failure should pass `null` initial data and let client refresh/error handling proceed.
- Do not copy this pattern to other quote pages unless this document is updated with a specific exception.

## Adding Or Extending Features

- Extend an existing abstraction when the behavior matches an established pattern.
- Add a new abstraction only when it removes real duplication, clarifies ownership, or creates a reusable contract the current system lacks.
- New standalone quote admin pages should follow `docs/templates/feature-page-prompt-template.md` plus the layer contract above.
- Prompt, review, and manual QA process material lives outside this architecture doc:
  - `docs/templates/quotes-review-prompt.md`
  - `docs/guides/quotes-estimate-v2-acceptance-checklist.md`

## Test Expectations

- State machines: reducer unit tests.
- Controllers and orchestration hooks: hook/controller tests for mutation flow, resource sync, and transitions.
- VM builders: pure input-to-output unit tests.
- Lib domain validation/adapters: standalone unit tests with input/output pairs.
- Route handlers: auth, envelope shape, validation, and error tests.
- Estimator calculations, pricing policy, and rollups: focused tests in the shared estimator/domain layer.

## Definition Of Done

- Existing shared paths reused or deliberately extended.
- No duplicate quote/estimate abstractions introduced.
- Route handlers remain authenticated, thin, and envelope-compatible.
- DB, API, type, and UI contracts stay aligned.
- Estimate/Quote vocabulary is applied consistently.
- Touched layers have appropriate tests or a stated reason they could not be run.
