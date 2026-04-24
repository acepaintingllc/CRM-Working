# Quotes System Architecture

Read this file before any action on the quotes system — review, build, refactor, or rewrite.

---

## What this system covers

The quotes system manages five concerns:

1. **Products editor** — admin CRUD for the product catalog (families, subtypes, costs)
2. **Rates/Flags editor** — admin CRUD for 17+ rate and flag categories (production rates, unit rates, multipliers, access fees, etc.)
3. **Quote Home** — list/search view of all quotes and versions, tied to jobs
4. **Version creation** — workflow for creating new quote versions under a job
5. **Route alias layer** — thin composition routes under `app/crm/quotes/[id]` that alias to canonical estimate pages

---

## Layer map

Every concern in this system flows through these layers in order. Do not skip layers.

```
Page                    app/crm/quotes/*/page.tsx
Hook facade             useQuoteProductsPage.ts / useQuoteRatesPage.ts / useQuotesHomePage.ts
Controller              quoteProductsPageController.ts / quoteRatesPageMutations.ts
State machine           quoteProductsPageState.ts / quoteRatesPageState.ts
VM builder              quoteProductsPageVm.ts / quoteRatesPageVm.ts
Data hook               useQuoteProductsData.ts / useQuoteRatesData.ts
Lib domain              lib/quotes/productsForm.ts / ratesFlagsForm.ts / collectionData.ts / client.ts
Server service          lib/server/estimate-collection/service.ts
Repository              lib/server/estimate-collection/repository.ts
```

**Layer jobs:**
- **Page** — resolves params, mounts content component, nothing else
- **Hook facade** — single public API for the page; coordinates controller + VM + data
- **Controller** — orchestrates mutations, resource sync, transitions; no UI concerns
- **State machine** — pure reducer + action types; no side effects
- **VM builder** — pure function: `(state, resource) → UI view model`; no mutations
- **Data hook** — fetches resource data via `useResource`; no state machine awareness
- **Lib domain** — validation, normalization, draft conversion, read model helpers
- **API client** (`lib/quotes/client.ts`) — thin fetch wrapper; all API calls go through here
- **Server service** — builds read models, orchestrates DB queries; no raw SQL
- **Repository** — all DB queries; no business logic

---

## Existing abstractions — reuse before building new

These exist. Do not reinvent them.

### `useDenseQuoteAdminOrchestrator`
`app/crm/quotes/_hooks/useDenseQuoteAdminOrchestrator.ts`

Generic orchestrator for dense admin editor flows. Handles:
- Reducer + ref-backed state sync (allows synchronous action creation)
- Discard dialog coordination (unsaved change protection)
- Optional resource sync back to state via `getResourceSyncAction`

Use this for any new dense editor in the quotes system. Do not write a new orchestrator.

### Polymorphic draft adapter pattern
`lib/quotes/ratesFlagsDraftAdapters.ts`

Central `getRatesFlagsDraftAdapter(categoryKey)` returns a typed adapter for any of the 17+ rate/flag categories. Each adapter provides: `rowToDraft`, `formatDraftValue`, `validateDraft`, `draftToPayload`.

Use this when adding new rate/flag categories. Do not add switch statements in VM builders.

### Resource sync pattern
`useResource` from shared hooks + optional `getResourceSyncAction` callback

Standard pattern for loading data and optionally syncing fetched data back into a state machine after save/refresh cycles.

### VM builder pattern
Pure function `(state, resourceData) → view model`. No hooks, no side effects, no mutations. Called inside the hook facade. Returns all derived UI shape.

### Read model architecture
`lib/server/estimate-collection/service.ts` pre-builds structured read models for the home page (Summary, RecentActivity, EligibleJobs, JobVersions). Never bypass these with raw queries from hooks or components.

---

## Non-negotiables

**Route alias ownership:**
`app/crm/quotes/[id]` is a thin composition layer over canonical estimate pages under `app/crm/estimates/[id]/v2`. Never create `_components`, `_state`, `_lib`, or `summary/_*` trees under `quotes/[id]`. New behavior goes in the canonical estimate-side route.

**Estimate vs Quote naming:**
- `Estimate` = canonical internal domain term for shared logic, types, hooks, services
- `Quote` = user-facing label and route alias only
- Do not create parallel `quote*` and `estimate*` abstractions for the same concept

**Auth:** Every route handler must call `requireSessionUserOrg` before any other logic.

**Response envelopes:**
- Read: `{ data }`
- Successful write: `{ data, notice? }`
- Failure: `{ error }` with meaningful HTTP status code

**Validation placement:** Validation and normalization live in `lib/quotes/`. Not in hooks. Not in components. Not in route handlers.

---

## Anti-patterns — flag and fix these

- Business logic inside page components or content components
- State duplicated across layers
- Raw fetch calls bypassing `lib/quotes/client.ts`
- New state machines or reducers where `useDenseQuoteAdminOrchestrator` already covers the pattern
- Direct DB calls from hooks or components (must go through service → repository)
- New CRM UI primitives when `CrmPageShell`, `CrmSectionCard`, `CrmButton`, `CrmChip`, `CrmNotice`, `CrmPageHeader` already cover the need
- Mutation logic in the hook facade (belongs in the controller layer)
- Navigation/routing logic in the state machine (belongs in navigation helpers)

---

## File ownership map

| Concern | Canonical location |
|---|---|
| Validation + normalization | `lib/quotes/productsForm.ts`, `ratesFlagsForm.ts`, `defaultsForm.ts` |
| Draft ↔ row conversion | `lib/quotes/ratesFlagsDraftAdapters.ts` |
| Read model building | `lib/server/estimate-collection/service.ts` |
| DB queries | `lib/server/estimate-collection/repository.ts` |
| API calls | `lib/quotes/client.ts` |
| Mutation orchestration | `quoteProductsPageController.ts`, `quoteRatesPageMutations.ts` |
| UI state transitions | `quoteProductsPageState.ts`, `quoteRatesPageState.ts` |
| Navigation logic | `quoteRatesPageNavigation.ts` |
| Derived UI shape | `quoteProductsPageVm.ts`, `quoteRatesPageVm.ts` |
| Feedback/notice logic | `quoteAdminPageFeedback.ts` |
| Public hook API | `useQuoteProductsPage.ts`, `useQuoteRatesPage.ts` |
| Home page orchestration | `useQuotesHomePage.ts`, `useQuotesHomeData.ts` |
| Version creation | `useQuoteVersionCreation.ts`, `lib/quotes/versionCreation.ts` |

---

## Known complexity hotspots — understand before changing

These are intentional. Do not simplify them away without understanding why they exist.

**Dual dirty tracking (rates):**
Rates tracks two independent dirty states: `draft` changes (against `cleanSnapshot`) and `draftActive` (archive toggle, against `cleanDraftActive`). Both must be clean before navigation. Archive state is first-class — it is not embedded in the draft.

**Resource rehydration force flag:**
`forceRefreshRehydrate` in rates state bypasses "preserve create draft" logic. Used for archive/reactive flows that require a server round-trip before rehydrating selection. Cleared after reconciliation.

**Intent queueing for discard:**
`requestTransition(intent, { changed, run })` queues a pending transition when unsaved changes exist. Confirmed later via `confirmDiscard`. This is the unsaved-change protection mechanism — not dead code.

**Fallback selection management (products):**
`allKnownData` vs `visibleRows` split. When a selected row is filtered out, it stays "known" but not "visible." The "Selected product is hidden" notice is intentional UX behavior.

**`stateRef` alongside `dispatch`:**
The orchestrator maintains a ref-backed copy of state for synchronous action creation while still using React dispatch. Required because action creators need to inspect current state synchronously.

---

## Test expectations per layer

Any change to a layer requires tests at that layer.

| Layer | Test type |
|---|---|
| State machine | Unit tests — pure reducer calls with known inputs/outputs |
| Orchestrator hook behavior | Integration-style hook tests using `renderHook` |
| VM builder | Unit tests — known state input → expected view model output |
| Lib domain validation | Standalone unit tests — input/output pairs |
| Polymorphic adapters | Unit tests per adapter — rowToDraft, validateDraft, draftToPayload |
| New route handler | Route-level tests — auth present, envelope shape, error cases |

---

## Definition of done

A change is not complete until:

- [ ] No duplicate abstractions introduced — existing patterns reused
- [ ] All types explicit — no `any`
- [ ] Every touched layer has test coverage matching the expectations above
- [ ] Response envelopes correct on any route handler changes
- [ ] Auth present on any new route handler
- [ ] No business logic added to components or pages
- [ ] Naming follows Estimate (internal) / Quote (user-facing) discipline

---

## What aggressive changes are permitted

These are fair game for full rewrites and structural refactors:
- State machines and their action sets
- Controller and mutation orchestration
- VM builders
- Lib domain validation and normalization
- Hook facades

These need more care:
- Route handlers — auth and envelope contracts must be preserved
- `lib/server/estimate-collection/service.ts` — shared across all quote consumers
- DB layer — schema changes require migrations

---

## References

- `docs/app-architecture-standards.md` — default CRM architecture rules
- `docs/quote-estimate-architecture.md` — canonical ownership rules for quote vs estimate routes
- `ARCHITECTURE.md` — top-level estimator V2 design intent
- `docs/feature-page-prompt-template.md` — build workflow for new features
