# Estimator V2 Door Scopes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class painted door scopes to Estimator V2 using existing rates, estimator calculators, persistence, pricing, editor state, and shared UI primitives.

**Architecture:** Doors become a canonical Estimate scope under `app/crm/estimates/[id]/v2`, parallel to walls, ceilings, and trim. Door rate data comes from the existing `unit_rates_doors` rates/flags category; no new rates editor or duplicate catalog system is introduced. The editor UI should match the visual style of the ceiling section by reusing `EstimateV2SectionWrappers`, `EstimateV2EditorPrimitives`, `EstimateV2ConditionsPanel`, and the existing V2 token/classes, while using a door-specific layout suited to quantity/type entry.

**Tech Stack:** Next.js App Router, React, Zustand store, TypeScript estimator domain modules, Supabase SQL migrations/RPC persistence, Vitest component and node tests.

---

## Shared Reuse Requirements

- Use `unit_rates_doors` from `types/estimator/ratesFlags.ts` and `lib/server/rates-flags/doorsCategory.ts`.
- Do not create a separate door rates editor, parser, API route, or catalog table.
- Reuse Estimator V2 route-local ownership under `app/crm/estimates/[id]/v2`; quote routes remain aliases only.
- Reuse `EstimateV2SectionWrappers.tsx` for the accordion shell.
- Reuse `Field`, `RequiredInputFrame`, `OptionalInputFrame`, `Advanced`, `AdvancedPanelToggle`, `PaintCoatButtons`, `PrimerModeButtons`, `PaintOverrideFields`, `ItemActionRow`, and `ReorderDeleteActions` from `EstimateV2EditorPrimitives.tsx`.
- Add a `DoorsScopePanel` primitive only if it is the same thin wrapper shape as `WallsScopePanel`, `CeilingsScopePanel`, and `TrimScopePanel`.
- Use the ceiling visual style: compact section cards, mono labels, required input frames, `paint-setup-grid`, `walksqft-box`, V2 borders, and advanced override disclosure.
- Do not copy ceiling geometry logic; doors do not have wall/ceiling geometry modes or segments.
- Keep door/window casing in Trim. Door scopes represent painted door slabs/panels only.

## File Structure

- Create `types/estimator/doors.ts`: shared door calculation row/input/output types.
- Modify `types/estimator/index.ts`: export door types if this barrel currently exports other estimator type modules.
- Modify `types/estimator/v2.ts`: add door catalog option, door draft, response input collection, save payload collection, calculations payload, and summary shape.
- Create `lib/estimator/doorTypes.ts`: door unit-rate catalog row normalization helpers.
- Create `lib/estimator/doors.ts`: door calculator using shared helpers from walls/trim.
- Create `lib/estimator/__tests__/doors.test.ts`: calculator unit tests.
- Add migration `supabase/sql/071_estimate_room_door_scopes.sql`: door scope persistence table and RLS.
- Modify `lib/server/estimateV2RoutePayload.ts`: DB row mapping, door catalog mapping, save row typing.
- Modify `lib/server/estimateV2Catalogs.ts`: expose door calculation catalogs from existing catalog payload.
- Modify `lib/server/estimate-v2/loadEstimateAssembly.ts`: load active door scopes.
- Modify `lib/server/estimate-v2/saveEstimateOrchestration.ts`: normalize and save door scopes.
- Modify `lib/server/estimate-v2/scopeRowPersistence.ts`: add `estimate_room_door_scopes` to soft replace table union.
- Modify `lib/server/estimate-v2/calculationOrchestration.ts`: calculate doors, include in pricing summary.
- Modify `lib/server/estimate-v2/__tests__/saveLoadContract.test.ts`: save/load contract for doors.
- Modify `lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts`: save orchestration includes door rows.
- Modify `lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts`: replace placeholder/future door coverage with real door engine coverage.
- Modify `lib/estimates/v2/store/estimateV2Store.ts`: add door scopes collection and setter.
- Modify `app/crm/estimates/[id]/v2/_state/estimateV2EditorTypes.ts`: add door collection, VM, summary toggle labels, dirty source.
- Modify `app/crm/estimates/[id]/v2/_lib/estimateV2EditorNormalize.ts`: create/default/normalize door drafts.
- Modify `app/crm/estimates/[id]/v2/_lib/estimateV2EditorMutations.ts`: add door add/update/move/delete/toggle mutations and room cascade.
- Create `app/crm/estimates/[id]/v2/_state/useEstimateV2DoorActions.ts`: hook mirroring ceiling/trim action style.
- Modify `app/crm/estimates/[id]/v2/_state/useEstimateV2Editor.ts`: compose door actions and VM.
- Modify `app/crm/estimates/[id]/v2/_state/useEstimateV2EditorSliceViewModels.ts`: build door VM and summary VM.
- Modify `app/crm/estimates/[id]/v2/_state/useEstimateV2SaveDerived.ts`: include doors in dirty snapshots and save payload.
- Modify `app/crm/estimates/[id]/v2/_state/estimateV2DirtySnapshot.ts`: include door scopes.
- Modify `app/crm/estimates/[id]/v2/_components/EstimateV2SectionWrappers.tsx`: export `EstimateV2DoorsSection`.
- Modify `app/crm/estimates/[id]/v2/_components/EstimateV2EditorPrimitives.tsx`: add `DoorsScopePanel` only as a thin shared-style wrapper.
- Create `app/crm/estimates/[id]/v2/_components/EstimateV2DoorsSection.tsx`: re-export from wrappers.
- Create `app/crm/estimates/[id]/v2/_components/EstimateV2DoorsSectionBody.tsx`: render door editor body using shared primitives and ceiling styling.
- Modify `app/crm/estimates/[id]/v2/_components/EstimateV2EditorScopeSectionStack.tsx`: render the Doors accordion in the existing scope stack.
- Modify `app/crm/estimates/[id]/v2/_components/EstimateV2SummaryRail.tsx`: include door toggle/status in the existing summary rail.
- Modify summary route files under `app/crm/estimates/[id]/v2/summary`: include door room rows and totals.
- Modify `lib/customer-estimates/scopeExtraction.ts`, `lib/customer-estimates/build.ts`, and related tests only if calculated door scopes are not already represented in the door bucket from trim extraction.

---

### Task 1: Schema And Shared Door Types

**Files:**
- Create: `supabase/sql/071_estimate_room_door_scopes.sql`
- Create: `types/estimator/doors.ts`
- Modify: `types/estimator/v2.ts`

- [ ] **Step 1: Add the door scope migration**

Create `supabase/sql/071_estimate_room_door_scopes.sql`:

```sql
-- Estimator V2 painted door scopes.

create table if not exists public.estimate_room_door_scopes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  room_id text not null,
  position int not null default 0,
  include text not null default 'Y' check (include in ('Y', 'N')),
  scope_name text null,
  door_type_id text null,
  color_id text null,
  paint_product_id text null,
  primer_product_id text null,
  prime_mode text not null default 'NONE' check (prime_mode in ('NONE', 'SPOT', 'FULL')),
  quantity numeric null check (quantity is null or quantity >= 0),
  sides numeric null check (sides is null or sides >= 0),
  paint_coats numeric null check (paint_coats is null or paint_coats >= 0),
  primer_coats numeric null check (primer_coats is null or primer_coats >= 0),
  spot_prime_percent numeric null check (spot_prime_percent is null or spot_prime_percent between 0 and 100),
  condition_factor numeric null check (condition_factor is null or condition_factor >= 0),
  labor_rate numeric null check (labor_rate is null or labor_rate >= 0),
  material_rate numeric null check (material_rate is null or material_rate >= 0),
  raw_units numeric null,
  effective_units numeric null,
  raw_paint_hours numeric null,
  override_paint_hours numeric null,
  effective_paint_hours numeric null,
  raw_primer_hours numeric null,
  override_primer_hours numeric null,
  effective_primer_hours numeric null,
  raw_material_cost numeric null,
  override_material_cost numeric null,
  effective_material_cost numeric null,
  raw_supply_cost numeric null,
  override_supply_cost numeric null,
  effective_supply_cost numeric null,
  raw_total numeric null,
  override_total numeric null,
  effective_total numeric null,
  notes text null,
  active text not null default 'Y' check (active in ('Y', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_room_door_scopes_org_id_idx
  on public.estimate_room_door_scopes (org_id);

create index if not exists estimate_room_door_scopes_estimate_id_idx
  on public.estimate_room_door_scopes (org_id, estimate_id, room_id, position);

create index if not exists estimate_room_door_scopes_job_id_idx
  on public.estimate_room_door_scopes (org_id, job_id);

alter table public.estimate_room_door_scopes enable row level security;

drop trigger if exists trg_estimate_room_door_scopes_set_updated_at on public.estimate_room_door_scopes;
create trigger trg_estimate_room_door_scopes_set_updated_at
before update on public.estimate_room_door_scopes
for each row
execute function public.set_updated_at();

drop policy if exists estimate_room_door_scopes_select on public.estimate_room_door_scopes;
create policy estimate_room_door_scopes_select
  on public.estimate_room_door_scopes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_door_scopes.org_id
    )
  );

drop policy if exists estimate_room_door_scopes_insert on public.estimate_room_door_scopes;
create policy estimate_room_door_scopes_insert
  on public.estimate_room_door_scopes
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_door_scopes.org_id
    )
  );

drop policy if exists estimate_room_door_scopes_update on public.estimate_room_door_scopes;
create policy estimate_room_door_scopes_update
  on public.estimate_room_door_scopes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_door_scopes.org_id
    )
  );

drop policy if exists estimate_room_door_scopes_delete on public.estimate_room_door_scopes;
create policy estimate_room_door_scopes_delete
  on public.estimate_room_door_scopes
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
        and m.org_id = estimate_room_door_scopes.org_id
    )
  );
```

- [ ] **Step 2: Add shared door calculation types**

Create `types/estimator/doors.ts`:

```ts
import type { MissingInput, WallRoomTotal, YN } from '@/lib/estimator/wallsTypes'

export type DoorUnitRateCatalogRow = {
  id: string
  label: string
  unit_rate_type: string | null
  unit: string | null
  default_qty: number | null
  labor_rate: number | null
  material_rate: number | null
  amount: number | null
}

export type DoorCalculationScopeRow = {
  id?: string | null
  room_id: string
  position?: number | null
  include?: YN | null
  scope_name?: string | null
  door_type_id?: string | null
  color_id?: string | null
  paint_product_id?: string | null
  primer_product_id?: string | null
  prime_mode?: 'NONE' | 'SPOT' | 'FULL' | null
  quantity?: number | string | null
  sides?: number | string | null
  paint_coats?: number | string | null
  primer_coats?: number | string | null
  spot_prime_percent?: number | string | null
  condition_factor?: number | string | null
  labor_rate?: number | string | null
  material_rate?: number | string | null
  override_paint_hours?: number | string | null
  override_primer_hours?: number | string | null
  override_material_cost?: number | string | null
  override_supply_cost?: number | string | null
  override_total?: number | string | null
  notes?: string | null
}

export type DoorCalculationCatalogs = {
  door_unit_rates?: DoorUnitRateCatalogRow[]
}

export type DoorCalculationInput = {
  scopes: DoorCalculationScopeRow[]
  settings?: {
    labor_rate_per_hour?: number | null
    crew_size?: number | null
  } | null
  catalogs?: DoorCalculationCatalogs | null
}

export type DoorCalculationOutput = {
  scopes: Array<DoorCalculationScopeRow & {
    raw_units: number
    effective_units: number
    raw_paint_hours: number
    effective_paint_hours: number
    raw_primer_hours: number
    effective_primer_hours: number
    raw_material_cost: number
    effective_material_cost: number
    raw_supply_cost: number
    effective_supply_cost: number
    raw_total: number
    effective_total: number
  }>
  room_totals: WallRoomTotal[]
  missing_inputs: MissingInput[]
  assumptions: {
    labor_rate_per_hour: number
    crew_size: number
  }
}
```

- [ ] **Step 3: Extend V2 types**

In `types/estimator/v2.ts`, import the door output type and add:

```ts
export type EstimateV2DoorTypeOption = EstimateV2CatalogOption & {
  unit_rate_type: string | null
  unit: string | null
  default_qty: number | null
  labor_rate: number | null
  material_rate: number | null
  amount: number | null
}

export type EstimateV2DoorScopeDraft = {
  id: string
  roomId: string
  position: number
  include: YN
  scopeName: string
  doorTypeId: string
  quantity: string
  sides: string
  colorId: string
  paintProductId: string
  primerProductId: string
  primeMode: 'NONE' | 'SPOT' | 'FULL'
  spotPrimePercent: string
  paintCoats: string
  primerCoats: string
  conditionFactor: string
  laborRate: string
  materialRate: string
  overridePaintHours: string
  overridePrimerHours: string
  overrideMaterialCost: string
  overrideSupplyCost: string
  overrideTotal: string
  notes: string
}
```

Also add:

```ts
door_types: EstimateV2DoorTypeOption[]
room_door_scopes: UnsafeRecord[]
door_calculations: UnsafeRecord | null
room_door_scopes: UnsafeRecord[]
```

to the existing catalog, response, get response, summary, and save payload structures in the same pattern as `trim_items`, `room_trim_scopes`, and `trim_calculations`.

- [ ] **Step 4: Run typecheck for intentional failures**

Run:

```powershell
npm.cmd run typecheck
```

Expected: failures identify every V2 path that must be wired for the new required door fields.

---

### Task 2: Door Catalog Mapping From Existing Rates

**Files:**
- Modify: `lib/server/estimateV2RoutePayload.ts`
- Modify: `lib/server/estimateV2Catalogs.ts`
- Test: `lib/server/__tests__/estimateV2RoutePayload.test.ts`

- [ ] **Step 1: Write catalog mapping test**

Add a test case to `lib/server/__tests__/estimateV2RoutePayload.test.ts` that builds a fake catalog source containing a `unit_rates_doors` category row and asserts `toDoorCalculationCatalogs(source)` returns:

```ts
{
  door_unit_rates: [
    {
      id: 'DOOR_STD',
      label: 'Standard Door',
      unit_rate_type: 'interior',
      unit: 'EA',
      default_qty: 1,
      labor_rate: 0.35,
      material_rate: 4,
      amount: 0,
    },
  ],
}
```

- [ ] **Step 2: Implement `toDoorCalculationCatalogs`**

In `lib/server/estimateV2RoutePayload.ts`, add a mapper beside `toTrimCalculationCatalogs`:

```ts
export function toDoorCalculationCatalogs(source: UnsafeRecord) {
  const categories = Array.isArray(source.categories) ? source.categories as UnsafeRecord[] : []
  const category = categories.find((entry) => asText(entry.key) === 'unit_rates_doors')
  const rows = Array.isArray(category?.rows) ? category.rows as UnsafeRecord[] : []
  return {
    door_unit_rates: rows
      .filter((row) => row.active !== false)
      .map((row) => ({
        id: asText(row.id),
        label: asText(row.display_name) || asText(row.id),
        unit_rate_type: asText(row.unit_rate_type) || null,
        unit: asText(row.unit) || null,
        default_qty: asNullableNumber(row.default_qty),
        labor_rate: asNullableNumber(row.labor_rate),
        material_rate: asNullableNumber(row.material_rate),
        amount: asNullableNumber(row.amount),
      }))
      .filter((row) => row.id),
  }
}
```

Adjust the exact source traversal if `toTrimCalculationCatalogs` uses a helper; reuse that helper instead of writing a second parser.

- [ ] **Step 3: Add catalog loader output**

In `lib/server/estimateV2Catalogs.ts`, import `toDoorCalculationCatalogs` and add:

```ts
door: toDoorCalculationCatalogs(source),
```

to `loadEstimateV2CalculationCatalogs`.

- [ ] **Step 4: Run route payload tests**

Run:

```powershell
npm.cmd run test:node -- lib/server/__tests__/estimateV2RoutePayload.test.ts
```

Expected: catalog test passes and existing wall/ceiling/trim catalog tests still pass.

---

### Task 3: Door Calculator

**Files:**
- Create: `lib/estimator/doorTypes.ts`
- Create: `lib/estimator/doors.ts`
- Create: `lib/estimator/__tests__/doors.test.ts`

- [ ] **Step 1: Write calculator tests first**

Create `lib/estimator/__tests__/doors.test.ts` with these cases:

```ts
import { describe, expect, test } from 'vitest'
import { calculateDoors } from '../doors'

describe('calculateDoors', () => {
  test('calculates included door units from quantity and sides using unit_rates_doors', () => {
    const result = calculateDoors({
      scopes: [{
        id: 'door-1',
        room_id: 'ROOM-1',
        include: 'Y',
        door_type_id: 'STD',
        quantity: 2,
        sides: 2,
        paint_coats: 2,
        prime_mode: 'NONE',
      }],
      settings: { labor_rate_per_hour: 80, crew_size: 1 },
      catalogs: {
        door_unit_rates: [{
          id: 'STD',
          label: 'Standard Door',
          unit_rate_type: 'interior',
          unit: 'EA',
          default_qty: 1,
          labor_rate: 0.25,
          material_rate: 5,
          amount: 0,
        }],
      },
    })

    expect(result.scopes[0]).toMatchObject({
      raw_units: 4,
      effective_units: 4,
      raw_paint_hours: 2,
      effective_paint_hours: 2,
      raw_material_cost: 20,
      effective_material_cost: 20,
      raw_total: 180,
      effective_total: 180,
    })
    expect(result.room_totals[0].room_id).toBe('ROOM-1')
    expect(result.room_totals[0].effective_total).toBe(180)
  })

  test('applies total override without losing raw values', () => {
    const result = calculateDoors({
      scopes: [{
        id: 'door-override',
        room_id: 'ROOM-1',
        include: 'Y',
        door_type_id: 'STD',
        quantity: 1,
        sides: 1,
        paint_coats: 1,
        prime_mode: 'NONE',
        override_total: 99,
      }],
      settings: { labor_rate_per_hour: 80 },
      catalogs: { door_unit_rates: [{ id: 'STD', label: 'Standard Door', unit_rate_type: null, unit: 'EA', default_qty: 1, labor_rate: 0.25, material_rate: 5, amount: 0 }] },
    })

    expect(result.scopes[0].raw_total).toBe(25)
    expect(result.scopes[0].effective_total).toBe(99)
  })

  test('reports missing door type for included rows', () => {
    const result = calculateDoors({
      scopes: [{ id: 'missing-type', room_id: 'ROOM-1', include: 'Y', quantity: 1, sides: 2 }],
      settings: { labor_rate_per_hour: 80 },
      catalogs: { door_unit_rates: [] },
    })

    expect(result.missing_inputs.some((issue) => issue.field === 'door_type_id')).toBe(true)
  })
})
```

- [ ] **Step 2: Implement calculator using shared helpers**

In `lib/estimator/doors.ts`, import and reuse:

```ts
import {
  n,
  nonNeg,
  normalizeInclude,
  pos,
  resolveSettings,
  round4,
} from './wallsHelpers'
```

Calculator rules:

- `include === 'N'` makes effective units, hours, material, supply, and total zero.
- `quantity` defaults to catalog `default_qty`, then `1`.
- `sides` defaults to `2`.
- `raw_units = quantity * sides`.
- `labor_rate` uses row override, then catalog `labor_rate`, then `0`.
- `material_rate` uses row override, then catalog `material_rate`, then catalog `amount`, then `0`.
- `raw_paint_hours = raw_units * labor_rate * paint_coats * condition_factor`.
- `raw_primer_hours = raw_units * labor_rate * primer_coats * primerMultiplier * condition_factor`.
- `raw_material_cost = raw_units * material_rate`.
- `effective_*` uses matching override fields when provided.
- `effective_total` uses `override_total` when provided.

- [ ] **Step 3: Use shared room total shape**

Build `room_totals` using the same `WallRoomTotal` structure used by walls/ceilings/trim. Populate door units into `effective_area_sf` as `0` and rely on hours/material/supply/total fields for pricing. Do not invent a door-only room total shape.

- [ ] **Step 4: Run calculator tests**

Run:

```powershell
npm.cmd run test:node -- lib/estimator/__tests__/doors.test.ts
```

Expected: all new door calculator tests pass.

---

### Task 4: Server Load, Save, And Calculation Orchestration

**Files:**
- Modify: `lib/server/estimate-v2/loadEstimateAssembly.ts`
- Modify: `lib/server/estimate-v2/saveEstimateOrchestration.ts`
- Modify: `lib/server/estimate-v2/scopeRowPersistence.ts`
- Modify: `lib/server/estimate-v2/calculationOrchestration.ts`
- Test: `lib/server/estimate-v2/__tests__/saveLoadContract.test.ts`
- Test: `lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts`

- [ ] **Step 1: Add failing save/load tests**

Add fixtures that include:

```ts
room_door_scopes: [{
  id: '00000000-0000-4000-8000-000000000071',
  room_id: 'ROOM-1',
  position: 0,
  include: 'Y',
  scope_name: 'Bedroom doors',
  door_type_id: 'STD',
  quantity: 2,
  sides: 2,
  paint_coats: 2,
  prime_mode: 'NONE',
}]
```

Assert that the save payload writes `estimate_room_door_scopes` and the load payload returns `inputs.room_door_scopes`.

- [ ] **Step 2: Add soft replace support**

In `lib/server/estimate-v2/scopeRowPersistence.ts`, extend `SoftReplaceTable`:

```ts
| 'estimate_room_door_scopes'
```

- [ ] **Step 3: Load active door scopes**

In `loadEstimateAssembly.ts`, load from `estimate_room_door_scopes` with the same org/estimate/active filters and position ordering used for trim scopes.

- [ ] **Step 4: Save normalized door rows**

In `saveEstimateOrchestration.ts`, map `payload.room_door_scopes` into DB rows with:

```ts
{
  id: asText(row.id) || undefined,
  org_id: params.orgId,
  estimate_id: params.estimateId,
  job_id: estimate.job_id,
  room_id: asText(row.room_id),
  position: Number.isFinite(Number(row.position)) ? Number(row.position) : idx,
  include: toYN(row.include, 'Y'),
  scope_name: asText(row.scope_name) || null,
  door_type_id: asText(row.door_type_id) || null,
  color_id: asText(row.color_id) || null,
  paint_product_id: asText(row.paint_product_id) || null,
  primer_product_id: asText(row.primer_product_id) || null,
  prime_mode: asText(row.prime_mode) || 'NONE',
  quantity: asNullableNumber(row.quantity),
  sides: asNullableNumber(row.sides),
  paint_coats: asNullableNumber(row.paint_coats),
  primer_coats: asNullableNumber(row.primer_coats),
  spot_prime_percent: asNullableNumber(row.spot_prime_percent),
  condition_factor: asNullableNumber(row.condition_factor),
  labor_rate: asNullableNumber(row.labor_rate),
  material_rate: asNullableNumber(row.material_rate),
  override_paint_hours: asNullableNumber(row.override_paint_hours),
  override_primer_hours: asNullableNumber(row.override_primer_hours),
  override_material_cost: asNullableNumber(row.override_material_cost),
  override_supply_cost: asNullableNumber(row.override_supply_cost),
  override_total: asNullableNumber(row.override_total),
  notes: asText(row.notes) || null,
}
```

Use existing local helpers (`asText`, `asNullableNumber`, `toYN`) instead of adding new parsing logic.

- [ ] **Step 5: Calculate doors in orchestration**

In `calculationOrchestration.ts`:

- import `calculateDoors`
- preserve explicit paint/primer IDs like wall/ceiling/trim
- apply default trim paint/primer products for doors unless product defaults gain door-specific fields later
- resolve condition factors with scope `'trim'` only if the condition catalog does not support `'door'`; do not add a new condition scope in this plan
- pass `{ kind: 'doors', output: doorCalculations }` into `buildEstimatePricingSummaryFromEngines`
- include active scope name `'doors'` in `buildPerJobSupplyCost` only after extending that helper type safely

- [ ] **Step 6: Return calculated door artifacts**

Return:

```ts
quoteDoorScopes,
doorCalculations,
```

from `loadCalculatedEstimateV2Artifacts`, matching the wall/ceiling/trim naming pattern.

- [ ] **Step 7: Run server tests**

Run:

```powershell
npm.cmd run test:node -- lib/server/estimate-v2/__tests__/saveLoadContract.test.ts lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts
```

Expected: door scopes save, load, and calculate through the server path.

---

### Task 5: Editor Store, Normalize, Mutations, And Dirty Snapshot

**Files:**
- Modify: `lib/estimates/v2/store/estimateV2Store.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2EditorTypes.ts`
- Modify: `app/crm/estimates/[id]/v2/_lib/estimateV2EditorNormalize.ts`
- Modify: `app/crm/estimates/[id]/v2/_lib/estimateV2EditorMutations.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2DirtySnapshot.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2SaveDerived.ts`
- Test: `app/crm/estimates/[id]/v2/_lib/__tests__/estimateV2EditorMutations.test.ts`
- Test: `app/crm/estimates/[id]/v2/_state/__tests__/estimateV2DirtySnapshot.test.tsx`

- [ ] **Step 1: Write mutation tests**

Add tests for:

- `addDoorScopeMutation` appends a door scope at the next room position.
- `moveDoorScopeMutation` reindexes room door scopes only.
- `deleteDoorScopeMutation` removes one scope and reindexes remaining room door scopes.
- `toggleRoomDoorIncludeMutation` creates an included default door scope when none exists and toggles include on existing room door scopes.
- `deleteRoomCascadeMutation` removes door scopes for the deleted room.

- [ ] **Step 2: Add door collection to store**

Follow the exact `trimScopes` pattern:

```ts
doorScopes: [],
setDoorScopes: (value) =>
  set((state) => ({
    collections: {
      ...state.collections,
      doorScopes: resolveUpdater(state.collections.doorScopes, value),
    },
  })),
```

- [ ] **Step 3: Add default door draft**

In `estimateV2EditorNormalize.ts`, add:

```ts
export function createDefaultDoorScope(roomId: string): EstimateV2DoorScopeDraft {
  return {
    id: createUuid(),
    roomId,
    position: 0,
    include: 'Y',
    scopeName: 'Doors',
    doorTypeId: '',
    quantity: '1',
    sides: '2',
    colorId: '',
    paintProductId: '',
    primerProductId: '',
    primeMode: 'NONE',
    spotPrimePercent: '0',
    paintCoats: '2',
    primerCoats: '1',
    conditionFactor: '1',
    laborRate: '',
    materialRate: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overrideMaterialCost: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
  }
}
```

- [ ] **Step 4: Normalize API rows into door drafts**

Map `inputs.room_door_scopes` with snake_case to camelCase, preserving all override and effective input fields as strings in the draft.

- [ ] **Step 5: Add door mutations**

Implement:

```ts
export function updateDoorScopeMutation(
  scopes: EstimateV2DoorScopeDraft[],
  scopeId: string,
  patch: Partial<EstimateV2DoorScopeDraft>
) {
  return scopes.map((scope) => (scope.id === scopeId ? { ...scope, ...patch } : scope))
}
```

and add/move/delete/toggle functions matching trim scope structure.

- [ ] **Step 6: Include doors in dirty and save payload**

Add `doorScopes` to dirty snapshot and save payload serialization as `room_door_scopes`.

- [ ] **Step 7: Run editor state tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/_lib/__tests__/estimateV2EditorMutations.test.ts app/crm/estimates/[id]/v2/_state/__tests__/estimateV2DirtySnapshot.test.tsx
```

Expected: mutation and dirty tracking tests pass.

---

### Task 6: Door Actions And View Models

**Files:**
- Create: `app/crm/estimates/[id]/v2/_state/useEstimateV2DoorActions.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2Editor.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/useEstimateV2EditorSliceViewModels.ts`
- Modify: `app/crm/estimates/[id]/v2/_state/estimateV2EditorTypes.ts`
- Test: `app/crm/estimates/[id]/v2/_state/__tests__/useEstimateV2EditorViewModels.test.tsx`

- [ ] **Step 1: Write VM test**

Add a test asserting:

- selected room door scopes appear in position order
- effective door subtotal reads from `doorCalculations.scopes`
- door summary hidden when no room is selected
- scope toggle labels include doors

- [ ] **Step 2: Create door actions hook**

Use the same structure as `useEstimateV2CeilingActions.ts`:

```ts
export function useEstimateV2DoorActions(params: { store: EstimateV2EditorStoreApi }) {
  const { store } = params
  const markDirty = useCallback(() => {
    store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'doors' }))
  }, [store])

  return {
    updateScope,
    addScope,
    moveScope,
    deleteScope,
    toggleRoomInclude,
  }
}
```

Use mutation helpers from `estimateV2EditorMutations.ts`. Do not write mutation logic inside the hook.

- [ ] **Step 3: Add door VM**

Add `EstimateV2EditorDoorsVm` with:

```ts
selectedRoom: EstimateV2RoomDraft | null
selectedRoomDoorScopes: EstimateV2DoorScopeDraft[]
firstDoorScope: EstimateV2DoorScopeDraft | null
doorsIncluded: boolean
doorTypeOptions: EstimateV2DoorTypeOption[]
doorScopeEffectiveTotalById: Map<string, number | null>
selectedDoorSubtotal: number | null
effectiveDoorPaintLabel: string
effectiveDoorPrimerLabel: string
doorPaintOptions: EstimateV2PaintProductOption[]
doorPrimerOptions: EstimateV2PaintProductOption[]
colorCodeOptions: EstimateV2CatalogOption[]
```

Use trim paint/primer defaults for initial labels unless a later product decision adds door-specific defaults.

- [ ] **Step 4: Run VM tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/_state/__tests__/useEstimateV2EditorViewModels.test.tsx
```

Expected: door VM and existing wall/ceiling/trim VMs pass.

---

### Task 7: Door Editor UI Matching Ceiling Style

**Files:**
- Modify: `app/crm/estimates/[id]/v2/_components/EstimateV2SectionWrappers.tsx`
- Modify: `app/crm/estimates/[id]/v2/_components/EstimateV2EditorPrimitives.tsx`
- Create: `app/crm/estimates/[id]/v2/_components/EstimateV2DoorsSection.tsx`
- Create: `app/crm/estimates/[id]/v2/_components/EstimateV2DoorsSectionBody.tsx`
- Modify: `app/crm/estimates/[id]/v2/_components/EstimateV2EditorScopeSectionStack.tsx`
- Test: `app/crm/estimates/[id]/v2/_components/__tests__/EstimateV2DoorsSectionBody.test.tsx`
- Test: `app/crm/estimates/[id]/v2/_components/__tests__/EstimateV2EditorPageContent.test.tsx`

- [ ] **Step 1: Add wrapper exports**

In `EstimateV2SectionWrappers.tsx`:

```tsx
export function EstimateV2DoorsSection(props: Omit<Parameters<typeof EstimateV2SectionAccordion>[0], 'title'>) {
  return <EstimateV2SectionAccordion {...props} title="Doors" />
}
```

Create `EstimateV2DoorsSection.tsx`:

```ts
export { EstimateV2DoorsSection } from './EstimateV2SectionWrappers'
```

- [ ] **Step 2: Add thin primitive wrapper**

In `EstimateV2EditorPrimitives.tsx`:

```tsx
export function DoorsScopePanel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 10 }}>{children}</div>
}
```

- [ ] **Step 3: Build door body using ceiling styling**

`EstimateV2DoorsSectionBody.tsx` should use:

- `DoorsScopePanel`
- `Advanced`
- `Field`
- `RequiredInputFrame`
- `PaintCoatButtons`
- `PrimerModeButtons`
- `PaintOverrideFields`
- `AdvancedPanelToggle`
- `ItemActionRow`
- `ReorderDeleteActions`
- `EstimateV2ConditionsPanel`

The first visible section should be “Door Setup” with a `paint-setup-grid` containing:

- Door Type
- Quantity
- Sides
- Coats

The helper metrics row should use `walksqft-box` styling but labels should be door-specific:

- Units
- Door Subtotal

The overrides area should mirror the ceiling advanced disclosure style and include:

- Include
- Scope Name
- Paint Override
- Primer Override when prime mode is not `NONE`
- Color Slot
- Labor Rate
- Material Rate
- Paint Hrs
- Primer Hrs
- Material Cost
- Supply Cost
- Total
- Notes

- [ ] **Step 4: Add page integration**

Render `EstimateV2DoorsSection` in `EstimateV2EditorScopeSectionStack.tsx` beside Walls, Ceilings, and Trim. Keep the surrounding stack layout unchanged.

- [ ] **Step 5: Write UI tests**

Assert that:

- door type select renders existing `doorTypeOptions`
- “+ Add door scope” calls `doorsVm.addScope`
- paint coat buttons update `paintCoats`
- primer mode buttons update `primeMode`
- override disclosure opens and shows the expected fields

- [ ] **Step 6: Run component tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/_components/__tests__/EstimateV2DoorsSectionBody.test.tsx app/crm/estimates/[id]/v2/_components/__tests__/EstimateV2EditorPageContent.test.tsx
```

Expected: doors render in the editor stack and existing scope UI tests continue to pass.

---

### Task 8: Summary, Pricing Golden, And Customer Output

**Files:**
- Modify: `lib/estimator/pricingPolicies.ts`
- Modify: `lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts`
- Modify: `app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts`
- Modify: `app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryRoomBlock.tsx`
- Modify: `lib/customer-estimates/scopeExtraction.ts`
- Modify: `lib/customer-estimates/build.ts`
- Test: `app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx`
- Test: `lib/customer-estimates/__tests__/build.test.ts`

- [ ] **Step 1: Verify pricing policy accepts doors**

`EstimatePricingEngineKind` already includes `'doors'`. Ensure `buildEstimatePricingSummaryFromEngines` consumes door `room_totals` without special-casing them away.

- [ ] **Step 2: Replace future-door golden coverage with real door engine**

In `estimateV2FullPricing.golden.test.ts`, use `calculateDoors` output instead of static fake door output. Assert doors contribute to:

- `rawLaborHours`
- `laborCost`
- `supplyCost` if supply is added
- `prePolicyTotal`
- `finalTotal`
- room allocation

- [ ] **Step 3: Add summary derivation**

Add door calculations to summary derived rows. Use the same summary row shape as trim when possible:

```ts
{
  scope: 'doors',
  label: scope.scope_name || 'Doors',
  quantityLabel: `${scope.effective_units} sides`,
  total: scope.effective_total,
}
```

- [ ] **Step 4: Wire customer output only through existing door bucket**

If customer output already groups trim-derived door/casing rows under `doors`, extend the same extraction bucket to include calculated `room_door_scopes`. Do not create a second customer-facing “painted doors” section.

- [ ] **Step 5: Run summary and customer tests**

Run:

```powershell
npm.cmd run test:components -- app/crm/estimates/[id]/v2/summary/_lib/__tests__/EstimateV2SummaryDerived.test.tsx
npm.cmd run test:node -- lib/customer-estimates/__tests__/build.test.ts
```

Expected: door rows appear under the existing Doors scope and pricing totals include the door engine.

---

### Task 9: Full Verification And Review Checklist

**Files:**
- Review all modified files.

- [ ] **Step 1: Run focused checks**

Run:

```powershell
npm.cmd run test:node -- lib/estimator/__tests__/doors.test.ts lib/estimator/__tests__/estimateV2FullPricing.golden.test.ts lib/server/estimate-v2/__tests__/saveLoadContract.test.ts lib/server/estimate-v2/__tests__/saveEstimateOrchestration.test.ts
npm.cmd run test:components -- app/crm/estimates/[id]/v2/_components/__tests__/EstimateV2DoorsSectionBody.test.tsx app/crm/estimates/[id]/v2/_state/__tests__/useEstimateV2EditorViewModels.test.tsx
npm.cmd run typecheck
```

Expected: all commands pass.

- [ ] **Step 2: Run broad project checks**

Run:

```powershell
npm.cmd run test
npm.cmd run build
```

Expected: both pass.

- [ ] **Step 3: Manual UI acceptance**

Start the app and verify in the Estimator V2 editor:

- Doors section appears in the same accordion style as Ceilings.
- Door section uses the same compact card, mono label, input, button, and advanced disclosure styling as Ceilings.
- Door section layout is door-specific and does not copy ceiling geometry fields.
- Add, edit, reorder, delete, include/exclude, and save all work.
- Reopening the estimate preserves door scopes.
- Pricing summary changes when door quantity, sides, type, or override values change.
- Quote/estimate summary shows doors in the existing Doors customer scope.

- [ ] **Step 4: Architecture review**

Confirm:

- No new rates editor or duplicate catalog abstraction was added.
- Door rate data flows from `unit_rates_doors`.
- No business logic was added to components.
- No route handler owns door parsing or calculations.
- Doors use canonical Estimate naming internally.
- Quote routes remain thin aliases.
- UI uses existing Estimator V2 shared primitives.
- Door casing/window casing remains in Trim.

---

## Execution Notes

- Keep commits small:
  - schema/types/catalog
  - calculator
  - server persistence/orchestration
  - editor state/view models
  - UI
  - summary/customer output
- If a task reveals a broader shared helper is missing, add it only when at least two existing scope modules can use it immediately.
- Prefer adapting existing walls/ceilings/trim helpers over introducing door-only infrastructure.
- Do not rename existing `door_window` trim taxonomy; it is still needed for casing/window trim.

## Self-Review

- Spec coverage: The plan covers rates reuse, schema, shared types, calculation, persistence, pricing, editor state, UI, summary, customer output, and verification.
- Placeholder scan: No unresolved placeholder steps remain.
- Type consistency: Door naming uses `EstimateV2DoorScopeDraft`, `room_door_scopes`, `doorCalculations`, and `unit_rates_doors` consistently.
