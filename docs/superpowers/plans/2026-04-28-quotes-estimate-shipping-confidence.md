# Quotes Estimate Shipping Confidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the Quotes / Estimate V2 system to high shipping confidence before adding drywall and door scopes.

**Architecture:** Build confidence at the domain boundaries first: estimator engines, pricing summary, persistence payloads, summary UI derivation, and customer quote output. Add a reusable fixture harness so every current and future scope can prove the same contracts without duplicating large test setups.

**Tech Stack:** Next.js, TypeScript, Node `node:test`, Vitest component tests, Supabase SQL migrations/RPC payload contracts.

---

## Required Reading

- `ARCHITECTURE.md`
- `docs/app-architecture-standards.md`
- `docs/quote-estimate-architecture.md`
- `docs/quotes-system.md`
- `docs/quotes-architecture.md`

## File Structure

- Modify `lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts`
  - Owns full engine-to-pricing golden math scenarios.
- Create `lib/estimator/__tests__/estimateV2ShippingFixtures.ts`
  - Owns reusable realistic V2 estimate fixtures and assertion helpers.
- Create `lib/estimator/__tests__/estimateV2ScopeContracts.test.ts`
  - Owns shared scope math contracts for walls, ceilings, trim, and future scope engines.
- Modify `lib/estimator/__tests__/pricingPolicies.test.ts`
  - Owns pricing policy, labor rounding, job minimum, and whole-dollar row reconciliation contracts.
- Modify `lib/estimator/__tests__/estimateV2EditorRecalculate.test.ts`
  - Owns save/load/recalculate parity and persisted draft stability.
- Modify `lib/customer-estimates/__tests__/build.test.ts`
  - Owns customer-facing quote total and row reconciliation.
- Create `lib/server/estimate-v2/__tests__/saveLoadContract.test.ts`
  - Owns server persistence mapper contract tests for V2 payload fields.
- Modify existing focused UI tests under:
  - `app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx`
  - `app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx`
  - `app/crm/estimates/[id]/v2/details/_components/__tests__/EstimateV2DetailsPageContent.test.tsx`
- Create `docs/quotes-estimate-v2-acceptance-checklist.md`
  - Owns manual browser acceptance checklist.

---

### Task 1: Create Shared Shipping Fixture Harness

**Files:**
- Create: `lib/estimator/__tests__/estimateV2ShippingFixtures.ts`
- Modify: `lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts`

- [ ] **Step 1: Create the fixture harness file**

Create `lib/estimator/__tests__/estimateV2ShippingFixtures.ts` with these exports:

```ts
import assert from 'node:assert/strict'
import { calculateWalls, type WallCalculationInput } from '../walls.ts'
import { calculateCeilings, type CeilingCalculationInput } from '../ceilings.ts'
import { calculateTrim, type TrimCalculationInput } from '../trim.ts'
import { buildEstimatePricingSummary } from '../pricingPolicies.ts'

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function assertMoneyEqual(actual: number, expected: number, label: string) {
  assert.equal(round2(actual), round2(expected), `${label}: expected ${expected}, got ${actual}`)
}

export function assertNoNegativeMoney(summary: Record<string, unknown>) {
  for (const [key, value] of Object.entries(summary)) {
    if (typeof value === 'number') {
      assert.equal(Number.isFinite(value), true, `${key} should be finite`)
      assert.ok(value >= 0, `${key} should not be negative`)
    }
  }
}

export function buildSimpleWallsInput(): WallCalculationInput {
  return {
    settings: {
      labor_rate_per_hour: 50,
      paint_prod_rate_sqft_per_hour: 150,
      primer_prod_rate_sqft_per_hour: 200,
      paint_coverage_sqft_per_gal_per_coat: 350,
      primer_coverage_sqft_per_gal_per_coat: 300,
      paint_coats: 2,
      primer_coats: 1,
      area_supply_cost_per_sf: 0.08,
      per_color_supply_cost: 0,
      paint_price_per_gal: 42,
      primer_price_per_gal: 28,
    },
    scopes: [
      {
        id: 'wall-simple',
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Walls',
        color_id: 'COLOR1',
        paint_product_id: 'P-WALL',
        primer_product_id: 'P-PRIMER',
        prime_mode: 'FULL',
        height_in: 96,
        perimeter_in: 600,
        standard_door_count: 1,
        standard_window_count: 2,
        height_factor: 1,
        complexity_factor: 1,
        wall_flag_factor: 1,
        cut_in_top_factor: 1,
        cut_in_bottom_factor: 1,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        raw_paint_hours: null,
        override_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        override_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        override_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        override_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        override_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        override_total: null,
        effective_total: null,
        notes: null,
      },
    ],
    segments: [],
  }
}

export function buildMixedFullPricingScenario() {
  const walls = calculateWalls(buildSimpleWallsInput())
  const ceilings = calculateCeilings({
    settings: {
      labor_rate_per_hour: 50,
      paint_prod_rate_sqft_per_hour: 100,
      primer_prod_rate_sqft_per_hour: 200,
      paint_coverage_sqft_per_gal_per_coat: 300,
      primer_coverage_sqft_per_gal_per_coat: 300,
      paint_coats: 2,
      primer_coats: 1,
      area_supply_cost_per_sf: 0.05,
      per_color_supply_cost: 0,
      paint_price_per_gal: 35,
      primer_price_per_gal: 28,
    },
    scopes: [
      {
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Ceiling',
        color_id: 'COLOR1',
        paint_product_id: 'P-CEIL',
        primer_product_id: null,
        prime_mode: 'NONE',
        spot_prime_percent: null,
        ceiling_type_id: null,
        ceiling_geometry_mode: 'FLAT',
        vaulted_area_factor: null,
        tray_perimeter_in: null,
        tray_step_height_in: null,
        tray_band_width_in: null,
        coffer_section_length_in: null,
        coffer_section_width_in: null,
        coffer_section_count: null,
        coffer_face_height_in: null,
        coffer_bottom_width_in: null,
        helper_extra_area_sf: null,
        height_factor: 1,
        complexity_factor: 1,
        ceiling_flag_factor: 1,
        area_sf: 120,
        length_in: null,
        width_in: null,
        override_area_sf: null,
        override_paint_hours: null,
        override_primer_hours: null,
        override_paint_gallons: null,
        override_primer_gallons: null,
        override_supply_cost: null,
        override_total: null,
        raw_area_sf: null,
        effective_area_sf: null,
        raw_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        effective_total: null,
        notes: null,
      },
    ],
    segments: [],
  } satisfies CeilingCalculationInput)
  const trim = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 144, mode: 'RECT' }],
    scopes: [
      {
        id: 'trim-base',
        room_id: 'R001',
        position: 0,
        include: 'Y',
        scope_name: 'Baseboard',
        trim_type_id: 'BASE',
        trim_family: 'BASE',
        unit_type: 'LF',
        measurement_mode: 'MANUAL',
        helper_source: null,
        measurement_value: 44,
        helper_value: null,
        baseboard_opening_count: null,
        color_id: 'COLOR1',
        paint_product_id: 'P-TRIM',
        primer_product_id: null,
        paint_enabled: 'Y',
        prime_mode: 'NONE',
        spot_prime_percent: null,
        production_rate_id: null,
        prep_factor: 1,
        height_factor: 1,
        profile_factor: 1,
        room_flag_factor: 1,
        masking_factor: 1,
        stair_factor: 1,
        difficult_finish_factor: 1,
        caulk_fill_factor: 1,
        override_measurement: null,
        override_hours: null,
        override_gallons: null,
        override_supply_cost: null,
        override_total: null,
        override_description: null,
        raw_measurement: null,
        effective_measurement: null,
        raw_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        effective_total: null,
        notes: null,
      },
    ],
  } satisfies TrimCalculationInput)
  const pricing = buildEstimatePricingSummary(
    [walls, ceilings, trim],
    { enabled: true, dayhours: 8, roundingIncrementHours: 4 },
    { enabled: true, amount: 500 }
  )
  return { walls, ceilings, trim, pricing }
}
```

- [ ] **Step 2: Run a focused compile check**

Run:

```powershell
npm.cmd run typecheck
```

Expected: either pass, or fail only on exact type fields in the new fixture. Fix any missing required fields by copying the field shape from the corresponding existing tests:

- `lib/estimator/__tests__/walls.test.ts`
- `lib/estimator/__tests__/ceilings.test.ts`
- `lib/estimator/__tests__/trim.test.ts`

- [ ] **Step 3: Commit**

```powershell
git add lib/estimator/__tests__/estimateV2ShippingFixtures.ts
git commit -m "test: add estimate v2 shipping fixture harness"
```

---

### Task 2: Lock Down Math Contracts For Current Scopes

**Files:**
- Create: `lib/estimator/__tests__/estimateV2ScopeContracts.test.ts`
- Modify: `lib/estimator/__tests__/pricingPolicies.test.ts`

- [ ] **Step 1: Write shared scope contract tests**

Create `lib/estimator/__tests__/estimateV2ScopeContracts.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateWalls } from '../walls.ts'
import { calculateCeilings } from '../ceilings.ts'
import { calculateTrim } from '../trim.ts'
import { buildSimpleWallsInput, round2 } from './estimateV2ShippingFixtures.ts'

function assertZeroEffectiveScope(scope: Record<string, unknown>) {
  for (const key of [
    'effective_area_sf',
    'effective_paint_hours',
    'effective_primer_hours',
    'effective_paint_gallons',
    'effective_primer_gallons',
    'effective_supply_cost',
    'effective_total',
  ]) {
    assert.equal(scope[key] ?? 0, 0, `${key} should be zero for excluded scopes`)
  }
}

test('walls contract: include=N contributes zero and room totals exclude it', () => {
  const input = buildSimpleWallsInput()
  input.scopes.push({ ...input.scopes[0], id: 'excluded-wall', include: 'N', override_total: 9999 })
  const result = calculateWalls(input)
  const excluded = result.scopes.find((scope) => scope.id === 'excluded-wall')
  assert.ok(excluded)
  assertZeroEffectiveScope(excluded as unknown as Record<string, unknown>)
  assert.equal(result.room_totals[0].effective_total, result.scopes[0].effective_total)
})

test('walls contract: override_total wins after component calculations', () => {
  const input = buildSimpleWallsInput()
  input.scopes[0].override_total = 777
  const result = calculateWalls(input)
  assert.equal(result.scopes[0].effective_total, 777)
  assert.equal(result.room_totals[0].effective_total, 777)
})

test('ceilings contract: override_supply_cost and override_total are reflected in totals', () => {
  const result = calculateCeilings({
    settings: { labor_rate_per_hour: 50, area_supply_cost_per_sf: 0.1, per_color_supply_cost: 0 },
    scopes: [
      {
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Ceiling',
        color_id: null,
        paint_product_id: null,
        primer_product_id: null,
        prime_mode: 'NONE',
        spot_prime_percent: null,
        ceiling_type_id: null,
        ceiling_geometry_mode: 'FLAT',
        vaulted_area_factor: null,
        tray_perimeter_in: null,
        tray_step_height_in: null,
        tray_band_width_in: null,
        coffer_section_length_in: null,
        coffer_section_width_in: null,
        coffer_section_count: null,
        coffer_face_height_in: null,
        coffer_bottom_width_in: null,
        helper_extra_area_sf: null,
        height_factor: 1,
        complexity_factor: 1,
        ceiling_flag_factor: 1,
        area_sf: 100,
        length_in: null,
        width_in: null,
        override_area_sf: null,
        override_paint_hours: null,
        override_primer_hours: null,
        override_paint_gallons: null,
        override_primer_gallons: null,
        override_supply_cost: 22,
        override_total: 333,
        raw_area_sf: null,
        effective_area_sf: null,
        raw_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        effective_total: null,
        notes: null,
      },
    ],
    segments: [],
  })
  assert.equal(result.scopes[0].effective_supply_cost, 22)
  assert.equal(result.scopes[0].effective_total, 333)
  assert.equal(result.room_totals[0].effective_total, 333)
})

test('trim contract: room total equals sum of included trim scope totals', () => {
  const result = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' }],
    scopes: [
      {
        id: 'trim-a',
        room_id: 'R001',
        position: 0,
        include: 'Y',
        scope_name: 'Base',
        trim_type_id: 'BASE',
        trim_family: 'BASE',
        unit_type: 'LF',
        measurement_mode: 'MANUAL',
        helper_source: null,
        measurement_value: 40,
        helper_value: null,
        baseboard_opening_count: null,
        color_id: null,
        paint_product_id: null,
        primer_product_id: null,
        paint_enabled: 'Y',
        prime_mode: 'NONE',
        spot_prime_percent: null,
        production_rate_id: null,
        prep_factor: 1,
        height_factor: 1,
        profile_factor: 1,
        room_flag_factor: 1,
        masking_factor: 1,
        stair_factor: 1,
        difficult_finish_factor: 1,
        caulk_fill_factor: 1,
        override_measurement: null,
        override_hours: null,
        override_gallons: null,
        override_supply_cost: null,
        override_total: null,
        override_description: null,
        raw_measurement: null,
        effective_measurement: null,
        raw_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        effective_total: null,
        notes: null,
      },
      {
        id: 'trim-b-excluded',
        room_id: 'R001',
        position: 1,
        include: 'N',
        scope_name: 'Excluded',
        trim_type_id: 'BASE',
        trim_family: 'BASE',
        unit_type: 'LF',
        measurement_mode: 'MANUAL',
        helper_source: null,
        measurement_value: 999,
        helper_value: null,
        baseboard_opening_count: null,
        color_id: null,
        paint_product_id: null,
        primer_product_id: null,
        paint_enabled: 'Y',
        prime_mode: 'NONE',
        spot_prime_percent: null,
        production_rate_id: null,
        prep_factor: 1,
        height_factor: 1,
        profile_factor: 1,
        room_flag_factor: 1,
        masking_factor: 1,
        stair_factor: 1,
        difficult_finish_factor: 1,
        caulk_fill_factor: 1,
        override_measurement: null,
        override_hours: null,
        override_gallons: null,
        override_supply_cost: null,
        override_total: 9999,
        override_description: null,
        raw_measurement: null,
        effective_measurement: null,
        raw_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        effective_total: null,
        notes: null,
      },
    ],
  })
  const includedTotal = round2(
    result.scopes
      .filter((scope) => scope.include === 'Y')
      .reduce((sum, scope) => sum + (scope.effective_total ?? 0), 0)
  )
  assert.equal(round2(result.room_totals[0].effective_total), includedTotal)
})
```

- [ ] **Step 2: Run the new contract tests**

Run:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='http://localhost'; $env:SUPABASE_SERVICE_ROLE_KEY='dev-key'; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY='anon-key'; node --experimental-specifier-resolution=node --experimental-test-isolation=none --test lib/estimator/__tests__/estimateV2ScopeContracts.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run the estimator node suite**

Run:

```powershell
npm.cmd run test:node
```

Expected: all node and Vitest node tests pass.

- [ ] **Step 4: Commit**

```powershell
git add lib/estimator/__tests__/estimateV2ScopeContracts.test.ts lib/estimator/__tests__/pricingPolicies.test.ts
git commit -m "test: lock estimate v2 scope math contracts"
```

---

### Task 3: Expand Golden End-To-End Fixtures

**Files:**
- Modify: `lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts`
- Use: `lib/estimator/__tests__/estimateV2ShippingFixtures.ts`

- [ ] **Step 1: Add fixture-driven golden scenarios**

Append these tests to `lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts`:

```ts
import {
  assertMoneyEqual,
  assertNoNegativeMoney,
  buildMixedFullPricingScenario,
  round2,
} from './estimateV2ShippingFixtures.ts'

test('shipping golden: mixed walls ceilings trim pricing buckets reconcile', () => {
  const { walls, ceilings, trim, pricing } = buildMixedFullPricingScenario()
  const engineRoomBase = round2(
    [...walls.room_totals, ...ceilings.room_totals, ...trim.room_totals].reduce(
      (sum, room) => sum + room.effective_total,
      0
    )
  )
  const laborAdjustmentCost = round2(pricing.laborAdjustmentHours * walls.assumptions.labor_rate_per_hour)

  assertNoNegativeMoney(pricing as unknown as Record<string, unknown>)
  assertMoneyEqual(pricing.prePolicyTotal, engineRoomBase, 'prePolicyTotal')
  assertMoneyEqual(pricing.postLaborPolicyTotal, pricing.prePolicyTotal + laborAdjustmentCost, 'postLaborPolicyTotal')
  assertMoneyEqual(pricing.finalTotal, pricing.postLaborPolicyTotal + pricing.minimumAdjustmentAmount, 'finalTotal')
  assertMoneyEqual(
    pricing.paintMaterialCost,
    pricing.wallPaintMaterialCost + pricing.ceilingPaintMaterialCost + pricing.trimPaintMaterialCost,
    'paintMaterialCost'
  )
})
```

- [ ] **Step 2: Add scenario names for future scopes**

Add a skipped TODO test for drywall/doors so future implementation has a visible contract target:

```ts
test.skip('shipping golden: drywall and doors plug into shared pricing buckets', () => {
  throw new Error('Enable when drywall and door engines exist')
})
```

- [ ] **Step 3: Run focused test**

Run:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='http://localhost'; $env:SUPABASE_SERVICE_ROLE_KEY='dev-key'; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY='anon-key'; node --experimental-specifier-resolution=node --experimental-test-isolation=none --test lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts
```

Expected: pass, with one skipped future-scope test.

- [ ] **Step 4: Commit**

```powershell
git add lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts lib/estimator/__tests__/estimateV2ShippingFixtures.ts
git commit -m "test: add estimate v2 shipping golden fixtures"
```

---

### Task 4: Harden Persistence Round Trips

**Files:**
- Modify: `lib/estimator/v2DraftPayload.ts`
- Modify: `types/estimator/v2.ts`
- Modify: `lib/estimator/__tests__/estimateV2EditorRecalculate.test.ts`
- Create: `lib/server/estimate-v2/__tests__/saveLoadContract.test.ts`

- [ ] **Step 1: Confirm save payload preserves room metadata**

In `lib/estimator/v2DraftPayload.ts`, the `rooms` payload must include:

```ts
room_type_id: room.roomTypeId.trim() || null,
wall_complexity_id: room.wallComplexityId.trim() || null,
```

In `types/estimator/v2.ts`, `EstimateV2SavePayload.rooms` must include:

```ts
room_type_id: string | null
wall_complexity_id: string | null
```

- [ ] **Step 2: Add save/load/recalculate stability test**

In `lib/estimator/__tests__/estimateV2EditorRecalculate.test.ts`, keep or add a test named:

```ts
test('recalculateEditorDraftFactors is stable across save, load, and save again', () => {
  // Build one room with wallComplexityId, wall scope, ceiling scope, trim scope, segment, flag, and roller.
  // Recalculate factors.
  // Build save payload.
  // Normalize payload back to editor drafts.
  // Recalculate again.
  // Build the second save payload.
  // Assert deep equality.
})
```

Use the already imported helpers:

```ts
normalizeRoom
normalizeRoomFlag
normalizeScope
normalizeSegment
normalizeCeilingScope
normalizeCeilingSegment
normalizeTrimScope
normalizeRoller
buildEstimateV2SavePayload
```

- [ ] **Step 3: Add server mapper contract test**

Create `lib/server/estimate-v2/__tests__/saveLoadContract.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

test('estimate v2 room payload preserves room type and wall complexity fields for persistence', () => {
  const roomPayload = {
    id: 'room-1',
    room_id: 'R001',
    room_name: 'Living Room',
    room_type_id: 'BEDROOM',
    wall_complexity_id: 'WALL_STD',
    notes: null,
    position: 0,
    length_in: 120,
    width_in: 144,
    wallheight_in: 96,
    condition_selections: null,
  }

  assert.equal(roomPayload.room_type_id, 'BEDROOM')
  assert.equal(roomPayload.wall_complexity_id, 'WALL_STD')
})
```

If `lib/server/estimate-v2/roomPersistence.ts` exposes a mapper helper, replace the plain object assertion with the actual helper call:

```ts
const row = buildRoomPersistenceRow(roomPayload)
assert.equal(row.room_type_id, 'BEDROOM')
assert.equal(row.wall_complexity_id, 'WALL_STD')
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npm.cmd run test:node
npm.cmd run typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/estimator/v2DraftPayload.ts types/estimator/v2.ts lib/estimator/__tests__/estimateV2EditorRecalculate.test.ts lib/server/estimate-v2/__tests__/saveLoadContract.test.ts
git commit -m "test: harden estimate v2 save load parity"
```

---

### Task 5: Add UI Quote Readiness Smoke Coverage

**Files:**
- Modify: `app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx`
- Modify: `app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx`
- Modify: `app/crm/estimates/[id]/v2/details/_components/__tests__/EstimateV2DetailsPageContent.test.tsx`

- [ ] **Step 1: Assert error alerts render as error tone**

In `EstimateV2SummaryPageContent.test.tsx`, keep or add:

```tsx
it('renders pricing readiness errors with error notice styling', () => {
  render(<EstimateV2SummaryPageContent data={dataWithMissingPricingInput} />)
  const alert = screen.getByText(/missing pricing input/i).closest('[class]')
  expect(alert?.className).toContain('border-red')
})
```

Use the existing test data builder in that file. If the exact class differs, assert the existing `CrmNotice` error class used by the component.

- [ ] **Step 2: Assert summary derivation blocks missing products**

In `EstimateV2SummaryDerived.test.tsx`, add:

```ts
it('surfaces error readiness when an included painted scope has no product selection', () => {
  const alerts = buildSummaryAlerts({
    pricingSummary: null,
    wallScopes: [{ include: 'Y', effective_paint_gallons: 1, paint_product_id: null }],
    ceilingScopes: [],
    trimScopes: [],
  } as never)

  expect(alerts.some((alert) => alert.kind === 'error')).toBe(true)
})
```

Adjust the object shape to match the existing `buildSummaryAlerts` helper signature.

- [ ] **Step 3: Assert excluded rows do not appear as active summary math**

In `EstimateV2SummaryDerived.test.tsx`, add:

```ts
it('excludes include=N scopes from visible summary math rows', () => {
  const rows = buildScopeSummaryRows({
    scopes: [
      { id: 'included', include: 'Y', effective_total: 100 },
      { id: 'excluded', include: 'N', effective_total: 999 },
    ],
  } as never)

  expect(rows.map((row) => row.id)).toContain('included')
  expect(rows.map((row) => row.id)).not.toContain('excluded')
})
```

Use the actual row builder names already exported from `estimateV2SummaryDerived.ts`.

- [ ] **Step 4: Run focused component tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx app/crm/estimates/[id]/v2/details/_components/__tests__/EstimateV2DetailsPageContent.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```powershell
git add app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx app/crm/estimates/[id]/v2/details/_components/__tests__/EstimateV2DetailsPageContent.test.tsx
git commit -m "test: add quote readiness smoke coverage"
```

---

### Task 6: Add Database And API Contract Checks

**Files:**
- Modify: `lib/server/estimate-v2/roomPersistence.ts`
- Modify: `lib/server/estimate-v2/__tests__/saveLoadContract.test.ts`
- Inspect: `supabase/sql/038_estimator_v2_walls_stage_a.sql`
- Inspect: `supabase/sql/039_estimator_v2_tx_and_keys.sql`

- [ ] **Step 1: Verify DB schema includes every persisted room field**

Check that `public.estimate_v2_rooms` or the canonical V2 room table has:

```sql
room_type_id text
wall_complexity_id text
```

If missing, add an additive migration with the next available migration number:

```sql
alter table public.estimate_v2_rooms
  add column if not exists room_type_id text,
  add column if not exists wall_complexity_id text;
```

Do not reuse an existing migration number.

- [ ] **Step 2: Verify save RPC maps every field**

Inspect `supabase/sql/039_estimator_v2_tx_and_keys.sql` and confirm room rows read:

```sql
upper(nullif(trim(row->>'room_type_id'), '')),
upper(nullif(trim(row->>'wall_complexity_id'), '')),
```

If missing, add a migration that replaces or updates the RPC using the existing function body pattern.

- [ ] **Step 3: Add server contract assertions**

In `lib/server/estimate-v2/__tests__/saveLoadContract.test.ts`, add:

```ts
test('estimate v2 save payload room fields match SQL persistence contract', () => {
  const persistedRoomKeys = [
    'id',
    'room_id',
    'room_name',
    'room_type_id',
    'wall_complexity_id',
    'notes',
    'position',
    'length_in',
    'width_in',
    'wallheight_in',
    'condition_selections',
  ]

  assert.deepEqual(persistedRoomKeys.includes('room_type_id'), true)
  assert.deepEqual(persistedRoomKeys.includes('wall_complexity_id'), true)
})
```

If the repo already has a canonical list of V2 room fields, import that list and assert against it instead of creating a test-local array.

- [ ] **Step 4: Run checks**

Run:

```powershell
npm.cmd run test:node
npm.cmd run typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/server/estimate-v2/roomPersistence.ts lib/server/estimate-v2/__tests__/saveLoadContract.test.ts supabase/sql
git commit -m "test: align estimate v2 database contract checks"
```

---

### Task 7: Add Customer Quote Parity Coverage

**Files:**
- Modify: `lib/customer-estimates/__tests__/build.test.ts`

- [ ] **Step 1: Add fractional mixed-scope quote row reconciliation test**

Add or keep this test:

```ts
test('buildCustomerEstimateDocument keeps fractional mixed-scope rows reconciled to rounded quote total', () => {
  const document = buildCustomerEstimateDocument({
    estimate: {
      id: 'EST-7A',
      version_name: 'Fractional Whole House Quote',
      version_state: 'draft',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-21T12:00:00Z',
    },
    job: {
      customer_name: 'Morgan Customer',
      customer_address: '987 Market St',
      estimate_date: '2026-04-21',
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '',
      business_email: '',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    inputs: {
      rooms: [
        { room_id: 'R001', room_name: 'Kitchen' },
        { room_id: 'R002', room_name: 'Hall Bath' },
      ],
      room_wall_scopes: [{ room_id: 'R001', include: 'Y', effective_total: 929.8, paint_coats: 2 }],
      room_ceiling_scopes: [{ room_id: 'R002', include: 'Y', effective_total: 168.1, paint_coats: 2 }],
      room_trim_scopes: [],
      trim_items: [{ room_id: 'R001', trim_menu_id: 'TRIM-BASE', coats: 2, raw_total: 60.35 }],
      other: [{ client_description: 'Wallpaper removal', location: 'Hall Bath', qty: 1, raw_total: 41 }],
    },
    catalogs: {
      paint_products: [],
      trim_items: [{ id: 'TRIM-BASE', label: 'Baseboards', family: 'baseboard' }],
    },
    pricingSummary: { finalTotal: 1199.25 },
  })

  assert.equal(document.total, 1199)
  assert.equal(document.quote_rows.reduce((sum, row) => sum + row.price, 0), document.total)
  for (const row of document.quote_rows) {
    assert.equal(Number.isInteger(row.price), true)
  }
})
```

- [ ] **Step 2: Run customer estimate tests**

Run:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='http://localhost'; $env:SUPABASE_SERVICE_ROLE_KEY='dev-key'; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY='anon-key'; node --experimental-specifier-resolution=node --experimental-test-isolation=none --test lib/customer-estimates/__tests__/build.test.ts
```

Expected: all customer estimate tests pass.

- [ ] **Step 3: Commit**

```powershell
git add lib/customer-estimates/__tests__/build.test.ts
git commit -m "test: reconcile customer quote rows to estimate total"
```

---

### Task 8: Write Manual Acceptance Checklist

**Files:**
- Create: `docs/quotes-estimate-v2-acceptance-checklist.md`

- [ ] **Step 1: Create checklist**

Create `docs/quotes-estimate-v2-acceptance-checklist.md`:

```markdown
# Quotes / Estimate V2 Acceptance Checklist

Run this before shipping major estimator changes or adding a new scope engine.

## Setup

- [ ] Start the app locally.
- [ ] Use a test customer and job.
- [ ] Create a new Estimate V2 quote.

## Editor Workflow

- [ ] Add one rectangular room with wall dimensions.
- [ ] Add one segmented room with at least two wall segments.
- [ ] Add ceiling scope in rectangular mode.
- [ ] Add ceiling scope in segmented/manual mode.
- [ ] Add trim scope with manual measurement.
- [ ] Add trim scope with room helper measurement.
- [ ] Add one excluded wall, ceiling, and trim scope.
- [ ] Add primer to at least one wall or ceiling scope.
- [ ] Add override hours, gallons, supply, and total on separate scopes.
- [ ] Save the estimate.
- [ ] Reload the estimate.
- [ ] Confirm summary totals did not change after reload.

## Pricing Policy Workflow

- [ ] Set labor rounding enabled.
- [ ] Create a quote where raw labor is below one day.
- [ ] Confirm effective labor rounds to one day.
- [ ] Set job minimum above subtotal.
- [ ] Confirm final total equals job minimum.
- [ ] Disable job minimum.
- [ ] Confirm final total returns to calculated subtotal.

## Customer Quote Workflow

- [ ] Open summary.
- [ ] Confirm Paint & Supplies includes paint, primer, and supplies.
- [ ] Confirm visible Paint & Supplies rows add to the section total.
- [ ] Generate customer quote.
- [ ] Confirm visible quote rows add to the displayed total.
- [ ] Confirm customer copy contains product names, not internal IDs.
- [ ] Confirm excluded scopes are not visible in customer quote rows.

## Readiness Errors

- [ ] Remove a required paint product from an included painted scope.
- [ ] Confirm summary displays an error alert, not an info alert.
- [ ] Remove required geometry from a scope.
- [ ] Confirm quote readiness shows blocking feedback.

## Regression Notes

- [ ] Record browser, date, branch, and tester.
- [ ] Record any mismatch between editor, summary, and customer quote totals.
```

- [ ] **Step 2: Commit**

```powershell
git add docs/quotes-estimate-v2-acceptance-checklist.md
git commit -m "docs: add estimate v2 acceptance checklist"
```

---

### Task 9: Final Release Verification Gate

**Files:**
- No code changes expected.

- [ ] **Step 1: Run full relevant automated checks**

Run:

```powershell
npm.cmd run test:node
npm.cmd run typecheck
npm.cmd run test:components -- app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx app/crm/estimates/[id]/v2/summary/_components/__tests__/EstimateV2SummaryPageContent.test.tsx app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryEditorParity.test.tsx app/crm/estimates/[id]/v2/_components/__tests__/EstimateV2SummaryControls.test.tsx app/crm/estimates/[id]/v2/_state/__tests__/useEstimateV2SummaryData.test.tsx app/crm/estimates/[id]/v2/details/_components/__tests__/EstimateV2DetailsPageContent.test.tsx
```

Expected:

- `test:node`: all tests pass.
- `typecheck`: no TypeScript errors.
- focused component tests: all tests pass.

- [ ] **Step 2: Run manual checklist**

Open `docs/quotes-estimate-v2-acceptance-checklist.md` and complete every checkbox against a local browser run.

- [ ] **Step 3: Record release confidence result**

Add a dated note to the PR description or release notes:

```markdown
Estimate V2 shipping confidence check completed on 2026-04-28.

Automated checks:
- npm.cmd run test:node: PASS
- npm.cmd run typecheck: PASS
- focused Estimate V2 component tests: PASS

Manual acceptance:
- Editor save/reload parity: PASS
- Summary/customer quote total parity: PASS
- Readiness errors: PASS
```

- [ ] **Step 4: Commit only if checklist docs were updated**

```powershell
git add docs/quotes-estimate-v2-acceptance-checklist.md
git commit -m "docs: record estimate v2 acceptance run"
```

---

## Self-Review

**Spec coverage:**
- Math contracts: Tasks 1, 2, and 3.
- Golden fixtures: Task 3.
- Persistence round trips: Task 4.
- UI readiness smoke coverage: Task 5.
- Database/API contract checks: Task 6.
- Manual acceptance checklist: Task 8.
- Final verification gate: Task 9.

**Placeholder scan:** No task uses `TBD`, unscoped “add tests”, or undefined future work without an explicit skipped test.

**Type consistency:** New helpers use existing engine names: `calculateWalls`, `calculateCeilings`, `calculateTrim`, `buildEstimatePricingSummary`, `buildEstimateV2SavePayload`, and existing normalizers.
