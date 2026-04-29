# Estimator Other Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add flexible Estimator V2 Other items that can stand alone or roll into existing estimate totals.

**Architecture:** Extend the existing `estimate_other` path instead of adding a duplicate abstraction. Add typed Other item drafts, calculation helpers, save/load normalization, pricing-summary integration, a compact editor section, and customer-summary rollup behavior.

**Tech Stack:** Next.js, React, TypeScript, Supabase SQL, Node test runner, Vitest where component tests already exist.

---

### Task 1: Domain Types And Calculation

**Files:**
- Create: `lib/estimator/other.ts`
- Create: `lib/estimator/__tests__/other.test.ts`
- Modify: `types/estimator/v2.ts`

- [ ] Write failing tests for fixed, quantity-rate, labor, material/supply, inactive rows, and room totals.
- [ ] Implement `calculateOtherItems` as an engine-compatible output with calculated rows.
- [ ] Export typed Other item drafts and persisted row shapes.

### Task 2: Save Payload And Dirty Snapshot

**Files:**
- Modify: `lib/estimator/v2DraftPayload.ts`
- Modify: `lib/estimator/__tests__/v2DraftPayload.test.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2DirtySnapshot.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2EditorTypes.ts`
- Modify: `lib/estimates/v2/store/estimateV2Store.ts`

- [ ] Write failing tests that Other drafts serialize into snake_case rows and participate in dirty snapshots.
- [ ] Add `otherItems` collections and setters to the editor store.
- [ ] Include Other items in save payloads and snapshots.

### Task 3: Server Persistence And Pricing

**Files:**
- Create: `supabase/sql/073_estimator_v2_other_items.sql`
- Modify: `lib/server/estimate-v2/calculationOrchestration.ts`
- Modify: `lib/server/estimate-v2/loadEstimateAssembly.ts`
- Modify: `lib/server/estimate-v2/saveEstimateOrchestration.ts`
- Modify: `lib/server/estimateGetResponse.ts`
- Modify: `lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts`
- Modify: `lib/server/estimate-v2/__tests__/loadEstimateAssembly.test.ts`

- [ ] Write failing tests for new Other save fields and pricing inclusion.
- [ ] Add additive SQL columns/checks for the existing `estimate_other` table.
- [ ] Normalize and soft-replace Other rows on save.
- [ ] Calculate Other rows and pass an `other` engine into pricing summary.
- [ ] Return enriched Other rows in `inputs.other`.

### Task 4: Editor UI And Actions

**Files:**
- Create: `app/crm/estimates/[id]/v2/_state/useEstimateV2OtherActions.ts`
- Create: `app/crm/estimates/[id]/v2/_components/EstimateV2OtherSection.tsx`
- Create: `app/crm/estimates/[id]/v2/_components/EstimateV2OtherSectionBody.tsx`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2Editor.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2EditorSliceViewModels.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2CalculationDerived.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2Sanitizer.ts`
- Modify: `app/crm/estimates/[id]/v2/_components/EstimateV2EditorScopeSectionStack.tsx`

- [ ] Write failing view-model or component tests for rendering a selected-room Other section.
- [ ] Add actions for add, duplicate, update, move, delete, and include/exclude.
- [ ] Render a compact Other section with room, pricing mode, rollup target, visibility, description, numbers, and notes.

### Task 5: Summary And Customer Output

**Files:**
- Modify: `app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts`
- Modify: `app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts`
- Modify: `app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx`
- Modify: `lib/customer-estimates/inputNormalization.ts`
- Modify: `lib/customer-estimates/scopeExtraction.ts`
- Modify: `lib/customer-estimates/__tests__/buildStages.test.ts`

- [ ] Write failing tests for standalone visible Other rows and hidden rollups into target buckets.
- [ ] Include room-attached Other rows in room summaries.
- [ ] Roll customer-facing hidden items into their selected bucket without exposing the Other label.

### Task 6: Verification

**Files:**
- No new files.

- [ ] Run targeted Node tests for estimator and customer estimate helpers.
- [ ] Run focused component tests for the V2 editor/summary surface if touched tests exist.
- [ ] Run `npm run typecheck`.
