# Quotes System Architecture

Read this file before any action on the quotes system: review, build, refactor, or rewrite.

---

## What This System Covers

The quotes system manages five concerns:

1. **Products editor** - admin CRUD for the product catalog.
2. **Rates/Flags editor** - admin CRUD for rate and flag categories.
3. **Quote Home** - list/search view of quote jobs and versions.
4. **Version creation** - workflow for creating quote versions under a job.
5. **Route alias layer** - thin composition routes under `app/crm/quotes/[id]` that alias canonical estimate pages.

---

## Layer Map

Every concern in this system flows through these layers in order. Do not skip layers.

```text
Page                    app/crm/quotes/*/page.tsx
Hook facade             useQuoteProductsPage.ts / useQuoteDefaultsPage.ts / useQuotesHomePage.ts / useQuoteRatesPage.ts / useQuoteCreatePage.ts
Controller              quoteProductsPageController.ts / quoteDefaultsPageController.ts / quoteHomePageController.ts / quoteRatesPageController.ts / quoteCreatePageController.ts
State machine           quoteProductsPageState.ts / quoteRatesPageState.ts / quoteHomePagePolicy.ts
VM builder              quoteProductsPageVm.ts / quoteDefaultsPageVm.ts / quoteHomePageVm.ts / quoteRatesPageVm.ts / quoteCreatePageVm.ts
Data hook               useQuoteProductsData.ts / useQuotesHomeData.ts / useQuoteHomePageResource.ts / useQuoteRatesData.ts
Lib domain              lib/quotes/productsForm.ts / defaultsForm.ts / ratesFlagsForm.ts / ratesFlagsDraftAdapters.ts / collectionData.ts / versionCreation.ts / client.ts
Server service facade   lib/server/estimate-collection/service.ts
Server service modules  homeService.ts / listService.ts / versionService.ts / serviceHelpers.ts / serviceDeps.ts
Repository facade       lib/server/estimate-collection/repository.ts
Repository modules      repositoryReads.ts / repositoryHome.ts / repositorySearch.ts / repositoryVersionCreation.ts / repositoryShared.ts
```

**Layer jobs:**

- **Page** - resolves params, mounts the content component or documented server wrapper, nothing else.
- **Hook facade** - single public API for the page; coordinates controller, VM, and data.
- **Controller** - orchestrates mutations, resource sync, transitions; no UI concerns.
- **State machine** - pure reducer and action types; no side effects.
- **VM builder** - pure function: `(state, resource) -> UI view model`; no mutations.
- **Data hook** - fetches resource data via `useResource`; no state machine awareness.
- **Lib domain** - validation, normalization, draft conversion, read model helpers.
- **API client** (`lib/quotes/client.ts`) - thin fetch wrapper; all quote API calls go through here.
- **Server service** - builds read models and orchestrates repository calls; no raw SQL.
- **Repository** - all DB queries; no business logic.

### Canonical Public Hook Facades

These hook names are the page-level API for quote screens and should remain stable:

- `useQuoteProductsPage`
- `useQuoteDefaultsPage`
- `useQuotesHomePage`
- `useQuoteRatesPage`
- `useQuoteCreatePage`

Internal resource hooks may be split or renamed when a refactor needs it, but pages should continue to consume these facades.

### Quote Home SSR Bootstrap Exception

Quote Home (`/crm/quotes`) is allowed to server-render an initial bootstrap payload so authenticated users can land on populated summary/job/version data without waiting for the client resource hook's first fetch. This is a narrow exception to the default "page only mounts content" rule:

- `app/crm/quotes/page.tsx` stays route-entrypoint-only and mounts a clearly named server wrapper.
- The server wrapper may perform the auth/session check at the page boundary and redirect unauthenticated users to `/login?next=%2Fcrm%2Fquotes`.
- The server wrapper may load only initial Quote Home read-model data, and only through server service aliases exported by `lib/server/estimateCollectionData.ts`. It must not import repositories or bypass `lib/server/estimate-collection/service.ts`.
- Bootstrap load failures are non-blocking for the page render; pass `null` initial data so the client data hook can use its normal refresh/error path.
- All client refreshes, pagination, searches, and mutations still go through `lib/quotes/client.ts` plus the Quote Home data hook/controller layers.
- No other quote page should copy this server bootstrap pattern unless this section is extended with an explicit page-specific reason.

---

## Existing Abstractions

Reuse these before building anything new.

### `useDenseQuoteAdminOrchestrator`

`app/crm/quotes/_hooks/useDenseQuoteAdminOrchestrator.ts`

Generic orchestrator for dense admin editor flows. Handles reducer/ref-backed state sync, discard dialog coordination, and optional resource sync back to state via `getResourceSyncAction`.

Use this for new dense editors in the quotes system. Do not write a second orchestrator for the same pattern.

### Polymorphic Draft Adapter Pattern

`lib/quotes/ratesFlagsDraftAdapters.ts`

Central `getRatesFlagsDraftAdapter(categoryKey)` returns a typed adapter for rate/flag categories. Each adapter provides `rowToDraft`, `formatDraftValue`, `validateDraft`, and `draftToPayload`.

Use this when adding rate/flag categories. Do not add category switch statements in VM builders.

### Resource Sync Pattern

Use `useResource` from shared hooks plus an optional `getResourceSyncAction` callback for standard resource loading and state-machine rehydration after save/refresh cycles.

### VM Builder Pattern

VM builders are pure functions. They take workflow state and resource data, return the exact UI shape the component tree needs, and do not call hooks, mutate inputs, fetch data, or trigger navigation.

### Read Model Architecture

`lib/server/estimate-collection/service.ts` is the public service facade. It re-exports focused service modules:

- `homeService.ts` - Quote Home bootstrap, jobs-page, and search read models.
- `listService.ts` - legacy collection list payload and eligible jobs list.
- `versionService.ts` - job version pages, create-context reads, and version creation.
- `serviceHelpers.ts` - shared pagination, decoration, and logging helpers.
- `serviceDeps.ts` - injectable service dependency bundle for tests.

`lib/server/estimate-collection/repository.ts` is the public repository facade. It re-exports focused query modules:

- `repositoryReads.ts` - collection/version relation reads and rollups.
- `repositoryHome.ts` - home page summary, job page, job context, and versions page queries.
- `repositorySearch.ts` - quote home search queries.
- `repositoryVersionCreation.ts` - version creation writes.
- `repositoryShared.ts` - query fragments and low-level row coercion helpers.

Route handlers and server wrappers call service functions. Services call repositories. Hooks, components, and route handlers never import repository modules directly.

### Products Resource Cleanup

The Products editor loads visible rows through `useQuoteProductsData`, backed by `loadQuoteProducts` in `lib/quotes/client.ts`. The resource intentionally keeps two row sets:

- `data` - the current visible catalog slice for active filters.
- `allKnownData` - rows observed from prior loads or mutations so the editor can keep a selected product stable when filters hide it.

Do not add a second product cache or fetch helper for this page. New product validation, payload normalization, draft snapshots, and family/status semantics belong in `lib/quotes/productsForm.ts`.

### Quote Defaults Structure

Quote Defaults uses a standard editable-resource controller and a sectioned VM:

- Validation, normalization, product option filtering, and section metadata live in `lib/quotes/defaultsForm.ts`.
- `quoteDefaultsPageVm.ts` converts the resource state into `sections` for the form.
- `QuoteDefaultsForm.tsx` renders sections only; it does not own validation rules or product filtering.

Add future defaults sections by extending `quoteDefaultsFormSections`, the domain validation/normalization shape, and the VM section union together. Keep `useQuoteDefaultsPage` as the page facade.

---

## Non-Negotiables

**Route alias ownership:**
`app/crm/quotes/[id]` is a thin composition layer over canonical estimate pages under `app/crm/estimates/[id]/v2`. Never create `_components`, `_state`, `_lib`, or `summary/_*` trees under `quotes/[id]`. New behavior goes in the canonical estimate-side route.

**Estimate vs Quote naming:**

- `Estimate` = canonical internal domain term for shared logic, types, hooks, services.
- `Quote` = user-facing label and route alias only.
- Do not create parallel `quote*` and `estimate*` abstractions for the same concept.

**Auth:** Every route handler must call `requireSessionUserOrg` before any other logic.

**Response envelopes:**

- Read: `{ data }`
- Successful write: `{ data, notice? }`
- Failure: `{ error }` with meaningful HTTP status code

**Validation placement:** Validation and normalization live in `lib/quotes/`. Not in hooks, components, or route handlers.

---

## Anti-Patterns

Flag and fix these:

- Business logic inside page components or content components.
- State duplicated across layers.
- Raw fetch calls bypassing `lib/quotes/client.ts`.
- New state machines or reducers where `useDenseQuoteAdminOrchestrator` already covers the pattern.
- Direct DB calls from hooks, components, routes, or server wrappers.
- New CRM UI primitives when existing CRM components already cover the need.
- Mutation logic in the hook facade.
- Navigation/routing logic in the state machine.

---

## File Ownership Map

| Concern | Canonical location |
|---|---|
| Validation + normalization | `lib/quotes/productsForm.ts`, `ratesFlagsForm.ts`, `defaultsForm.ts` |
| Draft to row conversion | `lib/quotes/ratesFlagsDraftAdapters.ts` |
| Read model service facade | `lib/server/estimate-collection/service.ts` |
| Read model service modules | `homeService.ts`, `listService.ts`, `versionService.ts`, `serviceHelpers.ts` |
| Repository facade | `lib/server/estimate-collection/repository.ts` |
| Repository modules | `repositoryReads.ts`, `repositoryHome.ts`, `repositorySearch.ts`, `repositoryVersionCreation.ts`, `repositoryShared.ts` |
| API calls | `lib/quotes/client.ts` |
| Mutation orchestration | `quoteProductsPageController.ts`, `quoteRatesPageMutations.ts` |
| UI state transitions | `quoteProductsPageState.ts`, `quoteRatesPageState.ts` |
| Navigation logic | `quoteRatesPageNavigation.ts` |
| Derived UI shape | `quoteProductsPageVm.ts`, `quoteDefaultsPageVm.ts`, `quoteHomePageVm.ts`, `quoteRatesPageVm.ts`, `quoteCreatePageVm.ts` |
| Feedback/notice logic | `quoteAdminPageFeedback.ts` |
| Public hook API | `useQuoteProductsPage.ts`, `useQuoteDefaultsPage.ts`, `useQuotesHomePage.ts`, `useQuoteRatesPage.ts`, `useQuoteCreatePage.ts` |
| Home page orchestration | `useQuotesHomePage.ts`, `useQuoteHomePageResource.ts`, `useQuotesHomeData.ts`, `quoteHomePageController.ts` |
| Version creation | `useQuoteVersionCreation.ts`, `lib/quotes/versionCreation.ts` |

---

## Where To Add Future Quote Features

- New Quote Home read models: add transformation helpers in `lib/quotes/collectionData.ts`, service orchestration in `lib/server/estimate-collection/homeService.ts` or `versionService.ts`, and DB queries in the matching repository module. Expose only through `service.ts` and `lib/quotes/client.ts`.
- New product catalog behavior: extend `lib/quotes/productsForm.ts`, then wire the existing `useQuoteProductsData` -> controller -> VM -> `useQuoteProductsPage` flow. Keep API calls in `lib/quotes/client.ts`.
- New Quote Defaults fields or sections: extend `lib/quotes/defaultsForm.ts`, `quoteDefaultsPageVm.ts`, and the render-only `QuoteDefaultsForm.tsx` section handling. Keep validation in the domain module.
- New rates/flags categories: add or extend the adapter in `lib/quotes/ratesFlagsDraftAdapters.ts` and validation in `ratesFlagsForm.ts`; avoid category switch logic in VM builders.
- New quote creation behavior: extend `lib/quotes/versionCreation.ts`, `useQuoteVersionWorkflow.ts`, and `versionService.ts`; keep create-context reads service-to-repository.
- New quote detail or summary behavior: implement in the canonical estimate route under `app/crm/estimates/[id]/v2` or shared estimator modules, then compose from `app/crm/quotes/[id]`.

---

## Adding a New Quotes Page: Canonical Recipe

Follow this exactly when building a new standalone page in the quotes section. Every existing page (Products, Rates, Defaults, Home) was built this way. New pages must match.

### Naming Formula

Replace `Xxx` with your PascalCase feature name (e.g. `Templates`, `Approvals`).

| What | Formula |
|---|---|
| Route folder | `app/crm/quotes/xxx/` (lowercase) |
| Next.js route | `app/crm/quotes/xxx/page.tsx` |
| Content component | `app/crm/quotes/xxx/XxxPageContent.tsx` |
| Presentation folder | `app/crm/quotes/xxx/_xxx/` |
| Hooks folder | `app/crm/quotes/xxx/_hooks/` |
| Public hook facade | `_hooks/useQuoteXxxPage.ts` → export `useQuoteXxxPage` |
| Controller | `_hooks/quoteXxxPageController.ts` |
| State machine (if needed) | `_hooks/quoteXxxPageState.ts` |
| VM builder | `_hooks/quoteXxxPageVm.ts` → export `buildQuoteXxxPageVm` |
| Data hook (if needed) | `_hooks/useQuoteXxxData.ts` |
| Lib domain | `lib/quotes/xxxForm.ts` |
| API route | `app/api/quotes/xxx/route.ts` |

### File-by-File Responsibilities

**`page.tsx`**
- Resolves Next.js params/searchParams only.
- Mounts the content component. Nothing else.
- No business logic, no data fetching, no conditional renders beyond `<Suspense>` or server wrappers.

**`XxxPageContent.tsx`**
- Calls the public hook facade (`useQuoteXxxPage`), passes the VM down to presentation components.
- No logic. No direct hook calls beyond the facade.

**`_xxx/` presentation components**
- Receive VM props. Render only.
- No state, no hooks except `useState` for purely local UI (tooltip open, accordion), no fetches.
- Never call `useQuoteXxxPage` or any controller directly.

**`useQuoteXxxPage.ts`** — public hook facade
- Single export consumed by the content component.
- Coordinates controller, VM builder, and data hook. Returns the VM.
- No mutation logic inline — delegate to controller.
- Stable name; do not rename once a page ships.

**`quoteXxxPageController.ts`**
- Orchestrates mutations, resource syncs, and transitions.
- Calls `lib/quotes/client.ts` for API calls. Never calls `fetch` directly.
- If the page is a dense editor (rows, inline edits, discard flow): use `useDenseQuoteAdminOrchestrator` — do not write a second orchestrator.
- If the page is a simple editable resource (one form, save/cancel): use a lightweight controller with `useResource` and local mutation state.

**`quoteXxxPageState.ts`** — only create if needed
- Pure reducer and action types. No side effects, no imports from hooks or components.
- Required when the page has multi-step transitions, tab/panel selection state, or dual dirty tracking.
- Skip this file entirely for simple pages — use `useState` in the controller instead.

**`quoteXxxPageVm.ts`**
- One exported pure function: `buildQuoteXxxPageVm(state, resource): QuoteXxxPageVm`.
- No hooks, no mutations, no navigation, no side effects.
- All conditional UI logic (disabled states, visible sections, validation messages) lives here — not in components.

**`useQuoteXxxData.ts`** — only create if needed
- Wraps `useResource` for data fetching. No state machine awareness.
- Skip this file if the page uses a server-rendered bootstrap or a simple `useResource` inline in the controller is sufficient.

**`lib/quotes/xxxForm.ts`**
- Validation, normalization, draft↔payload conversion, and enum/type definitions for this feature.
- Pure functions only. No React imports.
- Even if the page is simple, domain types and validation belong here — not inline in the hook.

**`app/api/quotes/xxx/route.ts`**
- Must call `requireSessionUserOrg` before any logic.
- Must return `{ data }`, `{ data, notice? }`, or `{ error }` envelopes with correct HTTP status codes.
- Validation and business logic delegate to `lib/quotes/xxxForm.ts` and service modules — no inline logic.

### Decision Tree: Which Orchestration Abstraction?

```
Does the page have inline-editable rows with a discard confirmation flow?
  YES → useDenseQuoteAdminOrchestrator
  NO  → Does the page have a single form with save/cancel?
          YES → Lightweight controller: useResource + local mutation state
          NO  → Does the page only display read data with no mutations?
                  YES → No controller needed; data hook + VM builder is enough
                  NO  → Talk to the codebase before inventing a new pattern
```

### Reuse Checklist Before Writing New Code

Before creating any new file or abstraction, check these first:

- `useDenseQuoteAdminOrchestrator` — dense editor orchestration
- `useResource` — standard resource loading with loading/error states
- `lib/quotes/client.ts` — all API calls go through here; add a new function, not a new client
- `CrmPageShell`, `CrmPageHeader`, `CrmSectionCard`, `CrmButton`, `CrmNotice`, `CrmChip` — default UI shell
- `lib/quotes/collectionData.ts` — read model helpers for collection/job data
- `quoteAdminPageFeedback.ts` — feedback/notice logic already wired for admin pages

### Test Files to Create

| File | What to test |
|---|---|
| `_hooks/__tests__/quoteXxxPageVm.test.ts` | Pure VM builder: known state input → expected VM output |
| `_hooks/__tests__/quoteXxxPageController.test.ts` | Mutation flows, resource sync, state transitions |
| `_hooks/__tests__/quoteXxxPageState.test.ts` | Reducer: action input → expected state output (only if state machine exists) |
| `lib/quotes/__tests__/xxxForm.test.ts` | Validation and normalization with input/output pairs |
| `app/api/quotes/xxx/__tests__/route.test.ts` | Auth enforcement, envelope shape, error cases |

### What a Minimal New Page Looks Like

```
app/crm/quotes/xxx/
  page.tsx                          ← params → mounts XxxPageContent
  XxxPageContent.tsx                ← useQuoteXxxPage() → passes vm to components
  _xxx/
    XxxHeader.tsx
    XxxBody.tsx
  _hooks/
    useQuoteXxxPage.ts              ← public facade
    quoteXxxPageController.ts       ← mutations + resource sync
    quoteXxxPageVm.ts               ← pure (state, resource) → vm
    __tests__/
      quoteXxxPageVm.test.ts
      quoteXxxPageController.test.ts

lib/quotes/
  xxxForm.ts                        ← types, validation, normalization
  __tests__/
    xxxForm.test.ts

app/api/quotes/xxx/
  route.ts                          ← auth + envelope
```

Add `quoteXxxPageState.ts` and `useQuoteXxxData.ts` only when the decision tree above says you need them.

### Things That Will Fail Review

- Business logic inside `XxxPageContent.tsx` or any `_xxx/` component.
- `fetch()` called directly — use `lib/quotes/client.ts`.
- Validation inline in a hook or component — belongs in `lib/quotes/xxxForm.ts`.
- A new orchestrator hook when `useDenseQuoteAdminOrchestrator` covers the pattern.
- `any` types anywhere.
- Missing auth on the route handler.
- Wrong response envelope shape.
- No tests on a new layer.
- Naming a concept `Quote` when it belongs to shared estimate domain logic.

---

## Known Complexity Hotspots

These are intentional. Do not simplify them away without understanding why they exist.

**Dual dirty tracking (rates):** Rates tracks independent draft and archive-toggle dirty states. Both must be clean before navigation.

**Resource rehydration force flag:** `forceRefreshRehydrate` in rates state bypasses preserve-create-draft logic for archive/reactive flows that require a server round trip before rehydrating selection.

**Intent queueing for discard:** `requestTransition(intent, { changed, run })` queues a pending transition when unsaved changes exist. `confirmDiscard` runs the pending transition later.

**Fallback selection management (products):** `allKnownData` and visible rows are intentionally separate. A selected row can stay known even when filters hide it from the catalog slice.

**`stateRef` alongside `dispatch`:** The orchestrator maintains a ref-backed copy of state for synchronous action creation while still using React dispatch.

---

## Test Expectations Per Layer

Any change to a layer requires tests at that layer.

| Layer | Test type |
|---|---|
| State machine | Unit tests with pure reducer calls |
| Orchestrator hook behavior | Integration-style hook tests using `renderHook` |
| VM builder | Unit tests with known state input to expected view model output |
| Lib domain validation | Standalone unit tests with input/output pairs |
| Polymorphic adapters | Unit tests per adapter for `rowToDraft`, `validateDraft`, and `draftToPayload` |
| New route handler | Route-level tests for auth, envelope shape, and errors |

---

## Definition Of Done

A change is not complete until:

- No duplicate abstractions introduced; existing patterns reused.
- All types explicit; no `any`.
- Every touched layer has test coverage matching the expectations above.
- Response envelopes correct on route handler changes.
- Auth present on route handler changes.
- No business logic added to components or pages.
- Naming follows Estimate (internal) / Quote (user-facing) discipline.

---

## What Aggressive Changes Are Permitted

These are fair game for full rewrites and structural refactors:

- State machines and their action sets.
- Controller and mutation orchestration.
- VM builders.
- Lib domain validation and normalization.
- Hook facades.

These need more care:

- Route handlers: auth and envelope contracts must be preserved.
- `lib/server/estimate-collection/service.ts`: shared across quote consumers.
- DB layer: schema changes require migrations.

---

## References

- `docs/app-architecture-standards.md` - default CRM architecture rules.
- `docs/quote-estimate-architecture.md` - canonical ownership rules for quote vs estimate routes.
- `ARCHITECTURE.md` - top-level estimator V2 design intent.
- `docs/feature-page-prompt-template.md` - build workflow for new features.
