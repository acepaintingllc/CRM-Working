# Job-Level Access Fees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add job-level access fee selection to Estimator V2 Details and include those one-time charges in pricing with explicit scope allocation.

**Architecture:** Access fees are estimate/job-level rows persisted through the existing `estimate_access_fees` table. The Details page edits fee rows, while shared estimator helpers own fee normalization, total calculation, and allocation. Allocation is proportional across eligible active scope subtotals: walls when active, ceilings when active, and trim only when active crown trim exists.

**Tech Stack:** Next.js App Router, React, TypeScript, Zustand, Supabase SQL, route-local Estimator V2 state, shared `lib/estimator` calculation helpers, `node --test` and component tests through `npm.cmd run test:components`.

---

## Approved Behavior

- Access fees are entered once per estimate/job, not per room.
- `room_id` is optional context only.
- Each selected fee contributes once to `sharedAccessCost`.
- Quantity multiplies the catalog amount.
- `actualCostOverride` replaces `catalogAmount * qty` when present.
- Scope allocation uses eligible pre-access subtotal:
  - walls: eligible when active wall work exists
  - ceilings: eligible when active ceiling work exists
  - trim: eligible only when active crown trim exists
  - baseboards, casing, rail, normal trim: not eligible by default
- If there is access fee total but no eligible allocation base, keep it estimate-level and expose a warning instead of inventing a split.
- Customer-facing summary can show access fees as job-level charges; internal rollups expose allocation.

## Files

- Create: `supabase/sql/070_job_level_access_fees.sql`
- Create: `lib/estimator/accessFees.ts`
- Create: `lib/estimator/__tests__/accessFees.test.ts`
- Create: `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsAccessFees.ts`
- Create: `app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsAccessFees.test.ts`
- Create: `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsAccessFees.tsx`
- Modify: `types/estimator/v2.ts`
- Modify: `lib/server/rates-flags/shared.ts`
- Modify: `lib/server/rates-flags/overlay.ts`
- Modify: `lib/server/estimateCatalogs.ts`
- Modify: `lib/estimates/v2/store/estimateV2Store.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2EditorTypes.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2Sanitizer.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2DirtySnapshot.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2CalculationDerived.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2SaveController.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2EditorSaveOrchestration.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2EditorLoadOrchestration.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2EditorStoreMutations.ts`
- Modify: `lib/estimator/v2DraftPayload.ts`
- Modify: `lib/estimator/pricingPolicies.ts`
- Modify: `lib/server/estimate-v2/saveEstimateOrchestration.ts`
- Modify: `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsVm.ts`
- Modify: `app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsVm.ts`
- Modify: `app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsMutations.ts`
- Modify: `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsPageContent.tsx`
- Modify: `app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx`
- Modify relevant existing tests under `app/crm/estimates/[id]/v2/_state/__tests__`, `app/crm/estimates/[id]/v2/details/_state/__tests__`, and `lib/estimator/__tests__`.

---

### Task 1: Schema Supports Job-Level Access Fees

**Files:**
- Create: `supabase/sql/070_job_level_access_fees.sql`

- [ ] **Step 1: Add migration**

Create `supabase/sql/070_job_level_access_fees.sql`:

```sql
-- Access fees are one-time estimate/job-level charges.
-- room_id is optional context only.

alter table public.estimate_access_fees
  alter column room_id drop not null;

drop index if exists public.estimate_access_fees_active_key;

create unique index if not exists estimate_access_fees_active_job_level_key
  on public.estimate_access_fees (org_id, estimate_id, access_fee_id)
  where active = 'Y'
    and access_fee_id is not null
    and btrim(access_fee_id) <> '';

create index if not exists estimate_access_fees_room_context_idx
  on public.estimate_access_fees (org_id, estimate_id, room_id)
  where room_id is not null;
```

- [ ] **Step 2: Verify SQL file exists**

Run:

```powershell
Get-Content -Path supabase/sql/070_job_level_access_fees.sql
```

Expected: SQL above is printed.

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/070_job_level_access_fees.sql
git commit -m "db: allow job-level estimate access fees"
```

---

### Task 2: Types And Catalog Overlay Include Access Fee Groups

**Files:**
- Modify: `types/estimator/v2.ts`
- Modify: `lib/server/rates-flags/shared.ts`
- Modify: `lib/server/rates-flags/overlay.ts`
- Modify: `lib/server/estimateCatalogs.ts`

- [ ] **Step 1: Add failing type expectations**

Create or update a small typecheck block in `types/estimator/ratesFlags.typecheck.ts`:

```ts
import type { EstimateV2AccessFeeDraft, EstimateV2AccessFeeOption } from './v2'

const accessFeeDraft: EstimateV2AccessFeeDraft = {
  id: 'fee-row-1',
  roomId: '',
  accessFeeId: 'LADDER_24',
  qty: '1',
  actualCostOverride: '',
  notes: '',
  position: 0,
}

const accessFeeOption: EstimateV2AccessFeeOption = {
  id: 'LADDER_24',
  label: '24 ft ladder',
  access_group: 'ladders',
  fee_type: 'Labor',
  amount: 75,
  unit: 'each',
  notes: null,
}

void accessFeeDraft
void accessFeeOption
```

- [ ] **Step 2: Run typecheck and confirm failure**

Run:

```powershell
npm.cmd run typecheck
```

Expected: FAIL because `EstimateV2AccessFeeDraft` and `EstimateV2AccessFeeOption` do not exist.

- [ ] **Step 3: Add access fee types**

In `types/estimator/v2.ts`, add:

```ts
export type EstimateV2AccessFeeGroup = 'ladders' | 'scaffolding' | 'specialty'

export type EstimateV2AccessFeeOption = EstimateV2CatalogOption & {
  access_group: EstimateV2AccessFeeGroup
  fee_type: string | null
  amount: number | null
  unit: string | null
  notes: string | null
}

export type EstimateV2AccessFeeDraft = {
  id: string
  roomId: string
  accessFeeId: string
  qty: string
  actualCostOverride: string
  notes: string
  position: number
}
```

Then update `EstimateV2Catalogs`:

```ts
export type EstimateV2Catalogs = {
  paint_products: EstimateV2PaintProductOption[]
  color_codes: EstimateV2CatalogOption[]
  production_rates: EstimateV2ProductionRateOption[]
  height_factors: EstimateV2HeightFactorOption[]
  room_types: EstimateV2CatalogOption[]
  room_flags: EstimateV2RoomFlagOption[]
  ceiling_types: EstimateV2CeilingTypeOption[]
  trim_items: EstimateV2TrimTypeOption[]
  door_types?: EstimateV2DoorTypeOption[]
  condition_modifiers?: EstimateV2LegacyConditionModifier[]
  access_fees?: EstimateV2AccessFeeOption[]
}
```

- [ ] **Step 4: Preserve access group in rates/flags overlay**

In `lib/server/rates-flags/shared.ts`, change `AccessFeeCatalogRow` to:

```ts
export type AccessFeeCatalogRow = {
  id: string
  label: string
  access_group: 'ladders' | 'scaffolding' | 'specialty'
  fee_type: string | null
  amount: number | null
  unit: string | null
  notes: string | null
  active: 'Y' | 'N'
}
```

In `lib/server/rates-flags/overlay.ts`, update the access fee mapping:

```ts
const group = asText(values.access_group).toLowerCase()
const accessGroup =
  group === 'scaffolding' || group === 'specialty' || group === 'ladders'
    ? group
    : row.category_key === 'access_fees_scaffolding'
      ? 'scaffolding'
      : row.category_key === 'access_fees_specialty'
        ? 'specialty'
        : 'ladders'

access_fees.push({
  id: normalizeId(values.id || row.row_id),
  label: asText(values.display_name) || row.display_name,
  access_group: accessGroup,
  fee_type: asText(values.fee_type) || null,
  amount: parseNumber(values.amount),
  unit: asText(values.unit) || null,
  notes: asText(values.notes) || null,
  active: row.active,
})
```

- [ ] **Step 5: Expose access fee catalog to V2**

In `lib/server/estimateCatalogs.ts`, change the internal `AccessFee` type:

```ts
type AccessFee = CatalogOption & {
  access_group: 'ladders' | 'scaffolding' | 'specialty'
  fee_type: string | null
  amount: number | null
  unit: string | null
  notes: string | null
}
```

In the V2 overlay result, replace `access_fees: []` with:

```ts
access_fees: params.overlay.access_fees
  .filter((row) => row.active === 'Y')
  .map((row) => ({
    id: row.id,
    label: row.label || row.id,
    active: row.active,
    access_group: row.access_group,
    fee_type: row.fee_type,
    amount: row.amount,
    unit: row.unit,
    notes: row.notes,
  })),
```

- [ ] **Step 6: Run focused checks**

Run:

```powershell
npm.cmd run typecheck
```

Expected: PASS or only unrelated existing failures. If unrelated failures exist, capture the first unrelated error in the task notes.

- [ ] **Step 7: Commit**

```bash
git add types/estimator/v2.ts types/estimator/ratesFlags.typecheck.ts lib/server/rates-flags/shared.ts lib/server/rates-flags/overlay.ts lib/server/estimateCatalogs.ts
git commit -m "feat: expose estimator access fee catalog"
```

---

### Task 3: Shared Access Fee Calculation And Allocation Helper

**Files:**
- Create: `lib/estimator/accessFees.ts`
- Create: `lib/estimator/__tests__/accessFees.test.ts`
- Modify: `types/estimator/v2.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/estimator/__tests__/accessFees.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allocateAccessFeesByEligibleScope,
  calculateAccessFeeRows,
  hasCrownTrimAccessEligibility,
} from '../accessFees.ts'

test('calculateAccessFeeRows uses catalog amount times quantity', () => {
  const rows = calculateAccessFeeRows({
    drafts: [{ id: 'row-1', accessFeeId: 'LADDER', qty: '2', actualCostOverride: '', roomId: '', notes: '', position: 0 }],
    catalog: [{ id: 'LADDER', label: 'Ladder', access_group: 'ladders', fee_type: 'Labor', amount: 75, unit: 'each', notes: null }],
  })

  assert.equal(rows.total, 150)
  assert.equal(rows.rows[0].effectiveTotal, 150)
})

test('calculateAccessFeeRows uses override as effective row total', () => {
  const rows = calculateAccessFeeRows({
    drafts: [{ id: 'row-1', accessFeeId: 'SCAFFOLD', qty: '2', actualCostOverride: '425', roomId: '', notes: '', position: 0 }],
    catalog: [{ id: 'SCAFFOLD', label: 'Scaffold', access_group: 'scaffolding', fee_type: 'PassThrough', amount: 100, unit: 'each', notes: null }],
  })

  assert.equal(rows.total, 425)
  assert.equal(rows.rows[0].overridden, true)
})

test('hasCrownTrimAccessEligibility only returns true for active crown trim', () => {
  assert.equal(hasCrownTrimAccessEligibility([{ include: 'Y', trimFamily: 'crown', trimTypeId: 'CROWN', overrideTotal: '', position: 0 }]), true)
  assert.equal(hasCrownTrimAccessEligibility([{ include: 'Y', trimFamily: 'base', trimTypeId: 'BASE', overrideTotal: '', position: 0 }]), false)
  assert.equal(hasCrownTrimAccessEligibility([{ include: 'N', trimFamily: 'crown', trimTypeId: 'CROWN', overrideTotal: '', position: 0 }]), false)
})

test('allocateAccessFeesByEligibleScope splits by eligible pre-access subtotal', () => {
  const allocation = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 500,
    scopes: [
      { scope: 'walls', eligible: true, preAccessSubtotal: 3000 },
      { scope: 'ceilings', eligible: true, preAccessSubtotal: 1000 },
      { scope: 'trim', eligible: true, preAccessSubtotal: 1000 },
    ],
  })

  assert.equal(allocation.allocated.walls, 300)
  assert.equal(allocation.allocated.ceilings, 100)
  assert.equal(allocation.allocated.trim, 100)
  assert.equal(allocation.unallocated, 0)
})

test('allocateAccessFeesByEligibleScope leaves fee unallocated when no eligible base exists', () => {
  const allocation = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 125,
    scopes: [
      { scope: 'walls', eligible: false, preAccessSubtotal: 0 },
      { scope: 'ceilings', eligible: false, preAccessSubtotal: 0 },
      { scope: 'trim', eligible: false, preAccessSubtotal: 0 },
    ],
  })

  assert.equal(allocation.allocated.walls, 0)
  assert.equal(allocation.allocated.ceilings, 0)
  assert.equal(allocation.allocated.trim, 0)
  assert.equal(allocation.unallocated, 125)
  assert.equal(allocation.warning, 'Access fees are present but no eligible active scope subtotal exists for allocation.')
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
node --experimental-specifier-resolution=node --test lib/estimator/__tests__/accessFees.test.ts
```

Expected: FAIL because `lib/estimator/accessFees.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `lib/estimator/accessFees.ts`:

```ts
import type {
  EstimateV2AccessFeeDraft,
  EstimateV2AccessFeeOption,
  EstimateV2TrimScopeDraft,
} from '../../types/estimator/v2.ts'
import { asNullableNumber } from './parsing.ts'

export type AccessFeeCalculatedRow = {
  id: string
  accessFeeId: string
  label: string
  accessGroup: EstimateV2AccessFeeOption['access_group'] | null
  qty: number
  catalogAmount: number
  actualCostOverride: number | null
  effectiveTotal: number
  overridden: boolean
  roomId: string
  notes: string
}

export type AccessFeeScopeKey = 'walls' | 'ceilings' | 'trim'

export type AccessFeeScopeBase = {
  scope: AccessFeeScopeKey
  eligible: boolean
  preAccessSubtotal: number
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeId(value: string) {
  return value.trim().toUpperCase()
}

export function calculateAccessFeeRows(params: {
  drafts: EstimateV2AccessFeeDraft[]
  catalog: EstimateV2AccessFeeOption[]
}) {
  const catalogById = new Map(params.catalog.map((row) => [normalizeId(row.id), row]))
  const rows = params.drafts
    .filter((draft) => draft.accessFeeId.trim())
    .map((draft): AccessFeeCalculatedRow => {
      const accessFeeId = normalizeId(draft.accessFeeId)
      const option = catalogById.get(accessFeeId)
      const qty = Math.max(1, asNullableNumber(draft.qty) ?? 1)
      const catalogAmount = option?.amount ?? 0
      const actualCostOverride = asNullableNumber(draft.actualCostOverride)
      const effectiveTotal = round2(actualCostOverride ?? catalogAmount * qty)
      return {
        id: draft.id,
        accessFeeId,
        label: option?.label ?? accessFeeId,
        accessGroup: option?.access_group ?? null,
        qty,
        catalogAmount,
        actualCostOverride,
        effectiveTotal,
        overridden: actualCostOverride != null,
        roomId: draft.roomId,
        notes: draft.notes,
      }
    })

  return {
    rows,
    total: round2(rows.reduce((sum, row) => sum + row.effectiveTotal, 0)),
  }
}

export function hasCrownTrimAccessEligibility(
  trimScopes: Array<Pick<EstimateV2TrimScopeDraft, 'include' | 'trimFamily' | 'trimTypeId'>>
) {
  return trimScopes.some((scope) => {
    if (scope.include !== 'Y') return false
    const family = `${scope.trimFamily} ${scope.trimTypeId}`.toLowerCase()
    return family.includes('crown')
  })
}

export function allocateAccessFeesByEligibleScope(params: {
  accessFeeTotal: number
  scopes: AccessFeeScopeBase[]
}) {
  const eligibleScopes = params.scopes.filter(
    (scope) => scope.eligible && scope.preAccessSubtotal > 0
  )
  const baseTotal = round2(
    eligibleScopes.reduce((sum, scope) => sum + scope.preAccessSubtotal, 0)
  )
  const zero = { walls: 0, ceilings: 0, trim: 0 }
  if (params.accessFeeTotal <= 0) {
    return { allocated: zero, unallocated: 0, warning: null as string | null }
  }
  if (baseTotal <= 0) {
    return {
      allocated: zero,
      unallocated: round2(params.accessFeeTotal),
      warning: 'Access fees are present but no eligible active scope subtotal exists for allocation.',
    }
  }

  const allocated = { ...zero }
  let running = 0
  eligibleScopes.forEach((scope, index) => {
    const value =
      index === eligibleScopes.length - 1
        ? round2(params.accessFeeTotal - running)
        : round2(params.accessFeeTotal * (scope.preAccessSubtotal / baseTotal))
    allocated[scope.scope] = value
    running = round2(running + value)
  })

  return {
    allocated,
    unallocated: 0,
    warning: null as string | null,
  }
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```powershell
node --experimental-specifier-resolution=node --test lib/estimator/__tests__/accessFees.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/estimator/accessFees.ts lib/estimator/__tests__/accessFees.test.ts
git commit -m "feat: add access fee allocation helper"
```

---

### Task 4: Editor State Loads And Saves Access Fees

**Files:**
- Modify: `types/estimator/v2.ts`
- Modify: `lib/estimates/v2/store/estimateV2Store.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2EditorTypes.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2Sanitizer.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2DirtySnapshot.ts`
- Modify: `lib/estimator/v2DraftPayload.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/__tests__/estimateV2DirtySnapshot.test.tsx`
- Modify: `app/crm/estimates/[id]/v2/_state/__tests__/estimateV2EditorLoadOrchestration.test.tsx`

- [ ] **Step 1: Write failing dirty snapshot test**

In `app/crm/estimates/[id]/v2/_state/__tests__/estimateV2DirtySnapshot.test.tsx`, add:

```ts
it('includes access fees in dirty snapshots', () => {
  const snapshot = buildEstimateV2DirtySnapshot({
    jobSettingsDraft: fixture.jobSettingsDraft,
    rooms: fixture.rooms,
    scopes: fixture.scopes,
    segments: fixture.segments,
    roomFlags: fixture.roomFlags,
    ceilingScopes: fixture.ceilingScopes,
    ceilingSegments: fixture.ceilingSegments,
    trimScopes: fixture.trimScopes,
    doorScopes: fixture.doorScopes,
    rollers: fixture.rollers,
    accessFees: [
      {
        id: 'access-row-1',
        roomId: '',
        accessFeeId: 'LADDER',
        qty: '1',
        actualCostOverride: '',
        notes: 'front elevation',
        position: 0,
      },
    ],
  })

  expect(snapshot.payload.access_fees).toEqual([
    {
      id: 'access-row-1',
      room_id: null,
      access_fee_id: 'LADDER',
      qty: 1,
      actual_cost_override: null,
      notes: 'front elevation',
      position: 0,
      active: 'Y',
    },
  ])
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/_state/__tests__/estimateV2DirtySnapshot.test.tsx
```

Expected: FAIL because `accessFees` is not accepted and `payload.access_fees` does not exist.

- [ ] **Step 3: Extend save payload type**

In `types/estimator/v2.ts`, add to `EstimateV2SavePayload`:

```ts
  access_fees: Array<{
    id: string
    room_id: string | null
    access_fee_id: string
    qty: number | null
    actual_cost_override: number | null
    notes: string | null
    position: number
    active: 'Y'
  }>
```

- [ ] **Step 4: Extend editor collection types**

In `app/crm/estimates/[id]/v2/_state/estimateV2EditorTypes.ts`, import `EstimateV2AccessFeeDraft` and add:

```ts
  accessFees: EstimateV2AccessFeeDraft[]
  setAccessFees: EstimateV2StateSetter<EstimateV2AccessFeeDraft[]>
```

Add `'access-fees'` to `DirtySource`:

```ts
  | 'access-fees'
```

- [ ] **Step 5: Extend store**

In `lib/estimates/v2/store/estimateV2Store.ts`, mirror the existing `rollers` pattern:

```ts
  accessFees?: EstimateV2EditorCollections['accessFees']
```

Include `setAccessFees` in collection setters, default `accessFees: []`, and selector output:

```ts
setAccessFees: (value) =>
  set((state) => ({
    collections: {
      ...state.collections,
      accessFees: resolveUpdater(state.collections.accessFees ?? [], value),
    },
  })),
```

- [ ] **Step 6: Normalize loaded access fee rows**

In `useEstimateV2Sanitizer.ts`, add:

```ts
function normalizeAccessFee(row: Unsafe, index: number): EstimateV2AccessFeeDraft {
  return {
    id: asText(row.id),
    roomId: asText(row.roomId ?? row.room_id),
    accessFeeId: asText(row.accessFeeId ?? row.access_fee_id).toUpperCase(),
    qty: asText(row.qty || '1'),
    actualCostOverride: asText(row.actualCostOverride ?? row.actual_cost_override),
    notes: asText(row.notes),
    position: Number(row.position ?? index),
  }
}
```

Then normalize:

```ts
const normalizedAccessFees = sortByPosition(
  (estimatePayload.inputs.access_fees ?? [])
    .map(normalizeAccessFee)
    .filter((fee) => fee.accessFeeId)
)
```

Include `accessFees: normalizedAccessFees` in `collections` and in `lastSavedSnapshot`.

- [ ] **Step 7: Include access fees in dirty snapshot and payload builder**

In `estimateV2DirtySnapshot.ts`, add `accessFees?: EstimateV2AccessFeeDraft[]` and pass it to `buildEstimateV2SavePayload`.

In `lib/estimator/v2DraftPayload.ts`, add `accessFees: EstimateV2AccessFeeDraft[] = []` as the final parameter and build:

```ts
const orderedAccessFees = sortByPosition(accessFees)
  .map((row, index) => ({
    id: row.id,
    room_id: toNullableText(row.roomId),
    access_fee_id: row.accessFeeId.trim().toUpperCase(),
    qty: toNullableDraftNumber(row.qty) ?? 1,
    actual_cost_override: toNullableDraftNumber(row.actualCostOverride),
    notes: toNullableText(row.notes),
    position: index,
    active: 'Y' as const,
  }))
  .filter((row) => row.access_fee_id)
```

Return `access_fees: orderedAccessFees`.

- [ ] **Step 8: Update save/load orchestration call sites**

Every call to `buildEstimateV2DirtySnapshot` must pass:

```ts
accessFees: currentState.collections.accessFees,
```

or:

```ts
accessFees: normalizedAccessFees,
```

depending on context.

- [ ] **Step 9: Run focused tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/_state/__tests__/estimateV2DirtySnapshot.test.tsx app/crm/estimates/[id]/v2/_state/__tests__/estimateV2EditorLoadOrchestration.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add types/estimator/v2.ts lib/estimates/v2/store/estimateV2Store.ts app/crm/estimates/[id]/v2/_state lib/estimator/v2DraftPayload.ts
git commit -m "feat: persist estimator access fee drafts"
```

---

### Task 5: Server Save Accepts Job-Level Access Fees

**Files:**
- Modify: `lib/server/estimate-v2/saveEstimateOrchestration.ts`
- Modify: `lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts`

- [ ] **Step 1: Write failing server persistence test**

In `lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts`, add a test near existing access fee or scope persistence tests:

```ts
it('persists job-level access fees without requiring room_id', async () => {
  const harness = createSaveHarness()
  await saveEstimateV2({
    supabaseAdmin: harness.supabaseAdmin,
    orgId: 'org-1',
    estimateId: 'estimate-1',
    userId: 'user-1',
    body: {
      rooms: [],
      access_fees: [
        {
          id: 'fee-row-1',
          room_id: null,
          access_fee_id: 'LADDER',
          qty: 1,
          actual_cost_override: null,
          notes: 'job-level',
          active: 'Y',
        },
      ],
    },
  })

  const accessFeeWrite = harness.softReplaceCalls.find((call) => call.table === 'estimate_access_fees')
  assert.deepEqual(accessFeeWrite?.rows, [
    {
      id: 'fee-row-1',
      org_id: 'org-1',
      estimate_id: 'estimate-1',
      job_id: 'job-1',
      position: 0,
      room_id: null,
      segment_num: null,
      access_fee_id: 'LADDER',
      qty: 1,
      active: 'Y',
      notes: 'job-level',
      actual_cost_override: null,
    },
  ])
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
node --experimental-specifier-resolution=node --test lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts
```

Expected: FAIL because current server filters out access fees without `room_id`.

- [ ] **Step 3: Change server filter**

In `lib/server/estimate-v2/saveEstimateOrchestration.ts`, replace:

```ts
.filter((row: { room_id: string | null; access_fee_id: string }) => !!(row.room_id && row.access_fee_id))
```

with:

```ts
.filter((row: { access_fee_id: string }) => !!row.access_fee_id)
```

- [ ] **Step 4: Run test and verify pass**

Run:

```powershell
node --experimental-specifier-resolution=node --test lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/estimate-v2/saveEstimateOrchestration.ts lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts
git commit -m "fix: allow job-level access fee persistence"
```

---

### Task 6: Pricing Summary Includes Shared Access Cost

**Files:**
- Modify: `types/estimator/v2.ts`
- Modify: `lib/estimator/pricingPolicies.ts`
- Modify: `lib/estimator/__tests__/pricingPolicies.test.ts`
- Modify: `lib/server/estimate-v2/loadEstimateAssembly.ts`

- [ ] **Step 1: Write failing pricing test**

In `lib/estimator/__tests__/pricingPolicies.test.ts`, add:

```ts
test('pricing summary adds shared access cost and allocates by eligible scope subtotal', () => {
  const result = calculateEstimatePricingSummary({
    wallEngines: [createWallEngineFixture({ roomTotal: 3000 })],
    ceilingEngines: [createCeilingEngineFixture({ roomTotal: 1000 })],
    trimEngines: [createTrimEngineFixture({ roomTotal: 1000, trimFamily: 'crown' })],
    trimPaint: null,
    accessFees: [
      { id: 'row-1', roomId: '', accessFeeId: 'LADDER', qty: '1', actualCostOverride: '500', notes: '', position: 0 },
    ],
    accessFeeCatalog: [
      { id: 'LADDER', label: 'Ladder', access_group: 'ladders', fee_type: 'Labor', amount: 400, unit: 'each', notes: null },
    ],
    laborPolicy: { enabled: false, dayHours: 8, roundingIncrementHours: 1 },
    minimumPolicy: { enabled: false, amount: 0 },
    laborRate: 0,
    extraSupplyCost: 0,
    catalogs: null,
    crewSize: 1,
  })

  assert.equal(result.sharedAccessCost, 500)
  assert.equal(result.accessFeeAllocation.walls, 300)
  assert.equal(result.accessFeeAllocation.ceilings, 100)
  assert.equal(result.accessFeeAllocation.trim, 100)
  assert.equal(result.finalTotal, result.postLaborPolicyTotal)
})
```

Use the existing fixture helper names in this file. If helper names differ, adapt the fixture setup but preserve the assertion values.

- [ ] **Step 2: Run pricing tests and verify failure**

Run:

```powershell
node --experimental-specifier-resolution=node --test lib/estimator/__tests__/pricingPolicies.test.ts
```

Expected: FAIL because pricing does not accept or return access fee totals.

- [ ] **Step 3: Extend pricing summary type**

In `types/estimator/v2.ts`, add to `EstimateV2PricingSummary`:

```ts
  sharedAccessCost: number
  accessFeeAllocation: {
    walls: number
    ceilings: number
    trim: number
    unallocated: number
    warning: string | null
  }
```

- [ ] **Step 4: Wire pricing policy**

In `lib/estimator/pricingPolicies.ts`, import:

```ts
import {
  allocateAccessFeesByEligibleScope,
  calculateAccessFeeRows,
  hasCrownTrimAccessEligibility,
} from './accessFees.ts'
```

Extend the pricing input type with:

```ts
accessFees?: EstimateV2AccessFeeDraft[]
accessFeeCatalog?: EstimateV2AccessFeeOption[]
trimScopes?: EstimateV2TrimScopeDraft[]
```

After `roomBasesWithTrim`, calculate access fees:

```ts
const calculatedAccessFees = calculateAccessFeeRows({
  drafts: params.accessFees ?? [],
  catalog: params.accessFeeCatalog ?? [],
})
const sharedAccessCost = calculatedAccessFees.total
const wallPreAccessSubtotal = round2(
  roomBases.reduce((sum, row) => sum + row.baseTotal, 0)
)
const ceilingPreAccessSubtotal = round2(
  ceilingEngines.flatMap((engine) => engine.room_totals).reduce((sum, row) => sum + row.effective_total, 0)
)
const trimPreAccessSubtotal = round2(
  trimEngines.flatMap((engine) => engine.room_totals).reduce((sum, row) => sum + row.effective_total, 0) + standaloneTrimPaintMaterialCost
)
const accessFeeAllocation = allocateAccessFeesByEligibleScope({
  accessFeeTotal: sharedAccessCost,
  scopes: [
    { scope: 'walls', eligible: wallPreAccessSubtotal > 0, preAccessSubtotal: wallPreAccessSubtotal },
    { scope: 'ceilings', eligible: ceilingPreAccessSubtotal > 0, preAccessSubtotal: ceilingPreAccessSubtotal },
    {
      scope: 'trim',
      eligible: hasCrownTrimAccessEligibility(params.trimScopes ?? []),
      preAccessSubtotal: trimPreAccessSubtotal,
    },
  ],
})
```

Then add access fee total before labor minimum:

```ts
const prePolicyTotal = round2(
  roomBasesWithTrim.reduce((s, v) => s + v.baseTotal, 0) + sharedAccessCost
)
```

Return:

```ts
sharedAccessCost,
accessFeeAllocation: {
  ...accessFeeAllocation.allocated,
  unallocated: accessFeeAllocation.unallocated,
  warning: accessFeeAllocation.warning,
},
```

- [ ] **Step 5: Pass access fees from server calculation assembly**

In `lib/server/estimate-v2/loadEstimateAssembly.ts`, where pricing is calculated, pass:

```ts
accessFees: payload.inputs.access_fees,
accessFeeCatalog: catalogs.catalogs.access_fees ?? [],
trimScopes: payload.inputs.room_trim_scopes,
```

Use the actual local variable names in the function.

- [ ] **Step 6: Run pricing tests**

Run:

```powershell
node --experimental-specifier-resolution=node --test lib/estimator/__tests__/pricingPolicies.test.ts lib/estimator/__tests__/accessFees.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add types/estimator/v2.ts lib/estimator/pricingPolicies.ts lib/estimator/__tests__/pricingPolicies.test.ts lib/server/estimate-v2/loadEstimateAssembly.ts
git commit -m "feat: include access fees in estimator pricing"
```

---

### Task 7: Details VM And Mutations For Access Fees

**Files:**
- Create: `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsAccessFees.ts`
- Create: `app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsAccessFees.test.ts`
- Modify: `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsVm.ts`
- Modify: `app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsVm.ts`
- Modify: `app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsMutations.ts`

- [ ] **Step 1: Write failing VM tests**

Create `app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsAccessFees.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  addAccessFeeDraft,
  buildEstimateV2DetailsAccessFeesVm,
  removeAccessFeeDraft,
  updateAccessFeeDraft,
} from '../estimateV2DetailsAccessFees'

const rooms = [
  { roomId: 'R001', roomName: 'Living Room' },
  { roomId: 'R002', roomName: 'Kitchen' },
]

const catalog = [
  { id: 'LADDER', label: 'Ladder', access_group: 'ladders' as const, fee_type: 'Labor', amount: 75, unit: 'each', notes: null },
  { id: 'SCAFFOLD', label: 'Scaffold', access_group: 'scaffolding' as const, fee_type: 'PassThrough', amount: 300, unit: 'each', notes: null },
]

describe('buildEstimateV2DetailsAccessFeesVm', () => {
  it('groups catalog options and computes effective totals', () => {
    const vm = buildEstimateV2DetailsAccessFeesVm({
      accessFees: [{ id: 'row-1', accessFeeId: 'LADDER', qty: '2', actualCostOverride: '', roomId: '', notes: '', position: 0 }],
      catalog,
      rooms,
      pricingSummary: null,
    })

    expect(vm.total).toBe(150)
    expect(vm.rows[0].label).toBe('Ladder')
    expect(vm.optionGroups.map((group) => group.key)).toEqual(['ladders', 'scaffolding'])
  })
})

describe('access fee draft mutations', () => {
  it('adds, updates, and removes drafts immutably', () => {
    const added = addAccessFeeDraft([], () => 'new-id')
    expect(added).toEqual([{ id: 'new-id', roomId: '', accessFeeId: '', qty: '1', actualCostOverride: '', notes: '', position: 0 }])

    const updated = updateAccessFeeDraft(added, 'new-id', { accessFeeId: 'SCAFFOLD', qty: '3' })
    expect(updated[0].accessFeeId).toBe('SCAFFOLD')
    expect(updated[0].qty).toBe('3')

    expect(removeAccessFeeDraft(updated, 'new-id')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsAccessFees.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement details helper**

Create `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsAccessFees.ts`:

```ts
import { calculateAccessFeeRows } from '@/lib/estimator/accessFees'
import type {
  EstimateV2AccessFeeDraft,
  EstimateV2AccessFeeOption,
  EstimateV2PricingSummary,
  EstimateV2RoomDraft,
} from '@/types/estimator/v2'

export type DetailsAccessFeesVm = {
  rows: Array<{
    id: string
    accessFeeId: string
    label: string
    roomId: string
    roomLabel: string
    qty: string
    actualCostOverride: string
    notes: string
    effectiveTotal: number
    overridden: boolean
  }>
  optionGroups: Array<{
    key: EstimateV2AccessFeeOption['access_group']
    label: string
    options: EstimateV2AccessFeeOption[]
  }>
  roomOptions: Array<{ id: string; label: string }>
  total: number
  allocation: EstimateV2PricingSummary['accessFeeAllocation'] | null
}

const ACCESS_GROUP_LABELS = {
  ladders: 'Ladders',
  scaffolding: 'Scaffolding',
  specialty: 'Specialty',
} satisfies Record<EstimateV2AccessFeeOption['access_group'], string>

export function createAccessFeeDraftId() {
  return `access-fee-${crypto.randomUUID()}`
}

export function addAccessFeeDraft(
  rows: EstimateV2AccessFeeDraft[],
  createId: () => string = createAccessFeeDraftId
) {
  return [
    ...rows,
    {
      id: createId(),
      roomId: '',
      accessFeeId: '',
      qty: '1',
      actualCostOverride: '',
      notes: '',
      position: rows.length,
    },
  ]
}

export function updateAccessFeeDraft(
  rows: EstimateV2AccessFeeDraft[],
  rowId: string,
  patch: Partial<EstimateV2AccessFeeDraft>
) {
  return rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
}

export function removeAccessFeeDraft(rows: EstimateV2AccessFeeDraft[], rowId: string) {
  return rows
    .filter((row) => row.id !== rowId)
    .map((row, index) => ({ ...row, position: index }))
}

export function buildEstimateV2DetailsAccessFeesVm(params: {
  accessFees: EstimateV2AccessFeeDraft[]
  catalog: EstimateV2AccessFeeOption[]
  rooms: Array<Pick<EstimateV2RoomDraft, 'roomId' | 'roomName'>>
  pricingSummary: EstimateV2PricingSummary | null | undefined
}): DetailsAccessFeesVm {
  const calculated = calculateAccessFeeRows({
    drafts: params.accessFees,
    catalog: params.catalog,
  })
  const roomsById = new Map(params.rooms.map((room) => [room.roomId, room.roomName]))

  const optionGroups = (['ladders', 'scaffolding', 'specialty'] as const)
    .map((key) => ({
      key,
      label: ACCESS_GROUP_LABELS[key],
      options: params.catalog.filter((option) => option.access_group === key),
    }))
    .filter((group) => group.options.length > 0)

  return {
    rows: params.accessFees.map((draft) => {
      const calculatedRow = calculated.rows.find((row) => row.id === draft.id)
      return {
        id: draft.id,
        accessFeeId: draft.accessFeeId,
        label: calculatedRow?.label ?? draft.accessFeeId || 'Access fee',
        roomId: draft.roomId,
        roomLabel: draft.roomId ? roomsById.get(draft.roomId) ?? draft.roomId : 'Job level',
        qty: draft.qty,
        actualCostOverride: draft.actualCostOverride,
        notes: draft.notes,
        effectiveTotal: calculatedRow?.effectiveTotal ?? 0,
        overridden: calculatedRow?.overridden ?? false,
      }
    }),
    optionGroups,
    roomOptions: params.rooms.map((room) => ({ id: room.roomId, label: room.roomName || room.roomId })),
    total: calculated.total,
    allocation: params.pricingSummary?.accessFeeAllocation ?? null,
  }
}
```

- [ ] **Step 4: Wire VM**

In `estimateV2DetailsVm.ts`, import `DetailsAccessFeesVm` and `buildEstimateV2DetailsAccessFeesVm`, add `accessFees: DetailsAccessFeesVm` to `EstimateV2DetailsVm`, and add to `BuildDetailsVmParams`:

```ts
accessFees: EstimateV2AccessFeeDraft[]
accessFeeCatalog: EstimateV2AccessFeeOption[]
```

In `buildEstimateV2DetailsVm`, include:

```ts
const accessFees = buildEstimateV2DetailsAccessFeesVm({
  accessFees: params.accessFees,
  catalog: params.accessFeeCatalog,
  rooms: params.rooms,
  pricingSummary: params.pricingSummary,
})
```

Return `accessFees`.

- [ ] **Step 5: Pass state into VM hook**

In `useEstimateV2DetailsVm.ts`, include store collections and catalogs:

```ts
accessFees: state.accessFees,
accessFeeCatalog: state.catalogs.access_fees ?? [],
```

- [ ] **Step 6: Add mutations**

In `useEstimateV2DetailsMutations.ts`, import mutation helpers and add:

```ts
const addAccessFee = useCallback(() => {
  params.store.getState().setAccessFees((prev) => addAccessFeeDraft(prev))
  params.store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'access-fees' }))
}, [params.store])

const updateAccessFee = useCallback(
  (rowId: string, patch: Partial<EstimateV2AccessFeeDraft>) => {
    params.store.getState().setAccessFees((prev) => updateAccessFeeDraft(prev, rowId, patch))
    params.store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'access-fees' }))
  },
  [params.store]
)

const removeAccessFee = useCallback(
  (rowId: string) => {
    params.store.getState().setAccessFees((prev) => removeAccessFeeDraft(prev, rowId))
    params.store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'access-fees' }))
  },
  [params.store]
)
```

Return these actions.

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsAccessFees.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/crm/estimates/[id]/v2/details/_lib app/crm/estimates/[id]/v2/details/_state app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsAccessFees.test.ts
git commit -m "feat: add details access fee view model"
```

---

### Task 8: Details Page Access Fees UI

**Files:**
- Create: `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsAccessFees.tsx`
- Modify: `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsPageContent.tsx`
- Modify: `app/crm/estimates/[id]/v2/details/_components/__tests__/EstimateV2DetailsPageContent.test.tsx`

- [ ] **Step 1: Write failing component test**

In `EstimateV2DetailsPageContent.test.tsx`, add an assertion to the hydrated details render test:

```ts
expect(screen.getByRole('heading', { name: /access fees/i })).toBeInTheDocument()
expect(screen.getByRole('button', { name: /add access fee/i })).toBeInTheDocument()
```

If the test mocks `useEstimateV2DetailsPage`, add:

```ts
accessFees: {
  rows: [],
  optionGroups: [
    {
      key: 'ladders',
      label: 'Ladders',
      options: [{ id: 'LADDER', label: 'Ladder', access_group: 'ladders', fee_type: 'Labor', amount: 75, unit: 'each', notes: null }],
    },
  ],
  roomOptions: [],
  total: 0,
  allocation: null,
}
```

and actions:

```ts
addAccessFee: vi.fn(),
updateAccessFee: vi.fn(),
removeAccessFee: vi.fn(),
```

- [ ] **Step 2: Run component test and verify failure**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/details/_components/__tests__/EstimateV2DetailsPageContent.test.tsx
```

Expected: FAIL because no Access Fees section exists.

- [ ] **Step 3: Create component**

Create `EstimateV2DetailsAccessFees.tsx`:

```tsx
'use client'

import { Plus, Trash2 } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import type { DetailsAccessFeesVm } from '../_lib/estimateV2DetailsAccessFees'
import type { EstimateV2AccessFeeDraft } from '@/types/estimator/v2'

const inputClassName =
  'h-10 rounded-[6px] border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)] px-3 text-sm font-semibold text-[color:var(--crm-ui-ink)] outline-none focus:border-[color:var(--crm-ui-accent)]'
const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

export function EstimateV2DetailsAccessFees({
  vm,
  onAdd,
  onUpdate,
  onRemove,
}: {
  vm: DetailsAccessFeesVm
  onAdd: () => void
  onUpdate: (rowId: string, patch: Partial<EstimateV2AccessFeeDraft>) => void
  onRemove: (rowId: string) => void
}) {
  return (
    <div className="grid gap-4">
      {vm.allocation?.warning ? <CrmNotice tone="warning" compact>{vm.allocation.warning}</CrmNotice> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[color:var(--crm-ui-ink)]">
          Job-level access total: ${Math.round(vm.total).toLocaleString('en-US')}
        </div>
        <CrmButton type="button" tone="secondary" onClick={onAdd}>
          <span className="inline-flex items-center gap-2">
            <Plus size={16} aria-hidden="true" />
            <span>Add access fee</span>
          </span>
        </CrmButton>
      </div>

      {vm.rows.length === 0 ? (
        <div className="rounded-[6px] border border-dashed border-[color:var(--crm-ui-border)] p-4 text-sm text-[color:var(--crm-ui-muted)]">
          No access fees selected.
        </div>
      ) : (
        <div className="grid gap-3">
          {vm.rows.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-[6px] border border-[color:var(--crm-ui-border)] p-3 lg:grid-cols-[minmax(220px,1fr)_180px_100px_140px_minmax(180px,1fr)_auto]">
              <label className="grid gap-1">
                <span className={labelClassName}>Fee</span>
                <select className={inputClassName} value={row.accessFeeId} onChange={(event) => onUpdate(row.id, { accessFeeId: event.currentTarget.value })}>
                  <option value="">Select fee</option>
                  {vm.optionGroups.map((group) => (
                    <optgroup key={group.key} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className={labelClassName}>Room Context</span>
                <select className={inputClassName} value={row.roomId} onChange={(event) => onUpdate(row.id, { roomId: event.currentTarget.value })}>
                  <option value="">Job level</option>
                  {vm.roomOptions.map((room) => (
                    <option key={room.id} value={room.id}>{room.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className={labelClassName}>Qty</span>
                <input className={inputClassName} value={row.qty} inputMode="decimal" onChange={(event) => onUpdate(row.id, { qty: event.currentTarget.value })} />
              </label>
              <label className="grid gap-1">
                <span className={labelClassName}>Override</span>
                <input className={inputClassName} value={row.actualCostOverride} inputMode="decimal" placeholder="$" onChange={(event) => onUpdate(row.id, { actualCostOverride: event.currentTarget.value })} />
              </label>
              <label className="grid gap-1">
                <span className={labelClassName}>Notes</span>
                <input className={inputClassName} value={row.notes} onChange={(event) => onUpdate(row.id, { notes: event.currentTarget.value })} />
              </label>
              <div className="flex items-end justify-between gap-2">
                <div className="pb-2 text-sm font-black text-[color:var(--crm-ui-ink)]">
                  ${Math.round(row.effectiveTotal).toLocaleString('en-US')}
                </div>
                <CrmButton type="button" tone="danger" onClick={() => onRemove(row.id)} aria-label={`Remove ${row.label}`}>
                  <Trash2 size={16} aria-hidden="true" />
                </CrmButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Render component in details page**

In `EstimateV2DetailsPageContent.tsx`, import:

```tsx
import { EstimateV2DetailsAccessFees } from './EstimateV2DetailsAccessFees'
```

Add after Crew Size and before Rollers:

```tsx
<CrmSectionCard
  title="Access Fees"
  description="One-time job-level access charges. Optional room context is only a note for where the fee applies."
>
  <EstimateV2DetailsAccessFees
    vm={vm.accessFees}
    onAdd={actions.addAccessFee}
    onUpdate={actions.updateAccessFee}
    onRemove={actions.removeAccessFee}
  />
</CrmSectionCard>
```

- [ ] **Step 5: Run component test**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/details/_components/__tests__/EstimateV2DetailsPageContent.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/crm/estimates/[id]/v2/details/_components
git commit -m "feat: add access fees details section"
```

---

### Task 9: Summary Displays Access Fees With Catalog Labels

**Files:**
- Modify: `app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx`
- Modify: `app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx`

- [ ] **Step 1: Write failing summary test**

Add to summary component tests:

```ts
it('shows access fees as job-level charges with effective total', () => {
  render(<EstimateV2SummaryPageContent estimateId="estimate-1" />)

  expect(screen.getByText(/access fees/i)).toBeInTheDocument()
  expect(screen.getByText(/ladder/i)).toBeInTheDocument()
  expect(screen.getByText(/\$150/)).toBeInTheDocument()
})
```

Ensure the mocked summary payload includes:

```ts
inputs: {
  access_fees: [
    { id: 'row-1', access_fee_id: 'LADDER', qty: 2, actual_cost_override: null, notes: null },
  ],
},
pricing_summary: {
  sharedAccessCost: 150,
  accessFeeAllocation: { walls: 150, ceilings: 0, trim: 0, unallocated: 0, warning: null },
}
```

- [ ] **Step 2: Run summary test and verify failure**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx
```

Expected: FAIL until summary display is updated.

- [ ] **Step 3: Update summary rows**

In `EstimateV2SummaryPageContent.tsx`, update `buildChargeRows` so access fees prefer known effective fields, then override, then qty fallback:

```ts
const label = textValue(fee, 'label') || textValue(fee, 'display_name') || textValue(fee, 'access_fee_id') || 'Access fee'
const qty = numberValue(fee, ['qty']) ?? 1
const total =
  numberValue(fee, ['effective_total', 'final_total', 'raw_total', 'override_total']) ??
  numberValue(fee, ['actual_cost_override']) ??
  0
```

Add a visible shared access metric when `pricing_summary.sharedAccessCost > 0`:

```tsx
<CrmChip tone="accent">
  Access: ${Math.round(data.pricing_summary.sharedAccessCost).toLocaleString('en-US')}
</CrmChip>
```

- [ ] **Step 4: Run summary test**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/crm/estimates/[id]/v2/summary/_components
git commit -m "feat: show job-level access fees in summary"
```

---

### Task 10: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused estimator tests**

Run:

```powershell
node --experimental-specifier-resolution=node --test lib/estimator/__tests__/accessFees.test.ts lib/estimator/__tests__/pricingPolicies.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused component tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsAccessFees.test.ts app/crm/estimates/[id]/v2/details/_components/__tests__/EstimateV2DetailsPageContent.test.tsx app/crm/estimates/[id]/v2/_state/__tests__/estimateV2DirtySnapshot.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run full check if time allows**

Run:

```powershell
npm.cmd run check:full
```

Expected: PASS.

- [ ] **Step 5: Manual verification in app**

Start the dev server:

```powershell
npm.cmd run dev
```

Open an Estimator V2 details page and verify:

- Access Fees section appears after Crew Size.
- Add access fee creates a row.
- Fee select shows ladders, scaffolding, and specialty groups from rates/flags.
- Room Context can stay “Job level”.
- Quantity updates row total.
- Override replaces catalog total.
- Save Draft persists the row.
- Reload keeps the row.
- Summary includes access fee total.
- Pricing total increases by the access fee total.
- Trim allocation only appears when crown trim is active.

- [ ] **Step 6: Final commit if verification required changes**

```bash
git status --short
git add <changed-files>
git commit -m "test: verify estimator access fees"
```

---

## Self-Review Notes

- Spec coverage: schema, catalog, editor state, save contract, pricing allocation, details UI, summary display, and verification are covered.
- Scope kept to Estimator V2 canonical route and shared estimator modules. Quote aliases do not receive duplicate logic.
- No implementation should place pricing split rules in React components.
- The only schema behavior change is making `room_id` nullable for `estimate_access_fees`; room selection remains optional context.
- Main risk: `pricingPolicies.ts` fixture shapes may differ from the pseudo-fixture names in Task 6. Preserve the assertions and adapt only the test setup to existing helpers.
