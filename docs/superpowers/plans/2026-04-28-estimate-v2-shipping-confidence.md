# Estimate V2 Shipping Confidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise Quotes / Estimate V2 shipping confidence to high before drywall and door scopes are implemented.

**Architecture:** Keep fixes in the existing canonical Estimate V2 path under `app/crm/estimates/[id]/v2`, shared estimator logic under `lib/estimator`, and server save/load orchestration under `lib/server/estimate-v2`. The plan focuses on closing known test-path gaps, preventing V2 scope-specific save regressions, and proving editor -> save -> load -> summary -> customer-send parity for current and future scope engines.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Node test runner, Vitest, React Testing Library.

---

## Scope And File Map

- Modify `package.json`: include nested `lib/server/estimate-v2/__tests__` in `npm run test:node`.
- Modify `lib/server/estimate-v2/saveEstimateOrchestration.ts`: persist V2 room roster for any V2 scope save, not just wall saves.
- Modify `lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts`: fix stale room metadata mock and add ceiling-only / trim-only save coverage.
- Modify `lib/server/estimate-v2/__tests__/saveLoadContract.test.ts`: keep metadata contract coverage and make sure it is covered by default test command.
- Modify or add `lib/estimator/__tests__/estimateV2ScopeContracts.test.ts`: lock excluded scope, override, and future engine assumptions.
- Modify or add `lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts`: keep explicit engine-kind pricing coverage for drywall and doors.
- Modify or add `lib/server/customer-send/__tests__/contextCalculations.test.ts`: prove customer send uses explicit pricing engine kinds.
- Modify or add `app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx`: keep visible Paint & Supplies rows reconciled with section total.
- Use `docs/quotes-estimate-v2-acceptance-checklist.md` as manual QA once automated checks are green.

---

### Task 1: Wire Nested Estimate V2 Server Tests Into Default Node Test Command

**Files:**
- Modify: `package.json`
- Test: `lib/server/estimate-v2/__tests__/saveLoadContract.test.ts`
- Test: `lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts`
- Test: `lib/server/estimate-v2/__tests__/loadEstimateAssembly.test.ts`

- [ ] **Step 1: Update `test:node` so nested Estimate V2 tests run every time**

Replace the `test:node` script with this shape:

```json
"test:node": "set NEXT_PUBLIC_SUPABASE_URL=http://localhost&& set SUPABASE_SERVICE_ROLE_KEY=dev-key&& set NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key&& node --experimental-specifier-resolution=node --experimental-test-isolation=none --test \"lib/{client,crm,customer-estimates,customers,estimator,jobs,quotes,server}/__tests__/*.test.ts\" \"lib/server/estimate-v2/__tests__/*.test.ts\"&& vitest run --config vitest.node.config.ts lib/server/estimate-collection/__tests__/repository.test.ts lib/server/estimate-collection/__tests__/service.test.ts lib/server/customer-send/__tests__/contextCalculations.test.ts lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts lib/server/estimate-v2/__tests__/loadEstimateAssembly.test.ts"
```

Keep the Node runner for `.test.ts` files that use `node:test`, and Vitest for the nested files that use `vi.mock`.

- [ ] **Step 2: Run default node tests and verify the current failure is exposed**

Run:

```powershell
npm.cmd run test:node
```

Expected before Task 2:

```text
FAIL lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts
maps extracted V2 wall seams through calculation and persistence boundaries
```

- [ ] **Step 3: Confirm no duplicate test execution creates false failures**

If a file is included by both Node runner and Vitest, move it to only one side. The intended split is:

```text
node --test:
  lib/server/estimate-v2/__tests__/saveLoadContract.test.ts

vitest:
  lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts
  lib/server/estimate-v2/__tests__/loadEstimateAssembly.test.ts
```

If needed, replace the Node glob with explicit nested Node test paths instead of `*.test.ts`.

---

### Task 2: Fix The Stale Room Metadata Mock

**Files:**
- Modify: `lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts`

- [ ] **Step 1: Update the mocked V2 room row in the wall seam test**

Find the mock in `maps extracted V2 wall seams through calculation and persistence boundaries` and change it from:

```ts
mocks.buildV2RoomRosterRows.mockReturnValue([{ room_id: 'R001', room_name: 'Living' }])
```

to:

```ts
mocks.buildV2RoomRosterRows.mockReturnValue([
  {
    room_id: 'R001',
    room_name: 'Living',
    room_type_id: null,
    wall_complexity_id: null,
    position: 0,
    notes: null,
    length_in: null,
    width_in: null,
    wallheight_in: null,
    condition_selections: null,
  },
])
```

- [ ] **Step 2: Run the targeted Vitest nested server tests**

Run:

```powershell
npx.cmd vitest run --config vitest.node.config.ts lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts lib/server/estimate-v2/__tests__/loadEstimateAssembly.test.ts
```

Expected:

```text
Test Files  2 passed
Tests       5 passed
```

---

### Task 3: Persist V2 Rooms For Any V2 Scope Save

**Files:**
- Modify: `lib/server/estimate-v2/saveEstimateOrchestration.ts`
- Modify: `lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts`

- [ ] **Step 1: Add a combined V2 save flag**

In `saveEstimateV2Inputs`, after `useV2TrimSave`, add:

```ts
const useAnyV2ScopeSave = useV2WallsSave || useV2CeilingsSave || useV2TrimSave
```

Use this flag in `useStructuredTransactionalSave`:

```ts
const useStructuredTransactionalSave =
  !useAnyV2ScopeSave &&
  (Array.isArray(body.job_colors) || Array.isArray(body.room_flags) || Array.isArray(body.access_fees))
```

- [ ] **Step 2: Change room persistence gate**

Replace:

```ts
if (Array.isArray(body.rooms)) {
  if (useV2WallsSave) {
    await saveV2RoomRoster({
      orgId: params.orgId,
      estimateId: params.estimateId,
      jobId: asText(estimate.job_id),
      rows: v2RoomRows ?? [],
    })
  } else {
    await replaceLegacyEstimateRooms({
      orgId: params.orgId,
      estimateId: params.estimateId,
      rows: buildLegacyEstimateRoomRows({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId: asText(estimate.job_id),
        rooms: body.rooms as Unsafe[],
      }),
    })
  }
}
```

with:

```ts
if (Array.isArray(body.rooms)) {
  if (useAnyV2ScopeSave) {
    await saveV2RoomRoster({
      orgId: params.orgId,
      estimateId: params.estimateId,
      jobId: asText(estimate.job_id),
      rows: v2RoomRows ?? [],
    })
  } else {
    await replaceLegacyEstimateRooms({
      orgId: params.orgId,
      estimateId: params.estimateId,
      rows: buildLegacyEstimateRoomRows({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId: asText(estimate.job_id),
        rooms: body.rooms as Unsafe[],
      }),
    })
  }
}
```

- [ ] **Step 3: Use the combined flag in the response branch**

Replace:

```ts
if (useV2WallsSave || useV2CeilingsSave || useV2TrimSave) {
```

with:

```ts
if (useAnyV2ScopeSave) {
```

- [ ] **Step 4: Add a ceiling-only save orchestration test**

In `saveEstimateOrchestration.test.ts`, add:

```ts
it('uses V2 room roster persistence for ceiling-only scope saves', async () => {
  mocks.getEstimate.mockResolvedValue({
    estimate: { id: 'estimate-1', job_id: 'job-1' },
  })
  mocks.buildV2RoomRosterRows.mockReturnValue([
    {
      room_id: 'R001',
      room_name: 'Living',
      room_type_id: 'BEDROOM',
      wall_complexity_id: 'WALL_STD',
      position: 0,
      notes: null,
      length_in: 120,
      width_in: 144,
      wallheight_in: 96,
      condition_selections: null,
    },
  ])
  mocks.buildV2CeilingScopeRows.mockReturnValue({
    scopeRows: [],
    scopeIds: new Set(),
    modeByRoom: new Map(),
  })
  mocks.buildV2CeilingSegmentRows.mockReturnValue([])
  mocks.calculateCeilingsForSave.mockResolvedValue({
    ceilingCalculations: { scopes: [] },
    ceilingScopeRows: [],
    ceilingSegmentRows: [],
  })
  mocks.saveV2RoomRoster.mockResolvedValue(undefined)
  mocks.softReplaceRows.mockResolvedValue(undefined)

  await expect(
    saveEstimateV2Inputs({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      autosaveOnly: false,
      body: {
        rooms: [{ room_id: 'R001', room_name: 'Living' }],
        room_ceiling_scopes: [],
      },
    })
  ).resolves.toEqual({
    ok: true,
    wall_calculations: null,
    ceiling_calculations: { scopes: [] },
    trim_calculations: null,
  })

  expect(mocks.saveV2RoomRoster).toHaveBeenCalledWith({
    orgId: 'org-1',
    estimateId: 'estimate-1',
    jobId: 'job-1',
    rows: [
      expect.objectContaining({
        room_id: 'R001',
        room_type_id: 'BEDROOM',
        wall_complexity_id: 'WALL_STD',
      }),
    ],
  })
  expect(mocks.replaceLegacyEstimateRooms).not.toHaveBeenCalled()
})
```

- [ ] **Step 5: Add a trim-only save orchestration test**

Add:

```ts
it('uses V2 room roster persistence for trim-only scope saves', async () => {
  mocks.getEstimate.mockResolvedValue({
    estimate: { id: 'estimate-1', job_id: 'job-1' },
  })
  mocks.buildV2RoomRosterRows.mockReturnValue([
    {
      room_id: 'R001',
      room_name: 'Living',
      room_type_id: 'BEDROOM',
      wall_complexity_id: 'WALL_STD',
      position: 0,
      notes: null,
      length_in: 120,
      width_in: 144,
      wallheight_in: 96,
      condition_selections: null,
    },
  ])
  mocks.buildV2TrimScopeRows.mockReturnValue({ scopeRows: [] })
  mocks.calculateTrimForSave.mockResolvedValue({ scopes: [] })
  mocks.saveV2RoomRoster.mockResolvedValue(undefined)
  mocks.softReplaceRows.mockResolvedValue(undefined)

  await expect(
    saveEstimateV2Inputs({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      autosaveOnly: false,
      body: {
        rooms: [{ room_id: 'R001', room_name: 'Living' }],
        room_trim_scopes: [],
      },
    })
  ).resolves.toEqual({
    ok: true,
    wall_calculations: null,
    ceiling_calculations: null,
    trim_calculations: { scopes: [] },
  })

  expect(mocks.saveV2RoomRoster).toHaveBeenCalledWith({
    orgId: 'org-1',
    estimateId: 'estimate-1',
    jobId: 'job-1',
    rows: [
      expect.objectContaining({
        room_id: 'R001',
        room_type_id: 'BEDROOM',
        wall_complexity_id: 'WALL_STD',
      }),
    ],
  })
  expect(mocks.replaceLegacyEstimateRooms).not.toHaveBeenCalled()
})
```

- [ ] **Step 6: Run targeted tests**

Run:

```powershell
npx.cmd vitest run --config vitest.node.config.ts lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts
```

Expected:

```text
Test Files  1 passed
Tests       5 passed
```

---

### Task 4: Lock Pricing Engine Contracts Before Drywall And Doors

**Files:**
- Modify: `lib/estimator/__tests__/pricingPolicies.test.ts`
- Modify: `lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts`
- Review: `lib/estimator/pricingPolicies.ts`

- [ ] **Step 1: Keep explicit engine kind as the canonical future-scope interface**

Do not add drywall or door paint buckets yet. The current expected policy is:

```ts
type EstimatePricingEngineKind = 'walls' | 'ceilings' | 'trim' | 'drywall' | 'doors' | 'other'
```

and only `walls` and `ceilings` contribute to customer-facing wall/ceiling paint material buckets. Future `drywall` and `doors` contribute room totals, labor, primer, and supplies until their customer-facing material policy is explicitly chosen.

- [ ] **Step 2: Add a regression assertion for future engines preserving totals**

In the future-engine golden test, assert all of these:

```ts
assertMoneyEqual(pricing.wallPaintMaterialCost, walls.scopes[0].allocated_paint_material_cost ?? 0, 'wall bucket')
assertMoneyEqual(pricing.ceilingPaintMaterialCost, ceilings.scopes[0].allocated_paint_material_cost ?? 0, 'ceiling bucket')
assertMoneyEqual(
  pricing.paintMaterialCost,
  pricing.wallPaintMaterialCost + pricing.ceilingPaintMaterialCost + pricing.trimPaintMaterialCost,
  'visible paint buckets'
)
assertMoneyEqual(
  pricing.prePolicyTotal,
  [...walls.room_totals, ...ceilings.room_totals, ...trim.room_totals, ...drywall.room_totals, ...doors.room_totals]
    .reduce((sum, room) => sum + room.effective_total, 0),
  'future scope room totals'
)
```

- [ ] **Step 3: Run estimator tests**

Run:

```powershell
node --experimental-specifier-resolution=node --experimental-test-isolation=none --test "lib/estimator/__tests__/*.test.ts"
```

Expected:

```text
# fail 0
```

---

### Task 5: Prove Summary And Customer Send Parity

**Files:**
- Modify: `app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx`
- Modify: `app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryEditorParity.test.tsx`
- Modify: `lib/server/customer-send/__tests__/contextCalculations.test.ts`
- Modify: `lib/customer-estimates/__tests__/build.test.ts`

- [ ] **Step 1: Ensure Paint & Supplies visible rows reconcile**

Keep or add the assertion:

```ts
const rows = buildPaintSupplyRows(pricingSummary)
const visibleDollarTotal = rows
  .filter((row) => row.label !== 'Total gallons')
  .reduce((sum, row) => sum + Number(row.value.replace(/[^0-9.-]/g, '')), 0)

expect(visibleDollarTotal).toBe(calculatePaintSuppliesTotal(pricingSummary))
```

- [ ] **Step 2: Ensure customer-send uses explicit engine kinds**

In `contextCalculations.test.ts`, assert:

```ts
expect(mockBuildEstimatePricingSummaryFromEngines).toHaveBeenCalledWith(
  [
    { kind: 'walls', output: { scopes: [{ id: 'wall-output' }] } },
    { kind: 'ceilings', output: { scopes: [{ id: 'ceiling-output' }] } },
    { kind: 'trim', output: { scopes: [{ id: 'trim-output' }] } },
  ],
  expect.anything(),
  expect.anything(),
  expect.anything()
)
```

- [ ] **Step 3: Ensure customer quote rows reconcile to displayed total**

In `lib/customer-estimates/__tests__/build.test.ts`, keep or add:

```ts
assert.equal(document.total, 1199)
assert.equal(document.quote_rows.reduce((sum, row) => sum + row.price, 0), document.total)
for (const row of document.quote_rows) {
  assert.equal(Number.isInteger(row.price), true)
}
```

- [ ] **Step 4: Run targeted summary and send tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryEditorParity.test.tsx
```

Run:

```powershell
npx.cmd vitest run --config vitest.node.config.ts lib/server/customer-send/__tests__/contextCalculations.test.ts
```

Run:

```powershell
node --experimental-specifier-resolution=node --experimental-test-isolation=none --test lib/customer-estimates/__tests__/build.test.ts
```

Expected:

```text
all targeted tests pass
```

---

### Task 6: Run The Full Confidence Gate

**Files:**
- No production file edits.
- Review: all changed files from `git diff --name-only`.

- [ ] **Step 1: Run typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected:

```text
tsc --noEmit
```

with exit code `0`.

- [ ] **Step 2: Run node tests**

Run:

```powershell
npm.cmd run test:node
```

Expected:

```text
# fail 0
Test Files ... passed
```

- [ ] **Step 3: Run changed Estimate V2 component tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/_components/__tests__/EstimateV2CeilingsSectionBody.test.tsx app/crm/estimates/[id]/v2/_components/__tests__/EstimateV2TrimSectionBody.test.tsx app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryEditorParity.test.tsx
```

Expected:

```text
Test Files  5 passed
```

- [ ] **Step 4: Run full test suite**

Run:

```powershell
npm.cmd run test
```

Expected:

```text
test:node passes
test:components passes
```

- [ ] **Step 5: Run full check**

Run:

```powershell
npm.cmd run check:full
```

Expected:

```text
lint passes
typecheck passes
build passes
test passes
```

If `.next` stale build artifacts cause a false failure, clear `.next` with the approved cleanup command already used in this repo, then rerun `npm.cmd run build`.

---

### Task 7: Manual Acceptance Pass

**Files:**
- Use: `docs/quotes-estimate-v2-acceptance-checklist.md`

- [ ] **Step 1: Start local app**

Run:

```powershell
npm.cmd run dev
```

Expected:

```text
ready started server on ...
```

- [ ] **Step 2: Execute checklist**

Open `docs/quotes-estimate-v2-acceptance-checklist.md` and run every item under:

```text
Editor Workflow
Pricing Policy Workflow
Customer Quote Workflow
Readiness Errors
```

- [ ] **Step 3: Record the result**

Append a short note to the PR or task summary:

```text
Manual Estimate V2 acceptance pass:
- Browser:
- Date:
- Branch:
- Result:
- Mismatches found:
```

Do not mark confidence high if editor, summary, and customer quote totals differ after save/reload.

---

## High-Confidence Exit Criteria

- `npm.cmd run typecheck` passes.
- `npm.cmd run test:node` passes and includes nested `lib/server/estimate-v2/__tests__` coverage.
- Targeted changed V2 component/summary tests pass.
- `npm.cmd run test` passes.
- `npm.cmd run check:full` passes, or any inability to run it is documented with the exact blocker.
- Manual checklist passes for editor save/reload, summary totals, customer quote totals, and readiness errors.
- No V2 room save path falls back to legacy persistence for ceiling-only, trim-only, drywall-only, or door-only future scope saves.

## Self-Review

- Spec coverage: The plan covers all three review findings, pricing/summary/customer-send parity, default test wiring, and manual acceptance before drywall/door work.
- Placeholder scan: No task uses TBD/TODO/fill-in placeholders.
- Type consistency: The plan uses existing names: `useV2WallsSave`, `useV2CeilingsSave`, `useV2TrimSave`, `saveV2RoomRoster`, `replaceLegacyEstimateRooms`, `buildEstimatePricingSummaryFromEngines`, `room_type_id`, and `wall_complexity_id`.
