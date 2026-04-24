# Quotes System Prompt Files — Design Spec

**Date:** 2026-04-23  
**Status:** Approved  

---

## Goal

Create three markdown files that give Claude everything it needs to review, build, refactor, or rewrite any part of the quotes system — from a single entrypoint.

Usage pattern:
```
Read docs/quotes-system.md and follow it.

Task: [review | build | refactor | rewrite]
Scope: [files / area]
Goal: [what you want]
```

---

## Files

### 1. `docs/quotes-system.md` — Master entrypoint

**Job:** Load context and route to sub-files. Always loads both sub-files regardless of task type.

**Contents:**
- One paragraph describing what the quotes system covers (Products editor, Rates editor, Quote Home, Version Creation, Route alias layer)
- Hard instruction: read `docs/quotes-architecture.md` and `docs/quotes-review-prompt.md` before any action
- Reference to `docs/feature-page-prompt-template.md` — still applies for build tasks; architecture doc supplements it
- Copy/paste starter block with fields: task type, scope, goal, success criteria, out of scope

---

### 2. `docs/quotes-architecture.md` — Architecture context + constraints

**Job:** Teach Claude what correct looks like in the quotes system before it touches or judges anything.

**Sections:**

#### Layer map
Full stack from page down to DB, with canonical file patterns per layer:
- Page (`app/crm/quotes/*/page.tsx`)
- Hook facade (`useQuote*.ts`, `useQuoteProductsPage.ts`, etc.)
- Controller (`quoteProductsPageController.ts`, `quoteRatesPageMutations.ts`, etc.)
- State machine (`quoteProductsPageState.ts`, `quoteRatesPageState.ts`)
- VM builder (`quoteProductsPageVm.ts`, `quoteRatesPageVm.ts`)
- Data hook (`useQuoteProductsData.ts`, `useQuoteRatesData.ts`)
- Lib domain (`lib/quotes/productsForm.ts`, `ratesFlagsForm.ts`, etc.)
- API client (`lib/quotes/client.ts`)
- Server service (`lib/server/estimate-collection/service.ts`)
- Repository (`lib/server/estimate-collection/repository.ts`)

#### Existing abstractions Claude must reuse
Named explicitly so Claude doesn't reinvent them:
- `useDenseQuoteAdminOrchestrator` — generic orchestrator for dense admin editor flows (reducer + discard handling + resource sync)
- Polymorphic draft adapter pattern — `getRatesFlagsDraftAdapter(categoryKey)` handles all 17+ rate/flag category types
- Resource sync pattern — `useResource` + optional `getResourceSyncAction` for syncing fetched data back to state
- VM builder pattern — pure function `state → UI view model`, no side effects
- Read model architecture — server pre-builds structured read models; client never bypasses them with raw queries

#### Non-negotiables
Things that must never change or be duplicated:
- Route alias ownership rule: quote `[id]` routes are thin composition layers over canonical estimate pages — no duplicate `_components`, `_state`, or `_lib` trees under `quotes/[id]`
- `Estimate` vs `Quote` naming discipline: `Estimate` for shared logic/domain modules, `Quote` only for user-facing labels and route aliases
- Auth: all route handlers must use `requireSessionUserOrg`
- Response envelopes: `{ data }`, `{ data, notice? }`, `{ error }` with correct status codes
- Validation lives in `lib/quotes/`, not in hooks or components

#### Anti-patterns to flag
- Business logic in components or pages
- State duplicated across layers
- Raw fetch calls bypassing `lib/quotes/client.ts`
- New state machines or reducers when `useDenseQuoteAdminOrchestrator` already handles the pattern
- Direct DB calls from hooks or components (must go through server service layer)
- New UI primitives when shared CRM components cover the need

#### File ownership map
Which concern belongs in which layer:
- Validation and normalization → `lib/quotes/`
- Draft ↔ row conversion → `lib/quotes/ratesFlagsDraftAdapters.ts`
- Read model building → `lib/server/estimate-collection/service.ts`
- DB queries → `lib/server/estimate-collection/repository.ts`
- Mutation orchestration → controller layer (`quoteProductsPageController.ts`, `quoteRatesPageMutations.ts`)
- UI state transitions → state machine (`quoteProductsPageState.ts`, `quoteRatesPageState.ts`)
- Derived UI shape → VM builder (`quoteProductsPageVm.ts`, `quoteRatesPageVm.ts`)
- Public hook API → hook facade (`useQuoteProductsPage.ts`, `useQuoteRatesPage.ts`)
- API calls → `lib/quotes/client.ts`

#### Known complexity hotspots
Areas with intentional complexity — understand before changing:
- **Dual dirty tracking (Rates):** `draft` changes and `draftActive` (archive toggle) are tracked independently with separate snapshots. Both must be clean before navigation. This is intentional — archive state is first-class, not embedded in the draft.
- **Resource rehydration force flag:** `forceRefreshRehydrate` in rates state bypasses "preserve create draft" logic. Used for archive/reactive flows that require a server round-trip before rehydrating selection. Do not remove.
- **Intent queueing for discard:** `requestTransition` queues a pending transition when unsaved changes exist. Confirmed later via `confirmDiscard`. This is the unsaved-change protection mechanism — not dead code.
- **Fallback selection management:** `allKnownData` vs `visibleRows` split in products. When a selected row is filtered out, it stays "known" but not "visible." The "Selected product is hidden" notice is intentional UX, not a bug.
- **`stateRef` alongside `dispatch`:** Orchestrator maintains a ref-backed copy of state for synchronous action creation while still using React dispatch. Required because action creators need to inspect current state synchronously.

#### Test expectations per layer
- State machine transitions → unit tests (pure reducer calls)
- Orchestrator hook behavior → integration-style hook tests (`renderHook`)
- Lib domain validation → standalone unit tests
- VM builder output → unit tests against known state inputs
- Any new route handler → route-level tests covering auth, envelope, and error cases

#### Definition of done
Any change (review-driven or feature) is not complete until:
- No duplicate abstractions introduced
- All types explicit — no `any`
- All layers touched have test coverage matching the expectations above
- Response envelopes are correct on any route handler changes
- Auth is present on any new route handler
- No business logic added to components or pages

#### What aggressive changes are permitted
- Full rewrites of state machines, controllers, VM builders, and lib domain logic
- Structural refactors of hook facades
- Breaking up files that have grown too large
- Consolidating duplicated patterns into shared abstractions

More care required for:
- Route handlers (auth + envelope contracts)
- DB layer (migration impact)
- `lib/server/estimate-collection/` (shared server service — changes affect all quote consumers)

---

### 3. `docs/quotes-review-prompt.md` — Scoring rubric

**Job:** Drive code reviews of the quotes system. Scores current state, identifies rewrite targets, produces ready-to-paste fix prompts.

**Sections:**

#### Preamble
- Read the actual current code files before scoring — no assumptions about prior state
- Aggressive stance: rewrites and full refactors are on the table
- "Fine for now" is only valid if the code genuinely does not block future features

#### Scoring categories (1–10)
Same 10 categories as original:
1. Maintainability
2. Debuggability
3. Readability / Clarity
4. Efficiency / Performance
5. Scalability / Extensibility
6. Separation of Concerns
7. Reusability
8. Consistency
9. Testability
10. Resilience / Stability

Scale: 1–3 poor, 4–5 weak, 6–7 decent, 8–9 strong, 10 excellent.

#### Quotes-system-specific review lens
Beyond the generic app code checks, also flag:
- VM builders doing more than converting state to UI shape
- State machine actions that could be consolidated
- Controller/hook boundary violations (mutation logic bleeding into hook facade)
- Polymorphic adapter completeness — any rate/flag category missing a full adapter
- Read model bypass — hooks or components calling DB or API directly instead of through service layer
- Route alias violations — any logic duplicated between `quotes/[id]` and canonical estimate routes
- `useDenseQuoteAdminOrchestrator` pattern not used where it applies
- Validation logic outside `lib/quotes/`

#### Output format
1. **Executive Summary** — plain English health summary
2. **Scorecard** — table: Category | Score /10 | Why
3. **Biggest Strengths** — top 3–5 specific things done well
4. **Biggest Risks / Weak Points** — top 3–7 problems, prioritized by actual impact
5. **Specific Improvement Opportunities** — grouped: Quick wins / Medium-effort / Larger structural
6. **Stability Risk Callout** — fragile, tightly coupled, or regression-prone areas
7. **Final Verdict** — Overall score /10, Ship confidence (High/Medium/Low), Refactor priority (High/Medium/Low)
8. **Rewrite Targets** (new) — uncapped ranked list, ordered by: severity of problem + how much it blocks future features

#### Rewrite target format
Each target:
```
## Rewrite Target #N: [area name]
**Why:** [2-3 sentences on what's broken and why it matters]
**Severity:** High / Medium
**Blocks:** [what future work this makes harder]

### Ready-to-use prompt:
Read docs/quotes-system.md and follow it.

Task: rewrite
Scope: [specific files]
Goal: [what the rewrite should achieve]
Success criteria:
- ...
Out of scope:
- ...
```

#### Review rules
- Do not focus on tiny formatting issues unless they affect clarity
- Do not praise things vaguely — be specific
- Do not invent problems — only mention issues supported by the actual code
- Prefer practical software-engineering concerns over theory
- Be honest if something is "fine for now" vs truly strong
- Flag over-engineering just as much as under-structure
- Consider: future changes, edge cases, onboarding another dev, bug fixing
- If something cannot be judged from provided files alone, say so

---

## Constraints

- All three files live in `docs/`
- Master file stays under 60 lines
- Architecture and review files can be as long as they need to be
- Files should be written for Claude as the reader — instructional, not descriptive
