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

---

## Pages and Flows

| Page | Route | Purpose | State Pattern |
|------|-------|---------|---------------|
| Quotes Home | `/crm/quotes` | List jobs & recent versions | Dense orchestration + reducer |
| Create Quote | `/crm/quotes/create?job=X` | Create new version for a job | `useQuoteVersionWorkflow` wrapper |
| Quote Defaults | `/crm/quotes/defaults` | Edit default rates/text | Standard `useEditableResource` |
| Products | `/crm/quotes/products` | Manage product catalog | Dense orchestration + reducer |
| Rates / Flags | `/crm/quotes/rates` | Edit rates, flags, room defaults | Dense orchestration + reducer |
| Quote Detail | `/crm/quotes/[id]` | View/edit quote (Estimator V2) | Estimator V2 custom state |
| Quote Summary | `/crm/quotes/[id]/summary` | View quote summary | Read-only |
| Send Quote | `/crm/quotes/[id]/send` | Customer send flow | Standard flow |

---

## Server Layer

### Repository → Service → Route handler pattern

All quote/estimate-collection server work follows three layers:

**Repository** (`lib/server/estimate-collection/repository.ts`)
- Direct Supabase queries and RPC calls only.
- Each function returns a raw DB row type or `ServiceResult<T>`.
- Never call service logic from inside a repository.

**Service** (`lib/server/estimate-collection/service.ts`)
- Orchestrates repository calls and builds read models.
- Decorates raw rows with related data (jobs, customers, version rollups).
- Owns all domain logic for the collection surface.
- Key service functions:
  - `loadEstimateCollectionBootstrapPayload` — home page initial load
  - `loadEstimateCollectionJobsPayload` — paginated jobs list
  - `loadEstimateCollectionQuoteCreateContextPayload` — job context for create flow

**Route handlers** (`lib/server/estimateCollectionRoutes.ts`)
- Thin handlers: authenticate → parse params → call service → return envelope.
- No business logic inline.

### API routes

```
GET  /api/quotes/home/bootstrap                       — initial home page data
GET  /api/quotes/home/jobs                            — paginated jobs list
GET  /api/quotes/home/jobs/[jobId]/versions           — versions for a job
GET  /api/quotes/home/jobs/[jobId]/create-context     — job context for quote creation
GET  /api/quotes/home/search                          — search jobs/versions/customers
GET/POST/PATCH /api/quotes/products                   — products CRUD
GET/PATCH /api/quotes/rates-flags                     — rates and flags mutations
```

### create-context endpoint

`GET /api/quotes/home/jobs/[jobId]/create-context`

Returns `QuoteCreateJobContextReadModel { job: QuoteCreateJobReadModel }`.

A job is **eligible** for a new quote version if it has a `customer_id`.
The `eligibility` field returns `{ eligible: boolean, reason: 'eligible' | 'missing_customer' }`.

Client: `loadQuoteCreateJobContext(jobId)` in `lib/quotes/client.ts`.

---

## Client Layer

### lib/quotes/ modules

| File | Purpose |
|------|---------|
| `client.ts` | All API fetch functions for the quotes surface |
| `collectionData.ts` | Read model transformations and decorators (~700 lines) |
| `ratesFlagsDraftAdapters.ts` | Category-specific draft editors for rates/flags |
| `ratesFlagsForm.ts` | Rates/flags form validation logic |
| `versionCreation.ts` | Quote version creation helpers |
| `defaultsForm.ts` | Quote defaults form logic |
| `productsForm.ts` | Products form logic |

### Hook architecture

Hooks inside `app/crm/quotes/_hooks/` are organized into four roles:

**Data loading hooks** — resource fetching only, no UI state:
- `useQuoteRatesData` — loads `RatesFlagsPayload`
- `useQuoteProductsData` — loads product list
- `useQuotesHomeData` — loads home bootstrap and paginated jobs
- `useQuoteHomePageResource` — combines the approved Quote Home resources into one facade
- `useQuoteHomePageResources` — thin compatibility wrapper around `useQuoteHomePageResource`
- `useQuoteJobVersions` — paginated versions for a job

**Orchestration hooks** — primary per-page controllers:
- `useQuoteRatesPage` — rates/flags editor (full dense-admin orchestration)
- `useQuoteProductsPage` — products editor
- `useQuotesHomePage` — home page facade
- `useQuoteCreatePage` — quote creation flow
- `useQuoteVersionWorkflow` — version creation + loading

**Shared workflow utilities**:
- `useDenseQuoteAdminOrchestrator` — unsaved-changes guard and discard confirmation
- `useQuoteAdminIntentGuard` — transition blocker for dirty state
- `useDenseQuoteAdminFeedback` — loading/error/success feedback state

**Pure functions (policies and view models)**:
- `quoteCreatePagePolicy` — job eligibility filtering for create page
- `quoteHomePagePolicy` — home page business rules
- `quoteRatesPageVm` — builds the full rates page view model from state
- `quoteRatesPageNavigation` — navigation intent handlers (pure reducer-style)
- `quoteProductsPageVm` — products editor view model

### Dense-admin orchestration pattern

The home, rates, and products pages use a shared dense-admin pattern:

1. Load resource via a data-loading hook.
2. Manage UI state with a `useReducer`-based state machine.
3. Guard transitions with `useDenseQuoteAdminOrchestrator` (unsaved-changes discard dialog).
4. Compute derived state in `useMemo` (validation, dirty flags, filtered rows).
5. Execute mutations (save, archive, delete) as async functions with optimistic response.
6. Build view models via pure VM builder functions.
7. Return a facade object: `{ vm, actions, feedback }`.

### Policy / VM separation

- **Policy files** — pure functions that enforce business rules (eligibility, filtering, navigation intent). No hooks, no state, no side effects.
- **VM builder files** — pure functions that transform workflow state + resource data into the exact shape the component tree needs. Components should not compute display logic themselves.

---

## Data Models

### Core collection types

```typescript
// Canonical row stored in the estimate-collection server layer
EstimateCollectionVersionRow {
  id, job_id, customer_id
  version_name, version_state, version_kind, version_sort_order
  status, created_at, updated_at
}

// Job context returned by create-context API
QuoteCreateJobReadModel {
  id, customer_id, customer_name, customer_address
  title, eligibility: { eligible, reason }
}

// Paginated versions for a job
QuoteJobVersionsPageReadModel {
  job_id, total_versions, items[], limit, next_cursor
}

// Combined bootstrap for home page
QuoteHomeBootstrapReadModel {
  summary, jobs, selected_job_id, selected_job_versions
}
```

### Rates & flags types

```typescript
RatesFlagsPayload {
  categories: RatesFlagsCategory[]
}

RatesFlagsCategory {
  key, tab, group, label
  fields: RatesFlagsFieldDef[]
  rows: RatesFlagsRow[]
}

// Category-specific draft (door, drywall, etc.)
RatesFlagsDraft<TKey>
  — created by RatesFlagsDraftAdapter.createEmptyDraft()
  — each adapter handles one category key
```

---

## Testing

`lib/quotes/__tests__/ratesFlagsParityHelpers.ts` provides shared test helpers:
- `getRatesFlagsParityCategory(key)` — builds a valid test category with all fields populated
- `buildValidRatesFlagsDraft(category)` — generates sample values for each field type
- `buildClientRatesFlagsMutationRequests(key)` — builds create/update/archive request shapes

Use these helpers to verify that draft adapters round-trip correctly through mutation requests, especially when adding new category types.
