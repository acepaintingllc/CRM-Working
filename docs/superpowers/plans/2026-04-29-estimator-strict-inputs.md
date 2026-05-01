# Estimator Strict Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove hidden estimator business fallbacks so missing system inputs surface as missing inputs instead of silently pricing from hardcoded defaults.

**Architecture:** Keep calculation ownership in `lib/estimator`. Preserve safe numeric outputs, but make configured business values resolve to `0` when absent and report the missing field through `missing_inputs`. Leave quote/template policy defaults editable through existing settings paths.

**Tech Stack:** TypeScript, Node test runner, Next.js, Supabase-backed estimator catalogs.

---

## File Map

- Modify `lib/estimator/wallsHelpers.ts`: remove hidden `DEFAULTS` pricing/rate fallbacks from `resolveSettings`.
- Modify `lib/estimator/ceilings.ts`: require vaulted factor and measured plane count instead of assuming values.
- Modify `lib/estimator/doors.ts`: require quantity and sides instead of assuming `1` and `2`.
- Modify `app/crm/estimates/[id]/v2/_lib/estimateV2EditorNormalize.ts`: stop defaulting vaulted plane count in the editor draft.
- Modify `lib/estimator/__tests__/ceilings.test.ts`: add strict vaulted behavior tests and update missing assumption expectations.
- Modify `lib/estimator/__tests__/doors.test.ts`: add required quantity/sides tests.
- Modify any existing tests that asserted hidden defaults as the intended behavior.

---

### Task 1: Strict Shared Settings Resolution

**Files:**
- Modify: `lib/estimator/__tests__/ceilings.test.ts`
- Modify: `lib/estimator/wallsHelpers.ts`

- [ ] **Step 1: Write the failing test**

Add this test near the existing missing-pricing-assumptions test in `lib/estimator/__tests__/ceilings.test.ts`:

```ts
test('missing ceiling pricing assumptions do not use hidden business fallback values', () => {
  const result = calculateCeilings({
    settings: { area_supply_cost_per_sf: 0, per_color_supply_cost: 0 },
    scopes: [makeScope({ prime_mode: 'NONE' })],
    segments: [],
  })

  assert.equal(result.assumptions.labor_rate_per_hour, 0)
  assert.equal(result.assumptions.paint_prod_rate_sqft_per_hour, 0)
  assert.equal(result.assumptions.paint_coverage_sqft_per_gal_per_coat, 0)
  assert.equal(result.assumptions.paint_coats, 0)
  assert.equal(result.assumptions.paint_price_per_gal, 0)
  assert.equal(result.scopes[0].raw_paint_hours, 0)
  assert.equal(result.scopes[0].raw_paint_gallons, 0)
  assert.equal(result.scopes[0].raw_total, 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --experimental-specifier-resolution=node --experimental-test-isolation=none --test lib/estimator/__tests__/ceilings.test.ts
```

Expected: FAIL because `resolveSettings` still supplies hidden defaults such as labor rate, production rate, coverage, coats, and paint price.

- [ ] **Step 3: Implement minimal shared settings change**

In `lib/estimator/wallsHelpers.ts`, remove business values from the `DEFAULTS` object except door/window deductions. Update `resolveSettings` so pricing/rate/coats fields use configured values or `0`:

```ts
const DEFAULTS = {
  standard_door_deduction_sf: 21,
  standard_window_deduction_sf: 15,
} as const
```

For these fields, use the following pattern:

```ts
paint_prod_rate_sqft_per_hour: pos(n(settings?.paint_prod_rate_sqft_per_hour)) ?? 0,
primer_prod_rate_sqft_per_hour: pos(n(settings?.primer_prod_rate_sqft_per_hour)) ?? 0,
paint_coverage_sqft_per_gal_per_coat: pos(n(settings?.paint_coverage_sqft_per_gal_per_coat)) ?? 0,
primer_coverage_sqft_per_gal_per_coat: pos(n(settings?.primer_coverage_sqft_per_gal_per_coat)) ?? 0,
paint_coats: pos(n(settings?.paint_coats)) ?? 0,
primer_coats: pos(n(settings?.primer_coats)) ?? 0,
spot_prime_percent: nonNeg(n(settings?.spot_prime_percent)) ?? 0,
labor_rate_per_hour: pos(n(settings?.labor_rate_per_hour)) ?? 0,
area_supply_cost_per_sf: pos(n(settings?.area_supply_cost_per_sf)) ?? areaSupplyFromCatalog ?? 0,
per_color_supply_cost: pos(n(settings?.per_color_supply_cost)) ?? perColorFromCatalog ?? 0,
paint_price_per_gal: pos(n(settings?.paint_price_per_gal)) ?? 0,
primer_price_per_gal: pos(n(settings?.primer_price_per_gal)) ?? 0,
```

- [ ] **Step 4: Run test to verify it passes**

Run the same command as Step 2. Expected: PASS for the new test and existing ceiling tests after any necessary expectation updates.

---

### Task 2: Explicit Vaulted Ceiling Inputs

**Files:**
- Modify: `lib/estimator/__tests__/ceilings.test.ts`
- Modify: `lib/estimator/ceilings.ts`
- Modify: `app/crm/estimates/[id]/v2/_lib/estimateV2EditorNormalize.ts`

- [ ] **Step 1: Write failing tests**

Add these tests in `lib/estimator/__tests__/ceilings.test.ts` near the vaulted tests:

```ts
test('vaulted measured inputs require plane count', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    scopes: [
      makeScope({
        ceiling_geometry_mode: 'VAULTED',
        vaulted_ridge_length_in: 180,
        vaulted_slope_length_in: 120,
        vaulted_plane_count: null,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  })

  assert.ok(result.missing_inputs.some((input) => input.field === 'vaulted_plane_count'))
  approx(result.scopes[0].raw_area_sf, 144)
})

test('vaulted factor helper requires configured vaulted area factor', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    scopes: [
      makeScope({
        ceiling_geometry_mode: 'VAULTED',
        vaulted_area_factor: null,
        vaulted_ridge_length_in: null,
        vaulted_slope_length_in: null,
        vaulted_plane_count: null,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  })

  assert.ok(result.missing_inputs.some((input) => input.field === 'vaulted_area_factor'))
  approx(result.scopes[0].helper_extra_area_sf ?? null, 0)
  approx(result.scopes[0].raw_area_sf, 144)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --experimental-specifier-resolution=node --experimental-test-isolation=none --test lib/estimator/__tests__/ceilings.test.ts
```

Expected: FAIL because the calculator still defaults plane count to `2` and vaulted factor to `1.2`.

- [ ] **Step 3: Implement minimal vaulted changes**

In `lib/estimator/ceilings.ts`:

- Change `resolveCeilingHelperArea` to accept `missing: MissingInput[]` and the scope.
- If mode is `VAULTED`, no direct `area_sf`, and no measured vaulted area, require `vaulted_area_factor`.
- Change `resolveVaultedMeasuredArea` to accept `missing: MissingInput[]` and require plane count when ridge and slope are present.
- Remove `?? 1.2` and `?? 2`.

Use missing input messages with `pushMissingRequiredAssumption(missing, scope, 'vaulted_area_factor')` and `pushMissingRequiredAssumption(missing, scope, 'vaulted_plane_count')`.

In `app/crm/estimates/[id]/v2/_lib/estimateV2EditorNormalize.ts`, change:

```ts
vaultedPlaneCount: toInputNumber(row.vaulted_plane_count) || '2',
```

to:

```ts
vaultedPlaneCount: toInputNumber(row.vaulted_plane_count),
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same command as Step 2. Expected: PASS.

---

### Task 3: Explicit Door Quantity and Sides

**Files:**
- Modify: `lib/estimator/__tests__/doors.test.ts`
- Modify: `lib/estimator/doors.ts`

- [ ] **Step 1: Write failing test**

Add this test in `lib/estimator/__tests__/doors.test.ts`:

```ts
test('calculateDoors requires quantity and sides instead of using hidden defaults', () => {
  const result = calculateDoors({
    settings: { labor_rate_per_hour: 50, paint_coats: 1, primer_coats: 1, spot_prime_percent: 0 },
    catalogs: {
      door_unit_rates: [{ id: 'DOOR', label: 'Door', amount: 25, labor_rate: 0.5, material_rate: 10, default_qty: null }],
    },
    scopes: [
      {
        id: 'door-missing-inputs',
        room_id: 'R001',
        position: 0,
        include: 'Y',
        scope_name: 'Door',
        door_type_id: 'DOOR',
        color_id: null,
        paint_product_id: null,
        primer_product_id: null,
        prime_mode: 'NONE',
        quantity: null,
        sides: null,
        paint_coats: null,
        primer_coats: null,
        spot_prime_percent: null,
        condition_factor: null,
        labor_rate: null,
        material_rate: null,
        override_paint_hours: null,
        override_primer_hours: null,
        override_material_cost: null,
        override_supply_cost: null,
        override_total: null,
        notes: null,
      },
    ],
  })

  assert.ok(result.missing_inputs.some((input) => input.field === 'quantity'))
  assert.ok(result.missing_inputs.some((input) => input.field === 'sides'))
  assert.equal(result.scopes[0].effective_units, 0)
  assert.equal(result.scopes[0].effective_total, 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --experimental-specifier-resolution=node --experimental-test-isolation=none --test lib/estimator/__tests__/doors.test.ts
```

Expected: FAIL because doors still use default quantity and sides.

- [ ] **Step 3: Implement minimal door validation**

In `lib/estimator/doors.ts`, replace:

```ts
const quantity = nonNeg(n(scope.quantity)) ?? pos(n(rate?.default_qty)) ?? 1
const sides = nonNeg(n(scope.sides)) ?? 2
```

with:

```ts
const quantity = nonNeg(n(scope.quantity)) ?? pos(n(rate?.default_qty))
const sides = nonNeg(n(scope.sides))
if (include === 'Y' && quantity == null) {
  missingInputs.push({
    level: 'scope',
    room_id: scope.room_id,
    scope_id: scopeKey,
    segment_id: null,
    field: 'quantity',
    message: `Door scope ${scope.scope_name ?? (scope.position ?? 0) + 1}: quantity is required`,
  })
}
if (include === 'Y' && sides == null) {
  missingInputs.push({
    level: 'scope',
    room_id: scope.room_id,
    scope_id: scopeKey,
    segment_id: null,
    field: 'sides',
    message: `Door scope ${scope.scope_name ?? (scope.position ?? 0) + 1}: sides is required`,
  })
}
const rawUnits = round4((quantity ?? 0) * (sides ?? 0))
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same command as Step 2. Expected: PASS.

---

### Task 4: Focused Regression Check

**Files:**
- No direct code changes.

- [ ] **Step 1: Run focused estimator tests**

Run:

```powershell
node --experimental-specifier-resolution=node --experimental-test-isolation=none --test lib/estimator/__tests__/ceilings.test.ts lib/estimator/__tests__/doors.test.ts lib/estimator/__tests__/estimateV2ScopeContracts.test.ts lib/estimator/__tests__/v2DraftPayload.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Run broader node estimator tests if focused tests pass**

Run:

```powershell
npm run test:node
```

Expected: node test suite passes. If unrelated tests fail, record the failing file and whether it is caused by strict input behavior.

- [ ] **Step 3: Review hardcoded business numbers**

Run:

```powershell
rg --line-number "DEFAULTS|\\?\\? 1\\.2|\\?\\? 2|STANDARD_BASEBOARD_OPENING_DEDUCTION_LF|standard_door_deduction_sf|standard_window_deduction_sf|DEFAULT_LABOR_RATE" lib/estimator app/crm/estimates
```

Expected: only documented deferred constants, quote policy defaults, and math-safe identity/floor values remain.
