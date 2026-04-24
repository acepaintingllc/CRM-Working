# Quotes System Prompt Files — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three markdown files (`docs/quotes-architecture.md`, `docs/quotes-review-prompt.md`, `docs/quotes-system.md`) that give Claude everything it needs to review, build, refactor, or rewrite any part of the quotes system from a single entrypoint.

**Architecture:** Three files with one job each. Master file (`quotes-system.md`) is the entrypoint — always loads both sub-files. Architecture file teaches correct patterns. Review file drives scoring and produces rewrite prompts.

**Tech Stack:** Markdown only. No code changes.

---

### Task 1: Write `docs/quotes-architecture.md`

**Files:**
- Create: `docs/quotes-architecture.md`

- [ ] **Step 1: Create the file with the full content below**

Write `docs/quotes-architecture.md` with exactly this content:

```markdown
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

## Existing abstractions you must reuse

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
`lib/server/estimate-collection/service.ts` pre-builds structured read models for the home page (Summary, RecentActivity, EligibleJobs, JobVersions). The client never bypasses these with raw queries.

---

## Non-negotiables

These rules are not up for debate.

**Route alias ownership:**
`app/crm/quotes/[id]` is a thin composition layer over canonical estimate pages under `app/crm/estimates/[id]/v2`. Never create `_components`, `_state`, `_lib`, or `summary/_*` trees under `quotes/[id]`. If new behavior is needed, it goes in the estimate-side canonical route.

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
- State duplicated across layers (e.g. derived data recomputed in both VM and component)
- Raw fetch calls bypassing `lib/quotes/client.ts`
- New state machines or reducers where `useDenseQuoteAdminOrchestrator` already covers the pattern
- Direct DB calls from hooks, components, or API clients (must go through service → repository)
- New CRM UI primitives when `CrmPageShell`, `CrmSectionCard`, `CrmButton`, `CrmChip`, `CrmNotice`, `CrmPageHeader` already cover the need
- Mutation logic bleeding into the hook facade (belongs in the controller layer)
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
The orchestrator maintains a ref-backed copy of state for synchronous action creation while still using React dispatch. Required because action creators need to inspect current state synchronously before dispatching.

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

A change is not done until:

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
- `lib/server/estimate-collection/service.ts` — shared across all quote consumers; changes affect the whole system
- DB layer — any schema changes require migrations

---

## References

- `docs/app-architecture-standards.md` — default CRM architecture rules
- `docs/quote-estimate-architecture.md` — canonical ownership rules for quote vs estimate routes
- `ARCHITECTURE.md` — top-level estimator V2 design intent
```

- [ ] **Step 2: Verify the file was created**

Confirm `docs/quotes-architecture.md` exists and opens without errors.

- [ ] **Step 3: Commit**

```bash
git add docs/quotes-architecture.md
git commit -m "docs: add quotes system architecture reference file"
```

---

### Task 2: Write `docs/quotes-review-prompt.md`

**Files:**
- Create: `docs/quotes-review-prompt.md`

- [ ] **Step 1: Create the file with the full content below**

Write `docs/quotes-review-prompt.md` with exactly this content:

```markdown
# Quotes System — Code Review Prompt

## Before you score anything

1. Read the actual current files listed in scope. Do not assume prior state or what has already been fixed.
2. Base every score and every rewrite target on what you observe in the code right now.
3. Aggressive stance: rewrites and full refactors are on the table. Call them out when warranted.
4. "Fine for now" is only a valid position if the code genuinely does not block future features or introduce real risk.

---

## Score categories

Score each from **1–10**:

- **1–3** = poor / risky
- **4–5** = weak with notable issues
- **6–7** = decent but needs improvement
- **8–9** = strong
- **10** = excellent / hard to materially improve

Use the full range. Do not inflate scores to be kind.

1. **Maintainability** — how easy this code will be to safely update over time
2. **Debuggability** — how easy it is to trace bugs, isolate failures, and reason about behavior
3. **Readability / Clarity** — how easy it is for another developer to understand quickly
4. **Efficiency / Performance** — obvious render, query, state, computation, or network inefficiencies
5. **Scalability / Extensibility** — how well this holds up as features, rules, and edge cases grow
6. **Separation of Concerns** — whether UI, business logic, data access, derived state, and utilities are cleanly separated
7. **Reusability** — whether logic and UI patterns are reusable without duplication
8. **Consistency** — whether patterns, naming, structure, and conventions are applied consistently
9. **Testability** — how easy this area would be to test well
10. **Resilience / Stability** — how likely this code is to break under edge cases, missing data, async issues, invalid state, or future refactors

---

## Quotes-system-specific review lens

Beyond general app concerns, explicitly check for:

- **VM builders doing too much** — a VM builder should only convert state to UI shape; flag any that make decisions, call hooks, or manage side effects
- **State machine action bloat** — flag action sets that could be consolidated; actions that do too much per dispatch
- **Controller/hook boundary violations** — mutation logic in the hook facade; orchestration logic that belongs in the controller
- **Polymorphic adapter completeness** — any rate/flag category that does not have a full adapter (`rowToDraft`, `formatDraftValue`, `validateDraft`, `draftToPayload`)
- **Read model bypass** — hooks or components making API or DB calls that should go through the service layer and read model architecture
- **Route alias violations** — any logic duplicated between `app/crm/quotes/[id]` and canonical estimate routes under `app/crm/estimates/[id]/v2`
- **`useDenseQuoteAdminOrchestrator` pattern not applied** — new dense editors written from scratch when the generic orchestrator covers them
- **Validation outside `lib/quotes/`** — field validation or normalization logic placed in hooks, components, or route handlers instead of the domain module

Also apply the standard app code lens:

- Components doing too much
- State that is duplicated or hard to trace
- Business rules mixed into UI
- Prop drilling / overly tangled dependencies
- Weak naming
- Hidden assumptions
- Hardcoded values that should be centralized
- Brittle conditional rendering
- Derived data recomputed in messy ways
- Difficult async flows
- Poor empty / error / loading handling
- Forms and user input complexity
- Places where future feature additions will get messy fast

---

## Output format

Use this exact structure:

### 1) Executive Summary

Short plain-English summary of the overall health of this area.

### 2) Scorecard

| Category | Score /10 | Why |
|---|---|---|
| Maintainability | | |
| Debuggability | | |
| Readability / Clarity | | |
| Efficiency / Performance | | |
| Scalability / Extensibility | | |
| Separation of Concerns | | |
| Reusability | | |
| Consistency | | |
| Testability | | |
| Resilience / Stability | | |

### 3) Biggest Strengths

Top 3–5 specific things this code does well. Be concrete — name files, patterns, decisions.

### 4) Biggest Risks / Weak Points

Top 3–7 problems hurting this area most. Prioritize by actual impact, not surface area.

### 5) Specific Improvement Opportunities

Grouped by effort:

**Quick wins** (< 1 hour each):
- Problem → why it matters → what change to make

**Medium-effort improvements** (hours to a day):
- Problem → why it matters → what change to make

**Larger structural improvements** (days):
- Problem → why it matters → what change to make

### 6) Stability Risk Callout

Call out anything fragile, tightly coupled, overly complex, or likely to cause regressions. Be specific about which files and why.

### 7) Final Verdict

- **Overall score /10**
- **Ship confidence: High / Medium / Low**
- **Refactor priority: High / Medium / Low**

### 8) Rewrite Targets

Uncapped ranked list ordered by: severity of problem + how much it blocks future features.

For each target:

---

#### Rewrite Target #N: [area name]

**Why:** 2–3 sentences on what is broken and why it matters.

**Severity:** High / Medium

**Blocks:** What future work this makes harder or more risky.

**Ready-to-use prompt:**

```
Read docs/quotes-system.md and follow it.

Task: rewrite
Scope: [specific files]
Goal: [what the rewrite should achieve]

Success criteria:
- [criterion]
- [criterion]

Out of scope:
- [non-goal]
```

---

## Review rules

- Do not focus on tiny formatting issues unless they affect clarity
- Do not praise things vaguely — be specific and name the file or pattern
- Do not invent problems — only mention issues supported by what you actually read
- Prefer practical software-engineering concerns over theory
- Flag over-engineering just as much as under-structure
- If something cannot be judged from the provided files alone, say so clearly
- Consider: future changes, edge cases, onboarding another developer, and bug-fixing speed
```

- [ ] **Step 2: Verify the file was created**

Confirm `docs/quotes-review-prompt.md` exists and opens without errors.

- [ ] **Step 3: Commit**

```bash
git add docs/quotes-review-prompt.md
git commit -m "docs: add quotes system review prompt"
```

---

### Task 3: Write `docs/quotes-system.md`

**Files:**
- Create: `docs/quotes-system.md`

- [ ] **Step 1: Create the file with the full content below**

Write `docs/quotes-system.md` with exactly this content:

```markdown
# Quotes System — Entrypoint

This file is the entrypoint for all quotes system work. It covers the Products editor, Rates/Flags editor, Quote Home, Version Creation workflow, and the route alias layer over canonical estimate pages.

## Required reading — always load both before any action

1. Read `docs/quotes-architecture.md` — architecture context, layer map, existing abstractions, non-negotiables, anti-patterns, file ownership, and what changes are permitted.
2. Read `docs/quotes-review-prompt.md` — scoring rubric, quotes-specific review lens, and rewrite target format.

For build and refactor tasks, also read `docs/feature-page-prompt-template.md`. The architecture file supplements it with quotes-specific rules.

---

## How to use this file

Point Claude at this file, then describe your task:

```
Read docs/quotes-system.md and follow it.

Task: [review | build | refactor | rewrite]
Scope: [files or area — e.g. "quoteProductsPageController.ts and quoteProductsPageState.ts"]
Goal: [what you want — e.g. "score the current state and give me rewrite targets" or "add archive support to products"]

Success criteria:
- [criterion]
- [criterion]

Out of scope:
- [non-goal]
```

For a review, Claude will read the scoped files, score them, and produce a ranked list of rewrite targets with ready-to-paste prompts.

For a build/refactor/rewrite, Claude will read the architecture constraints, identify reuse candidates, and implement with minimal scope.
```

- [ ] **Step 2: Verify the file was created**

Confirm `docs/quotes-system.md` exists and opens without errors.

- [ ] **Step 3: Commit**

```bash
git add docs/quotes-system.md
git commit -m "docs: add quotes system master entrypoint"
```

---

### Task 4: Smoke test the entrypoint

**Files:**
- Read: `docs/quotes-system.md`, `docs/quotes-architecture.md`, `docs/quotes-review-prompt.md`

- [ ] **Step 1: Read all three files top to bottom**

Open and read each file. Check:
- `quotes-system.md` references both sub-files by exact path
- `quotes-architecture.md` references `docs/feature-page-prompt-template.md`, `docs/app-architecture-standards.md`, `docs/quote-estimate-architecture.md`, and `ARCHITECTURE.md` at the bottom
- `quotes-review-prompt.md` ends with the review rules section
- No broken markdown (unclosed code fences, malformed tables)
- All file paths named in the architecture file match actual files in the repo

- [ ] **Step 2: Verify cross-references exist**

Confirm these files exist:
```bash
ls docs/feature-page-prompt-template.md
ls docs/app-architecture-standards.md
ls docs/quote-estimate-architecture.md
ls ARCHITECTURE.md
```

Expected: all four exist.

- [ ] **Step 3: Commit if any fixes were made**

If you fixed anything in Step 1 or 2:
```bash
git add docs/quotes-system.md docs/quotes-architecture.md docs/quotes-review-prompt.md
git commit -m "docs: fix cross-references in quotes system prompt files"
```

If no fixes were needed, skip this step.
```
