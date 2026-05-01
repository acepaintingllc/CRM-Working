# Quotes Implementation Details

`docs/architecture/quote-estimate-architecture.md` is the canonical architecture source for quote/estimate work. Use this file only when you need implementation detail for quote admin page structure, existing page facades, or test placement.

## Current Quote Surfaces

| Surface | Route | Primary owner |
|---|---|---|
| Quote Home | `/crm/quotes` | `useQuotesHomePage`, `lib/quotes/collectionData.ts`, estimate-collection services |
| Create Quote | `/crm/quotes/create?job=X` | `useQuoteCreatePage`, `useQuoteVersionWorkflow`, `lib/quotes/versionCreation.ts` |
| Quote Defaults | `/crm/quotes/defaults` | `useQuoteDefaultsPage`, `lib/quotes/defaultsForm.ts` |
| Products | `/crm/quotes/products` | `useQuoteProductsPage`, `lib/quotes/productsForm.ts` |
| Rates / Flags | `/crm/quotes/rates` | `useQuoteRatesPage`, `lib/quotes/ratesFlagsDraftAdapters.ts`, `ratesFlagsForm.ts` |
| Quote Detail | `/crm/quotes/[id]` | thin alias to `app/crm/estimates/[id]/v2` |
| Quote Summary | `/crm/quotes/[id]/summary` | thin alias to canonical estimate summary |
| Send Quote | `/crm/quotes/[id]/send` | shared estimate-side customer-send flow |

## Public Hook Facades

Keep these page-level APIs stable:

- `useQuoteProductsPage`
- `useQuoteDefaultsPage`
- `useQuotesHomePage`
- `useQuoteRatesPage`
- `useQuoteCreatePage`

Internal resource hooks, controllers, reducers, and VM builders may change when a refactor needs it, but page content should consume the public facade.

## Existing Quote Abstractions

- `useDenseQuoteAdminOrchestrator`: dense editor orchestration, resource sync, discard confirmation, and dirty-state transition handling.
- `useResource`: standard resource loading with loading/error/refresh state.
- `lib/quotes/client.ts`: client API calls for quote surfaces.
- `quoteAdminPageFeedback.ts`: shared feedback and notice behavior for admin pages.
- `lib/quotes/collectionData.ts`: read-model helpers for Quote Home, jobs, customers, and versions.
- `lib/quotes/productsForm.ts`: product validation, normalization, payloads, and family/status semantics.
- `lib/quotes/defaultsForm.ts`: defaults validation, normalization, product option filtering, and section metadata.
- `lib/quotes/ratesFlagsDraftAdapters.ts`: category-specific rates/flags draft behavior.
- `lib/quotes/ratesFlagsForm.ts`: rates/flags validation and mutation shaping.
- `lib/quotes/versionCreation.ts`: quote version creation helpers.

## New Quote Page Recipe

Use this structure for a new standalone quote admin page. Replace `Xxx` with the feature name.

```text
app/crm/quotes/xxx/
  page.tsx
  XxxPageContent.tsx
  _xxx/
    XxxHeader.tsx
    XxxBody.tsx
  _hooks/
    useQuoteXxxPage.ts
    quoteXxxPageController.ts
    quoteXxxPageVm.ts
    __tests__/
      quoteXxxPageVm.test.ts
      quoteXxxPageController.test.ts

lib/quotes/
  xxxForm.ts
  __tests__/
    xxxForm.test.ts

app/api/quotes/xxx/
  route.ts
```

Add `quoteXxxPageState.ts` only when the page needs multi-step transitions, tab/panel selection state, or dual dirty tracking. Add `useQuoteXxxData.ts` only when a dedicated resource hook improves reuse or clarity.

## File Responsibilities

- `page.tsx`: resolve params/search params and mount content. No business logic.
- `XxxPageContent.tsx`: call `useQuoteXxxPage` and pass VM props to presentation components.
- `_xxx/*`: render-only components. No fetches, mutation orchestration, or domain validation.
- `useQuoteXxxPage.ts`: public page facade. Compose data, controller, and VM.
- `quoteXxxPageController.ts`: mutation orchestration, resource sync, transition handling, and API calls through `lib/quotes/client.ts`.
- `quoteXxxPageState.ts`: pure reducer and actions when a state machine is warranted.
- `quoteXxxPageVm.ts`: pure state/resource to UI view model.
- `useQuoteXxxData.ts`: resource loading only.
- `lib/quotes/xxxForm.ts`: validation, normalization, draft/payload conversion, and feature domain types.
- `app/api/quotes/xxx/route.ts`: auth, parse, delegate, and return the standard envelope.

## Orchestration Choice

```text
Inline-editable rows with discard confirmation?
  yes -> useDenseQuoteAdminOrchestrator
  no  -> single form with save/cancel?
          yes -> lightweight controller using useResource and local mutation state
          no  -> read-only data?
                  yes -> data hook plus VM builder is enough
                  no  -> extend an existing pattern before adding a new one
```

## Layer Test Placement

| Changed layer | Expected test |
|---|---|
| State machine | reducer unit tests |
| Controller/orchestration hook | hook/controller tests for mutation flow, resource sync, transitions |
| VM builder | pure input-to-output unit tests |
| Lib domain form/adapters | validation, normalization, adapter, and payload tests |
| Route handler | auth, envelope shape, validation, and error tests |

## Known Complexity Hotspots

- Rates dual dirty tracking: draft changes and archive-toggle changes must both be clean before navigation.
- Rates `forceRefreshRehydrate`: archive/reactivation flows need a server round trip before rehydrating selection.
- Discard intent queueing: `requestTransition(intent, { changed, run })` queues a pending transition until confirmation.
- Products fallback selection: `allKnownData` keeps selected rows stable when active filters hide them.
- Orchestrator `stateRef`: keeps synchronous action creation aligned with React dispatch.

## References

- `docs/architecture/quote-estimate-architecture.md` - canonical quote/estimate architecture path.
- `docs/architecture/app-architecture-standards.md` - default CRM architecture rules.
- `ARCHITECTURE.md` - top-level Estimator V2 design intent.
- `docs/templates/feature-page-prompt-template.md` - general build workflow for new features.
