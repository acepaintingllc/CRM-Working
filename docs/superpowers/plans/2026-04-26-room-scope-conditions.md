# Room & Scope Conditions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add condition modifiers (e.g. "Oil-based trim", "Heavy caulking", "Furnished room") to the estimate v2 details page, backed by template-configurable factor values that multiply into the existing calculator modifier chain.

**Architecture:** Condition selections are stored at the estimate level (job settings) and per scope-type as a `condition_factor` column on scope tables. The details page VM reads selections from the store and renders a room-level conditions bar plus a collapsible panel per scope section. On save, the resolved `condition_factor` is written to each scope row; the server-side calculators (`trim.ts`, `walls.ts`, `ceilings.ts`) multiply it into the existing modifier product on the next calculator run.

**Tech Stack:** TypeScript, React, Next.js, Supabase (PostgreSQL), Zustand store, existing rates/flags payload system.

**Spec:** `docs/superpowers/specs/2026-04-26-room-scope-conditions-design.md`

---

## File Map

**New files:**
- `supabase/sql/064_room_condition_columns.sql` — DB migration: new columns
- `supabase/sql/065_seed_condition_modifiers_template.sql` — seed default condition rows
- `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsConditions.ts` — pure functions: parse, resolve, count
- `app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsConditions.test.ts` — unit tests
- `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsRoomConditions.tsx` — room-level conditions bar
- `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsConditionsPanel.tsx` — collapsible scope conditions panel

**Modified files:**
- `types/estimator/v2.ts` — add `ConditionLevel`, `EstimateV2ConditionModifier`, `EstimateV2ConditionSelections`; extend job settings draft
- `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsVm.ts` — add `DetailsConditionsVm`, extend `EstimateV2DetailsVm` and `BuildDetailsVmParams`
- `app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsVm.ts` — parse condition_modifiers from rates/flags payload, pass to VM
- `app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsMutations.ts` — add `setRoomCondition()`
- `lib/estimator/v2DraftPayload.ts` — include `condition_selections` in job settings payload; write `condition_factor` to scope rows
- `lib/estimator/trim.ts` — multiply `condition_factor` into modifier product
- `lib/estimator/walls.ts` — multiply `condition_factor` into modifier product
- `lib/estimator/ceilings.ts` — multiply `condition_factor` into modifier product
- `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsValidation.ts` — warning when condition_modifiers template not loaded
- `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsPageContent.tsx` — add room conditions bar; wire scope panels
- `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsMaterialTable.tsx` — add conditions panel prop and render below each scope table

---

## Task 1: DB Migration — New Columns

**Files:**
- Create: `supabase/sql/064_room_condition_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 064_room_condition_columns.sql
-- Adds condition_selections to job settings and condition_factor to scope tables.
-- condition_selections stores which conditions are active (UI state).
-- condition_factor stores the resolved multiplier written on save (calculator input).

do $$
begin
  -- condition_selections on job settings (estimate-level; verify table name matches your schema)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'estimate_job_settings'
  ) then
    alter table public.estimate_job_settings
      add column if not exists condition_selections jsonb null;
  end if;

  -- condition_factor on wall scope rows
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'estimate_room_wall_scopes'
  ) then
    alter table public.estimate_room_wall_scopes
      add column if not exists condition_factor numeric null;
  end if;

  -- condition_factor on ceiling scope rows
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'estimate_room_ceiling_scopes'
  ) then
    alter table public.estimate_room_ceiling_scopes
      add column if not exists condition_factor numeric null;
  end if;

  -- condition_factor on trim scope rows
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'estimate_room_trim_scopes'
  ) then
    alter table public.estimate_room_trim_scopes
      add column if not exists condition_factor numeric null;
  end if;
end $$;
```

> **Note:** The job settings table name may differ. Search the codebase for `estimate_job_settings` or look at how `crewSize` is persisted in `v2DraftPayload.ts` to confirm the correct table. Adjust the migration accordingly.

- [ ] **Step 2: Apply and verify**

```bash
# Run against local Supabase
supabase db push
# OR apply directly:
psql $DATABASE_URL -f supabase/sql/064_room_condition_columns.sql
```

Expected: no errors; columns appear in `\d estimate_room_trim_scopes` etc.

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/064_room_condition_columns.sql
git commit -m "feat: add condition_selections and condition_factor columns for scope conditions"
```

---

## Task 2: DB Seed — condition_modifiers Template Rows

**Files:**
- Create: `supabase/sql/065_seed_condition_modifiers_template.sql`

- [ ] **Step 1: Write the seed migration**

```sql
-- 065_seed_condition_modifiers_template.sql
-- Seeds default condition_modifiers rows for all existing orgs.
-- Orgs can tune factor values in their template after seeding.

do $$
declare
  _org record;
  _template_id uuid;
begin
  for _org in select distinct org_id from public.estimator_template_constants loop
    select id into _template_id
    from public.estimator_template_constants
    where org_id = _org.org_id
    limit 1;

    if _template_id is null then continue; end if;

    -- ROOM LEVEL
    insert into public.estimator_template_constant_rows
      (org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json)
    values
      (_org.org_id, _template_id, 'condition_modifiers', 'ROOM_FURNISHED', 'Room is furnished', 'Y', 10,
        '{"id":"ROOM_FURNISHED","display_name":"Room is furnished","scope":"room","modifier_type":"binary","factor_field":"","levels":{"active":1.15}}')
    on conflict (org_id, category_key, row_id) do nothing;

    -- WALL CONDITIONS
    insert into public.estimator_template_constant_rows
      (org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json)
    values
      (_org.org_id, _template_id, 'condition_modifiers', 'WALL_CUT_IN', 'Heavy cut-in areas', 'Y', 20,
        '{"id":"WALL_CUT_IN","display_name":"Heavy cut-in areas","scope":"wall","modifier_type":"severity","factor_field":"complexity_factor","levels":{"minor":1.10,"moderate":1.20,"major":1.35}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'WALL_TEXTURE', 'Heavy wall texture', 'Y', 21,
        '{"id":"WALL_TEXTURE","display_name":"Heavy wall texture","scope":"wall","modifier_type":"severity","factor_field":"complexity_factor","levels":{"minor":1.10,"moderate":1.20,"major":1.30}}')
    on conflict (org_id, category_key, row_id) do nothing;

    -- CEILING CONDITIONS
    insert into public.estimator_template_constant_rows
      (org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json)
    values
      (_org.org_id, _template_id, 'condition_modifiers', 'CEIL_TEXTURE', 'Textured / popcorn ceiling', 'Y', 30,
        '{"id":"CEIL_TEXTURE","display_name":"Textured / popcorn ceiling","scope":"ceiling","modifier_type":"severity","factor_field":"complexity_factor","levels":{"minor":1.15,"moderate":1.30,"major":1.50}}')
    on conflict (org_id, category_key, row_id) do nothing;

    -- TRIM CONDITIONS
    insert into public.estimator_template_constant_rows
      (org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json)
    values
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_OIL_BASED', 'Old oil-based paint', 'Y', 40,
        '{"id":"TRIM_OIL_BASED","display_name":"Old oil-based paint","scope":"trim","modifier_type":"binary","factor_field":"difficult_finish_factor","levels":{"active":1.35}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_CAULKING', 'Caulking needed', 'Y', 41,
        '{"id":"TRIM_CAULKING","display_name":"Caulking needed","scope":"trim","modifier_type":"severity","factor_field":"caulk_fill_factor","levels":{"minor":1.10,"moderate":1.25,"major":1.50}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_PREP', 'Heavy prep / sanding', 'Y', 42,
        '{"id":"TRIM_PREP","display_name":"Heavy prep / sanding","scope":"trim","modifier_type":"severity","factor_field":"prep_factor","levels":{"minor":1.10,"moderate":1.25,"major":1.45}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_PROFILE', 'Complex profile (crown, millwork)', 'Y', 43,
        '{"id":"TRIM_PROFILE","display_name":"Complex profile (crown, millwork)","scope":"trim","modifier_type":"severity","factor_field":"profile_factor","levels":{"minor":1.10,"moderate":1.20,"major":1.35}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_STAIRS', 'Stair / step trim', 'Y', 44,
        '{"id":"TRIM_STAIRS","display_name":"Stair / step trim","scope":"trim","modifier_type":"binary","factor_field":"stair_factor","levels":{"active":1.20}}'),
      (_org.org_id, _template_id, 'condition_modifiers', 'TRIM_MASKING', 'Heavy masking needed', 'Y', 45,
        '{"id":"TRIM_MASKING","display_name":"Heavy masking needed","scope":"trim","modifier_type":"severity","factor_field":"masking_factor","levels":{"minor":1.10,"moderate":1.20,"major":1.35}}')
    on conflict (org_id, category_key, row_id) do nothing;

    -- bump template version so clients reload
    update public.estimator_template_constants
    set version = greatest(1, coalesce(version, 0) + 1),
        updated_at = now()
    where id = _template_id;

  end loop;
end $$;
```

- [ ] **Step 2: Apply and verify**

```bash
psql $DATABASE_URL -f supabase/sql/065_seed_condition_modifiers_template.sql
# Verify:
# SELECT row_id, display_name FROM estimator_template_constant_rows
# WHERE category_key = 'condition_modifiers' LIMIT 20;
```

Expected: 9 rows per org (ROOM_FURNISHED, WALL_CUT_IN, WALL_TEXTURE, CEIL_TEXTURE, TRIM_OIL_BASED, TRIM_CAULKING, TRIM_PREP, TRIM_PROFILE, TRIM_STAIRS, TRIM_MASKING).

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/065_seed_condition_modifiers_template.sql
git commit -m "feat: seed condition_modifiers template rows with default factor values"
```

---

## Task 3: Types

**Files:**
- Modify: `types/estimator/v2.ts`

- [ ] **Step 1: Add condition types**

Add these types to `types/estimator/v2.ts` near the other shared draft types:

```typescript
// Condition modifier types — room & scope conditions on the details page

export type ConditionLevel = 'active' | 'minor' | 'moderate' | 'major'

export type EstimateV2ConditionModifier = {
  id: string
  displayName: string
  scope: 'room' | 'wall' | 'ceiling' | 'trim'
  modifierType: 'binary' | 'severity'
  factorField: string
  levels: Partial<Record<ConditionLevel, number>>
}

export type EstimateV2ConditionSelections = {
  room: Record<string, ConditionLevel>
  wall: Record<string, ConditionLevel>
  ceiling: Record<string, ConditionLevel>
  trim: Record<string, ConditionLevel>
}
```

- [ ] **Step 2: Extend `EstimateV2JobSettingsDraft`**

Find `EstimateV2JobSettingsDraft` in `types/estimator/v2.ts` and add `conditionSelections`:

```typescript
// Before (existing fields shown for context):
export type EstimateV2JobSettingsDraft = {
  // ... existing fields ...
  crewSize: string
  // ADD:
  conditionSelections: EstimateV2ConditionSelections
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: only pre-existing errors (none new from these types).

- [ ] **Step 4: Commit**

```bash
git add types/estimator/v2.ts
git commit -m "feat: add ConditionLevel, EstimateV2ConditionModifier, EstimateV2ConditionSelections types"
```

---

## Task 4: Pure Functions — estimateV2DetailsConditions.ts

**Files:**
- Create: `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsConditions.ts`

- [ ] **Step 1: Write the file**

```typescript
// app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsConditions.ts

import type {
  ConditionLevel,
  EstimateV2ConditionModifier,
  EstimateV2ConditionSelections,
} from '@/types/estimator/v2'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'

export function emptyConditionSelections(): EstimateV2ConditionSelections {
  return { room: {}, wall: {}, ceiling: {}, trim: {} }
}

export function parseConditionModifiers(payload: RatesFlagsPayload): EstimateV2ConditionModifier[] {
  const category = payload.categories.find((c) => c.key === 'condition_modifiers')
  if (!category) return []
  return category.rows
    .filter((row) => row.active === 'Y')
    .flatMap((row) => {
      const v = row.values_json as Record<string, unknown>
      const scope = String(v.scope ?? '')
      if (!['room', 'wall', 'ceiling', 'trim'].includes(scope)) return []
      return [
        {
          id: String(v.id ?? row.row_id),
          displayName: String(v.display_name ?? row.display_name ?? ''),
          scope: scope as EstimateV2ConditionModifier['scope'],
          modifierType: String(v.modifier_type ?? 'binary') as 'binary' | 'severity',
          factorField: String(v.factor_field ?? ''),
          levels: (v.levels ?? {}) as Partial<Record<ConditionLevel, number>>,
        },
      ]
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function resolveConditionFactor(
  conditions: EstimateV2ConditionModifier[],
  scope: EstimateV2ConditionModifier['scope'],
  selections: Record<string, ConditionLevel>
): number {
  return conditions
    .filter((c) => c.scope === scope)
    .reduce((acc, condition) => {
      const level = selections[condition.id]
      if (!level) return acc
      const factor = condition.levels[level]
      if (factor == null || factor <= 0) return acc
      return acc * factor
    }, 1)
}

export type ConditionScopeFactors = {
  room: number
  wall: number
  ceiling: number
  trim: number
}

export function resolveAllConditionFactors(
  conditions: EstimateV2ConditionModifier[],
  selections: EstimateV2ConditionSelections
): ConditionScopeFactors {
  return {
    room: resolveConditionFactor(conditions, 'room', selections.room),
    wall: resolveConditionFactor(conditions, 'wall', selections.wall),
    ceiling: resolveConditionFactor(conditions, 'ceiling', selections.ceiling),
    trim: resolveConditionFactor(conditions, 'trim', selections.trim),
  }
}

export function countActiveConditions(selections: Record<string, ConditionLevel>): number {
  return Object.keys(selections).length
}

export function setConditionSelection(
  selections: EstimateV2ConditionSelections,
  scope: EstimateV2ConditionModifier['scope'],
  conditionId: string,
  level: ConditionLevel | null
): EstimateV2ConditionSelections {
  const scopeSelections = { ...selections[scope] }
  if (level == null) {
    delete scopeSelections[conditionId]
  } else {
    scopeSelections[conditionId] = level
  }
  return { ...selections, [scope]: scopeSelections }
}

export function hydrateConditionSelections(raw: unknown): EstimateV2ConditionSelections {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyConditionSelections()
  }
  const r = raw as Record<string, unknown>
  const pick = (key: string): Record<string, ConditionLevel> => {
    const val = r[key]
    if (val == null || typeof val !== 'object' || Array.isArray(val)) return {}
    return val as Record<string, ConditionLevel>
  }
  return {
    room: pick('room'),
    wall: pick('wall'),
    ceiling: pick('ceiling'),
    trim: pick('trim'),
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/crm/estimates/\[id\]/v2/details/_lib/estimateV2DetailsConditions.ts
git commit -m "feat: add condition modifier pure functions (parse, resolve, hydrate)"
```

---

## Task 5: Unit Tests — estimateV2DetailsConditions.test.ts

**Files:**
- Create: `app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsConditions.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsConditions.test.ts

import {
  parseConditionModifiers,
  resolveConditionFactor,
  resolveAllConditionFactors,
  setConditionSelection,
  hydrateConditionSelections,
  countActiveConditions,
  emptyConditionSelections,
} from '../estimateV2DetailsConditions'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'
import type { EstimateV2ConditionModifier, EstimateV2ConditionSelections } from '@/types/estimator/v2'

function makePayload(rows: object[]): RatesFlagsPayload {
  return {
    source: 'db',
    seeded: true,
    template_version: 1,
    categories: [
      {
        key: 'condition_modifiers',
        tab: '',
        group: '',
        label: 'Conditions',
        table_title: '',
        description: '',
        columns: [],
        fields: [],
        rows: rows as any,
      },
    ],
  }
}

function makeRow(overrides: object) {
  return { row_id: 'ROW', display_name: '', active: 'Y', values_json: {}, ...overrides }
}

const TRIM_OIL: EstimateV2ConditionModifier = {
  id: 'TRIM_OIL_BASED',
  displayName: 'Old oil-based paint',
  scope: 'trim',
  modifierType: 'binary',
  factorField: 'difficult_finish_factor',
  levels: { active: 1.35 },
}

const TRIM_CAULKING: EstimateV2ConditionModifier = {
  id: 'TRIM_CAULKING',
  displayName: 'Caulking needed',
  scope: 'trim',
  modifierType: 'severity',
  factorField: 'caulk_fill_factor',
  levels: { minor: 1.10, moderate: 1.25, major: 1.50 },
}

const ROOM_FURNISHED: EstimateV2ConditionModifier = {
  id: 'ROOM_FURNISHED',
  displayName: 'Room is furnished',
  scope: 'room',
  modifierType: 'binary',
  factorField: '',
  levels: { active: 1.15 },
}

describe('parseConditionModifiers', () => {
  it('returns empty array when no condition_modifiers category', () => {
    const payload: RatesFlagsPayload = { source: 'db', seeded: true, template_version: 1, categories: [] }
    expect(parseConditionModifiers(payload)).toEqual([])
  })

  it('parses binary condition from payload row', () => {
    const payload = makePayload([
      makeRow({
        row_id: 'TRIM_OIL_BASED',
        display_name: 'Old oil-based paint',
        active: 'Y',
        values_json: {
          id: 'TRIM_OIL_BASED',
          display_name: 'Old oil-based paint',
          scope: 'trim',
          modifier_type: 'binary',
          factor_field: 'difficult_finish_factor',
          levels: { active: 1.35 },
        },
      }),
    ])
    const result = parseConditionModifiers(payload)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'TRIM_OIL_BASED',
      scope: 'trim',
      modifierType: 'binary',
      levels: { active: 1.35 },
    })
  })

  it('skips inactive rows', () => {
    const payload = makePayload([
      makeRow({ row_id: 'X', active: 'N', values_json: { id: 'X', scope: 'trim', modifier_type: 'binary', levels: {} } }),
    ])
    expect(parseConditionModifiers(payload)).toHaveLength(0)
  })

  it('skips rows with unknown scope', () => {
    const payload = makePayload([
      makeRow({ row_id: 'X', active: 'Y', values_json: { id: 'X', scope: 'doors', modifier_type: 'binary', levels: {} } }),
    ])
    expect(parseConditionModifiers(payload)).toHaveLength(0)
  })
})

describe('resolveConditionFactor', () => {
  it('returns 1 when no conditions active', () => {
    expect(resolveConditionFactor([TRIM_OIL, TRIM_CAULKING], 'trim', {})).toBe(1)
  })

  it('applies binary condition factor', () => {
    expect(resolveConditionFactor([TRIM_OIL], 'trim', { TRIM_OIL_BASED: 'active' })).toBe(1.35)
  })

  it('applies severity level factor', () => {
    expect(resolveConditionFactor([TRIM_CAULKING], 'trim', { TRIM_CAULKING: 'major' })).toBe(1.50)
    expect(resolveConditionFactor([TRIM_CAULKING], 'trim', { TRIM_CAULKING: 'minor' })).toBe(1.10)
  })

  it('multiplies multiple active conditions', () => {
    const result = resolveConditionFactor(
      [TRIM_OIL, TRIM_CAULKING],
      'trim',
      { TRIM_OIL_BASED: 'active', TRIM_CAULKING: 'major' }
    )
    expect(result).toBeCloseTo(1.35 * 1.50)
  })

  it('ignores conditions for other scopes', () => {
    expect(resolveConditionFactor([ROOM_FURNISHED], 'trim', { ROOM_FURNISHED: 'active' })).toBe(1)
  })

  it('ignores unknown condition ids in selections', () => {
    expect(resolveConditionFactor([TRIM_OIL], 'trim', { UNKNOWN: 'active' as any })).toBe(1)
  })
})

describe('resolveAllConditionFactors', () => {
  it('returns 1 for all scopes when selections empty', () => {
    const factors = resolveAllConditionFactors([TRIM_OIL, ROOM_FURNISHED], emptyConditionSelections())
    expect(factors).toEqual({ room: 1, wall: 1, ceiling: 1, trim: 1 })
  })

  it('applies room factor separately from trim factor', () => {
    const selections: EstimateV2ConditionSelections = {
      room: { ROOM_FURNISHED: 'active' },
      wall: {},
      ceiling: {},
      trim: { TRIM_OIL_BASED: 'active' },
    }
    const factors = resolveAllConditionFactors([TRIM_OIL, ROOM_FURNISHED], selections)
    expect(factors.room).toBe(1.15)
    expect(factors.trim).toBe(1.35)
    expect(factors.wall).toBe(1)
    expect(factors.ceiling).toBe(1)
  })
})

describe('setConditionSelection', () => {
  it('adds a condition to a scope', () => {
    const result = setConditionSelection(emptyConditionSelections(), 'trim', 'TRIM_OIL_BASED', 'active')
    expect(result.trim).toEqual({ TRIM_OIL_BASED: 'active' })
  })

  it('removes a condition when level is null', () => {
    const start: EstimateV2ConditionSelections = {
      ...emptyConditionSelections(),
      trim: { TRIM_OIL_BASED: 'active' },
    }
    const result = setConditionSelection(start, 'trim', 'TRIM_OIL_BASED', null)
    expect(result.trim).toEqual({})
  })

  it('does not mutate other scopes', () => {
    const start: EstimateV2ConditionSelections = {
      ...emptyConditionSelections(),
      room: { ROOM_FURNISHED: 'active' },
    }
    const result = setConditionSelection(start, 'trim', 'TRIM_CAULKING', 'moderate')
    expect(result.room).toEqual({ ROOM_FURNISHED: 'active' })
  })
})

describe('hydrateConditionSelections', () => {
  it('returns empty selections for null', () => {
    expect(hydrateConditionSelections(null)).toEqual(emptyConditionSelections())
  })

  it('returns empty selections for non-object', () => {
    expect(hydrateConditionSelections('bad')).toEqual(emptyConditionSelections())
  })

  it('hydrates valid structure', () => {
    const raw = { room: { ROOM_FURNISHED: 'active' }, wall: {}, ceiling: {}, trim: { TRIM_OIL_BASED: 'active' } }
    expect(hydrateConditionSelections(raw)).toEqual(raw)
  })

  it('fills missing scopes with empty objects', () => {
    const result = hydrateConditionSelections({ trim: { TRIM_OIL_BASED: 'active' } })
    expect(result.room).toEqual({})
    expect(result.wall).toEqual({})
    expect(result.ceiling).toEqual({})
    expect(result.trim).toEqual({ TRIM_OIL_BASED: 'active' })
  })
})

describe('countActiveConditions', () => {
  it('returns 0 for empty selections', () => {
    expect(countActiveConditions({})).toBe(0)
  })

  it('counts all keys regardless of level', () => {
    expect(countActiveConditions({ A: 'active', B: 'major' })).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx jest estimateV2DetailsConditions.test --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add "app/crm/estimates/[id]/v2/details/_lib/__tests__/estimateV2DetailsConditions.test.ts"
git commit -m "test: add unit tests for condition modifier pure functions"
```

---

## Task 6: VM Types — Extend DetailsVm

**Files:**
- Modify: `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsVm.ts`

- [ ] **Step 1: Add `DetailsConditionsVm` type and extend `EstimateV2DetailsVm` + `BuildDetailsVmParams`**

Add after the existing type definitions (before the builder functions):

```typescript
// Add import at top of file:
import type { EstimateV2ConditionModifier, EstimateV2ConditionSelections } from '@/types/estimator/v2'
import type { ConditionScopeFactors } from './estimateV2DetailsConditions'

// New type:
export type DetailsConditionsVm = {
  available: boolean
  conditions: EstimateV2ConditionModifier[]
  selections: EstimateV2ConditionSelections
  wallActiveCount: number
  ceilingActiveCount: number
  trimActiveCount: number
  roomActiveCount: number
  scopeFactors: ConditionScopeFactors
}
```

In `EstimateV2DetailsVm`, add the `conditions` field:

```typescript
export type EstimateV2DetailsVm = {
  materialPlanning: EstimateV2MaterialPlanningVm
  rollerPlanning: EstimateV2RollerPlanningVm
  conditions: DetailsConditionsVm          // NEW
  validation: EstimateV2ValidationVm
  totals: EstimateV2TotalsVm
}
```

In `BuildDetailsVmParams`, add:

```typescript
export type BuildDetailsVmParams = {
  // ... existing params ...
  conditionModifiers: EstimateV2ConditionModifier[]   // NEW
  conditionSelections: EstimateV2ConditionSelections  // NEW
}
```

- [ ] **Step 2: Add `buildEstimateV2ConditionsVm` function**

Add this function to `estimateV2DetailsVm.ts`:

```typescript
import {
  resolveAllConditionFactors,
  countActiveConditions,
} from './estimateV2DetailsConditions'

function buildEstimateV2ConditionsVm(params: BuildDetailsVmParams): DetailsConditionsVm {
  const { conditionModifiers, conditionSelections } = params
  const available = conditionModifiers.length > 0
  const scopeFactors = resolveAllConditionFactors(conditionModifiers, conditionSelections)
  return {
    available,
    conditions: conditionModifiers,
    selections: conditionSelections,
    roomActiveCount: countActiveConditions(conditionSelections.room),
    wallActiveCount: countActiveConditions(conditionSelections.wall),
    ceilingActiveCount: countActiveConditions(conditionSelections.ceiling),
    trimActiveCount: countActiveConditions(conditionSelections.trim),
    scopeFactors,
  }
}
```

- [ ] **Step 3: Wire into `buildEstimateV2DetailsVm`**

In the main `buildEstimateV2DetailsVm` function, add:

```typescript
export function buildEstimateV2DetailsVm(params: BuildDetailsVmParams): EstimateV2DetailsVm {
  const materialPlanning = buildEstimateV2MaterialPlanningVm(params)
  const rollerPlanning = buildEstimateV2RollerPlanningVm(params)
  const conditions = buildEstimateV2ConditionsVm(params)   // NEW
  const validation = buildEstimateV2ValidationVm(params, materialPlanning, rollerPlanning)
  const totals = buildEstimateV2TotalsVm(params, materialPlanning)
  return { materialPlanning, rollerPlanning, conditions, validation, totals }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only at call sites that don't yet pass `conditionModifiers`/`conditionSelections` — those will be fixed in Task 7.

- [ ] **Step 5: Commit**

```bash
git add "app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsVm.ts"
git commit -m "feat: add DetailsConditionsVm and wire into buildEstimateV2DetailsVm"
```

---

## Task 7: Load Conditions in Page Hook

**Files:**
- Modify: `app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsVm.ts`

- [ ] **Step 1: Parse condition modifiers from rates/flags payload and pass to VM**

In `useEstimateV2DetailsVm.ts`, the hook already receives `rollerOptionsState`. It calls `buildEstimateV2DetailsVm()` with a params object. Add the condition modifier data.

The rates/flags payload is already loaded by the roller options hook — we need access to the raw payload. Look at `useEstimateV2DetailsRollerOptions.ts` to see how `loadEstimateV2RatesFlagsPayload` is called. You have two options:

**Option A (preferred):** Accept the raw payload as an additional param to `useEstimateV2DetailsVm` and parse conditions there.

Update the hook signature:

```typescript
import { parseConditionModifiers, emptyConditionSelections } from '../_lib/estimateV2DetailsConditions'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'

export function useEstimateV2DetailsVm(params: {
  store: EstimateV2EditorStoreApi
  rollerOptionsState: DetailsRollerOptionsState
  ratesFlagsPayload: RatesFlagsPayload | null   // NEW
}) {
```

Inside the hook, extract condition data from the store and parse modifiers:

```typescript
// Inside useEstimateV2DetailsVm, in the useEstimateV2Store selector:
// Add conditionSelections to extracted store state
const { conditionSelections } = useEstimateV2Store(params.store, (s) => ({
  // ... existing extractions ...
  conditionSelections: s.meta.jobSettings?.conditionSelections ?? emptyConditionSelections(),
}))

const conditionModifiers = useMemo(
  () => (params.ratesFlagsPayload ? parseConditionModifiers(params.ratesFlagsPayload) : []),
  [params.ratesFlagsPayload]
)
```

Pass to `buildEstimateV2DetailsVm`:

```typescript
const vm = useMemo(
  () =>
    buildEstimateV2DetailsVm({
      // ... existing params ...
      conditionModifiers,
      conditionSelections,
    }),
  [/* existing deps */, conditionModifiers, conditionSelections]
)
```

- [ ] **Step 2: Update `useEstimateV2DetailsPage.ts` to pass ratesFlagsPayload**

In `useEstimateV2DetailsPage.ts`, the roller options hook already loads the payload. Expose it from that hook or load it separately and pass it down:

```typescript
// In useEstimateV2DetailsPage.ts:
const { rollerOptionsState, ratesFlagsPayload } = useEstimateV2DetailsRollerOptions()

const { state, vm } = useEstimateV2DetailsVm({
  store,
  rollerOptionsState,
  ratesFlagsPayload,   // NEW
})
```

> **Note:** `useEstimateV2DetailsRollerOptions` may need to expose `ratesFlagsPayload` as a return value. Open that file and add it to the return object if it isn't already there. The payload is the raw `result.payload` from `loadEstimateV2RatesFlagsPayload`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors beyond call-site mismatches already addressed.

- [ ] **Step 4: Commit**

```bash
git add "app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsVm.ts"
git add "app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsPage.ts"
git add "app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsRollerOptions.ts"
git commit -m "feat: load and parse condition_modifiers from rates/flags payload in details VM"
```

---

## Task 8: Mutation — setRoomCondition

**Files:**
- Modify: `app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsMutations.ts`

- [ ] **Step 1: Add `setRoomCondition` to the mutations hook**

Open `useEstimateV2DetailsMutations.ts`. The hook returns an object of mutation functions that write to the estimate store. Add:

```typescript
import { setConditionSelection } from '../_lib/estimateV2DetailsConditions'
import type { ConditionLevel, EstimateV2ConditionModifier } from '@/types/estimator/v2'

// Inside useEstimateV2DetailsMutations, alongside the other mutation functions:
const setRoomCondition = useCallback(
  (
    scope: EstimateV2ConditionModifier['scope'],
    conditionId: string,
    level: ConditionLevel | null
  ) => {
    store.setState((prev) => {
      const current = prev.meta.jobSettings?.conditionSelections ?? emptyConditionSelections()
      const next = setConditionSelection(current, scope, conditionId, level)
      // No-op check — avoid dirtying state if nothing changed
      const currentJson = JSON.stringify(current[scope])
      const nextJson = JSON.stringify(next[scope])
      if (currentJson === nextJson) return prev
      return {
        ...prev,
        meta: {
          ...prev.meta,
          jobSettings: {
            ...prev.meta.jobSettings,
            conditionSelections: next,
          },
        },
      }
    })
    setDebugMeta({ lastMutation: 'setRoomCondition', scope, conditionId, level })
  },
  [store, setDebugMeta]
)

return {
  // ... existing mutations ...
  setRoomCondition,  // NEW
}
```

Add `import { emptyConditionSelections } from '../_lib/estimateV2DetailsConditions'` at the top.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add "app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsMutations.ts"
git commit -m "feat: add setRoomCondition mutation to details mutations hook"
```

---

## Task 9: Save Payload — Persist Condition Data

**Files:**
- Modify: `lib/estimator/v2DraftPayload.ts`

- [ ] **Step 1: Include `condition_selections` in job settings payload**

In `buildEstimateV2SavePayload`, find where `jobsettings` is built and add `condition_selections`:

```typescript
// In the jobsettings object (find the existing crew_size or similar field):
jobsettings: {
  // ... existing fields ...
  condition_selections: draft.meta.jobSettings?.conditionSelections ?? null,
}
```

- [ ] **Step 2: Write `condition_factor` to each scope row**

The condition_factor for each scope is: `roomFactor × scopeTypeFactor`. Import the resolver and compute it before building scope arrays:

```typescript
import {
  resolveAllConditionFactors,
  emptyConditionSelections,
} from '../estimator/v2DraftPayload' // adjust path as needed
// Actually import from the details lib:
// These are pure functions — move them to a shared lib location if needed,
// or inline the math here.

// Before building wall/ceiling/trim scope arrays:
const conditionSelections = draft.meta.jobSettings?.conditionSelections ?? emptyConditionSelections()
// NOTE: conditionModifiers need to be passed in or resolved here.
// The payload builder currently doesn't have access to the rates/flags payload.
// Two options:
//   A) Pass conditionModifiers as a param to buildEstimateV2SavePayload
//   B) Compute condition_factor directly from selections without the catalog
//      (store pre-resolved factors on the draft instead of re-computing at save time)
```

> **Important architectural note:** `buildEstimateV2SavePayload` does not currently receive the rates/flags payload. The simplest approach is to **pre-resolve and store `conditionScopeFactors` on the draft** (in the store's meta) whenever `setRoomCondition` is called. Then `buildEstimateV2SavePayload` reads the pre-resolved factors directly.

Update `setRoomCondition` in Task 8 to also store resolved factors. Add to the store's `meta.jobSettings`:

```typescript
// In useEstimateV2DetailsMutations.ts, in setRoomCondition:
// After computing `next`, also store resolved factors:
// (requires conditionModifiers to be available in the mutation hook)
// Pass conditionModifiers as a param to useEstimateV2DetailsMutations:

// Hook signature update:
export function useEstimateV2DetailsMutations(params: {
  store: EstimateV2EditorStoreApi
  conditionModifiers: EstimateV2ConditionModifier[]  // NEW
})

// Then in setRoomCondition:
const factors = resolveAllConditionFactors(params.conditionModifiers, next)
return {
  ...prev,
  meta: {
    ...prev.meta,
    jobSettings: {
      ...prev.meta.jobSettings,
      conditionSelections: next,
      resolvedConditionFactors: factors,  // store pre-resolved
    },
  },
}
```

Then in `v2DraftPayload.ts`:

```typescript
const factors = draft.meta.jobSettings?.resolvedConditionFactors ?? { room: 1, wall: 1, ceiling: 1, trim: 1 }

// For each wall scope:
wall_scopes: wallScopes.map((scope) => ({
  // ... existing fields ...
  condition_factor: round4(factors.wall * factors.room) || null,
}))

// For each ceiling scope:
ceiling_scopes: ceilingScopes.map((scope) => ({
  // ... existing fields ...
  condition_factor: round4(factors.ceiling * factors.room) || null,
}))

// For each trim scope:
trim_scopes: trimScopes.map((scope) => ({
  // ... existing fields ...
  condition_factor: round4(factors.trim * factors.room) || null,
}))
```

Add `round4` import if not already present (it's used in the calculator files — check `lib/estimator/math.ts` or similar).

- [ ] **Step 3: Add `resolvedConditionFactors` and `ConditionScopeFactors` to the job settings draft type**

In `types/estimator/v2.ts`, update `EstimateV2JobSettingsDraft`:

```typescript
export type EstimateV2JobSettingsDraft = {
  // ... existing fields ...
  conditionSelections: EstimateV2ConditionSelections
  resolvedConditionFactors: ConditionScopeFactors  // NEW
}
```

Import `ConditionScopeFactors` from `@/app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsConditions` OR move the type to `types/estimator/v2.ts` directly:

```typescript
// In types/estimator/v2.ts, add alongside the other condition types:
export type ConditionScopeFactors = {
  room: number
  wall: number
  ceiling: number
  trim: number
}
```

Then import it in `estimateV2DetailsConditions.ts` from `@/types/estimator/v2` instead of defining it locally.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add lib/estimator/v2DraftPayload.ts types/estimator/v2.ts
git add "app/crm/estimates/[id]/v2/details/_state/useEstimateV2DetailsMutations.ts"
git commit -m "feat: persist condition_selections and condition_factor in save payload"
```

---

## Task 10: Calculator Integration — walls.ts, ceilings.ts, trim.ts

**Files:**
- Modify: `lib/estimator/walls.ts`
- Modify: `lib/estimator/ceilings.ts`
- Modify: `lib/estimator/trim.ts`

- [ ] **Step 1: Add `condition_factor` to walls modifier**

In `lib/estimator/walls.ts`, find the modifier product (lines ~316-322):

```typescript
// Before:
const modifier = round4(
  (nonNeg(n(scope.height_factor)) ?? 1) *
    (nonNeg(n(scope.complexity_factor)) ?? 1) *
    (nonNeg(n(scope.wall_flag_factor)) ?? 1) *
    (nonNeg(n(scope.cut_in_top_factor)) ?? 1) *
    (nonNeg(n(scope.cut_in_bottom_factor)) ?? 1)
)

// After:
const modifier = round4(
  (nonNeg(n(scope.height_factor)) ?? 1) *
    (nonNeg(n(scope.complexity_factor)) ?? 1) *
    (nonNeg(n(scope.wall_flag_factor)) ?? 1) *
    (nonNeg(n(scope.cut_in_top_factor)) ?? 1) *
    (nonNeg(n(scope.cut_in_bottom_factor)) ?? 1) *
    (nonNeg(n(scope.condition_factor)) ?? 1)   // NEW
)
```

Also add `condition_factor` to the wall scope type used in walls.ts (find `WallCalculationScopeRow` or similar in `lib/estimator/wallTypes.ts`):

```typescript
condition_factor: number | null  // NEW
```

- [ ] **Step 2: Add `condition_factor` to ceilings modifier**

In `lib/estimator/ceilings.ts`, find the modifier product (lines ~335-340):

```typescript
// Before:
const modifier = round4(
  ceilingTypeMult *
    (nonNeg(n(scope.height_factor)) ?? 1) *
    (nonNeg(n(scope.complexity_factor)) ?? 1) *
    (nonNeg(n(scope.ceiling_flag_factor)) ?? 1)
)

// After:
const modifier = round4(
  ceilingTypeMult *
    (nonNeg(n(scope.height_factor)) ?? 1) *
    (nonNeg(n(scope.complexity_factor)) ?? 1) *
    (nonNeg(n(scope.ceiling_flag_factor)) ?? 1) *
    (nonNeg(n(scope.condition_factor)) ?? 1)   // NEW
)
```

Add `condition_factor: number | null` to the ceiling scope row type in `lib/estimator/ceilingTypes.ts`.

- [ ] **Step 3: Add `condition_factor` to trim modifier**

In `lib/estimator/trim.ts`, find the modifier product (lines ~278-287):

```typescript
// After all existing factors, add:
    (nonNeg(n(scope.condition_factor)) ?? 1)   // NEW
```

Add `condition_factor: number | null` to `TrimCalculationScopeRow` in `lib/estimator/trimTypes.ts`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/estimator/walls.ts lib/estimator/ceilings.ts lib/estimator/trim.ts
git add lib/estimator/wallTypes.ts lib/estimator/ceilingTypes.ts lib/estimator/trimTypes.ts
git commit -m "feat: multiply condition_factor into wall/ceiling/trim labor modifier chain"
```

---

## Task 11: Validation — Warning When Conditions Not Loaded

**Files:**
- Modify: `app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsValidation.ts`

- [ ] **Step 1: Add warning when condition_modifiers template is empty but selections exist**

In `createValidationIssues` (or wherever validation issues are aggregated), add:

```typescript
function createConditionModifiersUnavailableIssue(
  conditionsVm: DetailsConditionsVm
): DetailsValidationIssue[] {
  const hasAnySelections =
    Object.keys(conditionsVm.selections.room).length > 0 ||
    Object.keys(conditionsVm.selections.wall).length > 0 ||
    Object.keys(conditionsVm.selections.ceiling).length > 0 ||
    Object.keys(conditionsVm.selections.trim).length > 0
  if (conditionsVm.available || !hasAnySelections) return []
  return [
    createDetailsWarningIssue({
      id: 'conditions-template-unavailable',
      section: 'conditions',
      message:
        'Condition modifiers are not configured in your template. Saved condition selections will not apply factors until the template is seeded.',
    }),
  ]
}
```

Call this from `createValidationIssues` and include the result in the issues array. Pass `conditionsVm` as a parameter to `createValidationIssues`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add "app/crm/estimates/[id]/v2/details/_lib/estimateV2DetailsValidation.ts"
git commit -m "feat: add warning validation when condition_modifiers template not loaded"
```

---

## Task 12: UI — EstimateV2DetailsRoomConditions Component

**Files:**
- Create: `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsRoomConditions.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsRoomConditions.tsx

import type { EstimateV2ConditionModifier, ConditionLevel } from '@/types/estimator/v2'

type Props = {
  conditions: EstimateV2ConditionModifier[]
  selections: Record<string, ConditionLevel>
  onToggle: (conditionId: string, level: ConditionLevel | null) => void
}

export function EstimateV2DetailsRoomConditions({ conditions, selections, onToggle }: Props) {
  const roomConditions = conditions.filter((c) => c.scope === 'room')
  if (roomConditions.length === 0) return null

  return (
    <div className="mb-4 rounded border border-border bg-muted/30 px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Room Conditions
      </p>
      <div className="flex flex-wrap gap-4">
        {roomConditions.map((condition) => {
          const isActive = condition.id in selections
          return (
            <label key={condition.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => onToggle(condition.id, isActive ? null : 'active')}
                className="h-4 w-4 rounded border-border"
              />
              {condition.displayName}
            </label>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsRoomConditions.tsx"
git commit -m "feat: add EstimateV2DetailsRoomConditions component"
```

---

## Task 13: UI — EstimateV2DetailsConditionsPanel Component

**Files:**
- Create: `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsConditionsPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsConditionsPanel.tsx

import { useState, useEffect } from 'react'
import type {
  EstimateV2ConditionModifier,
  ConditionLevel,
} from '@/types/estimator/v2'
import { countActiveConditions } from '../_lib/estimateV2DetailsConditions'

const SEVERITY_LEVELS: ConditionLevel[] = ['minor', 'moderate', 'major']

type Props = {
  scope: 'wall' | 'ceiling' | 'trim'
  conditions: EstimateV2ConditionModifier[]
  selections: Record<string, ConditionLevel>
  onToggle: (conditionId: string, level: ConditionLevel | null) => void
  available: boolean
}

export function EstimateV2DetailsConditionsPanel({
  scope,
  conditions,
  selections,
  onToggle,
  available,
}: Props) {
  const scopeConditions = conditions.filter((c) => c.scope === scope)
  const activeCount = countActiveConditions(selections)
  const [open, setOpen] = useState(activeCount > 0)

  // Auto-expand if selections are loaded from DB
  useEffect(() => {
    if (activeCount > 0) setOpen(true)
  }, [activeCount])

  if (scopeConditions.length === 0 && available) return null

  const badge =
    activeCount > 0 ? (
      <span className="ml-auto text-xs font-medium text-amber-600">
        {activeCount} active
      </span>
    ) : (
      <span className="ml-auto text-xs text-muted-foreground">none active</span>
    )

  return (
    <div className="mt-2 border-t border-border/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
      >
        <span>{open ? '▼' : '▶'}</span>
        <span className="capitalize">{scope} Conditions</span>
        {badge}
      </button>

      {open && (
        <div className="space-y-4 pb-3 pt-1">
          {!available && (
            <p className="text-xs text-amber-600">
              Conditions not configured in template — contact your administrator.
            </p>
          )}
          {available &&
            scopeConditions.map((condition) => {
              const currentLevel = selections[condition.id] ?? null

              if (condition.modifierType === 'binary') {
                return (
                  <label
                    key={condition.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={currentLevel === 'active'}
                      onChange={() =>
                        onToggle(condition.id, currentLevel === 'active' ? null : 'active')
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    {condition.displayName}
                  </label>
                )
              }

              // Severity
              return (
                <div key={condition.id}>
                  <p className="mb-1 text-sm">{condition.displayName}</p>
                  <div className="flex gap-1">
                    {(['none', ...SEVERITY_LEVELS] as const).map((level) => {
                      const isNone = level === 'none'
                      const selected = isNone ? currentLevel == null : currentLevel === level
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() =>
                            onToggle(condition.id, isNone ? null : (level as ConditionLevel))
                          }
                          className={[
                            'rounded border px-3 py-1 text-xs font-medium capitalize transition-colors',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:bg-muted',
                          ].join(' ')}
                        >
                          {level}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsConditionsPanel.tsx"
git commit -m "feat: add EstimateV2DetailsConditionsPanel collapsible component"
```

---

## Task 14: Wire UI Into Page and Material Table

**Files:**
- Modify: `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsPageContent.tsx`
- Modify: `app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsMaterialTable.tsx`

- [ ] **Step 1: Add room conditions bar to EstimateV2DetailsPageContent**

In `EstimateV2DetailsPageContent.tsx`, import and render `EstimateV2DetailsRoomConditions` above the material sections. The page component receives the page state from `useEstimateV2DetailsPage` which includes `vm` and `actions`.

Add the import:

```tsx
import { EstimateV2DetailsRoomConditions } from './EstimateV2DetailsRoomConditions'
```

Add `setRoomCondition` to the actions destructure and pass it down. In the render, before the Walls section:

```tsx
<EstimateV2DetailsRoomConditions
  conditions={vm.conditions.conditions}
  selections={vm.conditions.selections.room}
  onToggle={(conditionId, level) =>
    actions.mutations.setRoomCondition('room', conditionId, level)
  }
/>
```

- [ ] **Step 2: Add conditions panel to EstimateV2DetailsMaterialTable**

`EstimateV2DetailsMaterialTable` is rendered once per scope section (walls, ceiling, trim). Add a `scope` prop and a conditions panel below the table:

```tsx
import { EstimateV2DetailsConditionsPanel } from './EstimateV2DetailsConditionsPanel'
import type { EstimateV2ConditionModifier, ConditionLevel } from '@/types/estimator/v2'
import type { DetailsConditionsVm } from '../_lib/estimateV2DetailsVm'

// Add to props:
type Props = {
  // ... existing props ...
  scope: 'wall' | 'ceiling' | 'trim'
  conditionsVm: DetailsConditionsVm
  onConditionToggle: (
    scope: 'wall' | 'ceiling' | 'trim',
    conditionId: string,
    level: ConditionLevel | null
  ) => void
}
```

At the bottom of the component, after the table:

```tsx
<EstimateV2DetailsConditionsPanel
  scope={props.scope}
  conditions={props.conditionsVm.conditions}
  selections={props.conditionsVm.selections[props.scope]}
  onToggle={(conditionId, level) => props.onConditionToggle(props.scope, conditionId, level)}
  available={props.conditionsVm.available}
/>
```

- [ ] **Step 3: Update EstimateV2DetailsPageContent to pass new props**

For each `<EstimateV2DetailsMaterialTable>` call in `EstimateV2DetailsPageContent.tsx`, add:

```tsx
scope="wall"   // or "ceiling" or "trim"
conditionsVm={vm.conditions}
onConditionToggle={(scope, conditionId, level) =>
  actions.mutations.setRoomCondition(scope, conditionId, level)
}
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsPageContent.tsx"
git add "app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsMaterialTable.tsx"
git commit -m "feat: wire room conditions bar and scope condition panels into details page"
```

---

## Task 15: Integration Tests

**Files:**
- Modify: `app/crm/estimates/[id]/v2/details/_state/__tests__/useEstimateV2DetailsPage.test.tsx`

- [ ] **Step 1: Add integration test — condition selection is persisted in payload**

Read the existing test file to understand the fixture pattern, then add:

```typescript
it('persists condition selections and writes condition_factor to scope rows', async () => {
  const fixture = createMixedEstimateV2Fixture()
  const conditionModifiers = [
    {
      id: 'TRIM_OIL_BASED',
      displayName: 'Old oil-based paint',
      scope: 'trim' as const,
      modifierType: 'binary' as const,
      factorField: 'difficult_finish_factor',
      levels: { active: 1.35 },
    },
    {
      id: 'ROOM_FURNISHED',
      displayName: 'Room is furnished',
      scope: 'room' as const,
      modifierType: 'binary' as const,
      factorField: '',
      levels: { active: 1.15 },
    },
  ]
  // Set up fixture with condition modifiers available in rates/flags payload
  // (follow pattern of how roller options are set up in existing tests)

  const { result } = renderHook(() => useEstimateV2DetailsPage(fixture))

  // Toggle condition on
  act(() => {
    result.current.actions.mutations.setRoomCondition('trim', 'TRIM_OIL_BASED', 'active')
    result.current.actions.mutations.setRoomCondition('room', 'ROOM_FURNISHED', 'active')
  })

  // Save
  let body: any
  act(() => {
    result.current.actions.saveDraft()
  })
  await waitFor(() => {
    body = getLastSavePayload() // use your test's existing save interceptor
    expect(body).toBeDefined()
  })

  // condition_selections saved in job settings
  expect(body.jobsettings.condition_selections.trim).toEqual({ TRIM_OIL_BASED: 'active' })
  expect(body.jobsettings.condition_selections.room).toEqual({ ROOM_FURNISHED: 'active' })

  // condition_factor written to trim scopes: 1.35 * 1.15 = 1.5525
  const trimScopes = body.room_trim_scopes as any[]
  expect(trimScopes.length).toBeGreaterThan(0)
  trimScopes.forEach((scope: any) => {
    expect(scope.condition_factor).toBeCloseTo(1.35 * 1.15, 4)
  })

  // Wall scopes get room factor only (1.15)
  const wallScopes = body.room_wall_scopes as any[]
  wallScopes.forEach((scope: any) => {
    expect(scope.condition_factor).toBeCloseTo(1.15, 4)
  })
})
```

- [ ] **Step 2: Add test — no conditions → condition_factor is null in payload**

```typescript
it('writes null condition_factor when no conditions are selected', async () => {
  const fixture = createMixedEstimateV2Fixture()
  const { result } = renderHook(() => useEstimateV2DetailsPage(fixture))

  let body: any
  act(() => { result.current.actions.saveDraft() })
  await waitFor(() => {
    body = getLastSavePayload()
    expect(body).toBeDefined()
  })

  const trimScopes = body.room_trim_scopes as any[]
  trimScopes.forEach((scope: any) => {
    expect(scope.condition_factor == null || scope.condition_factor === 1).toBe(true)
  })
})
```

- [ ] **Step 3: Run all tests**

```bash
npx jest "app/crm/estimates/\[id\]/v2/details" --no-coverage
```

Expected: all existing tests pass, new tests pass.

- [ ] **Step 4: Commit**

```bash
git add "app/crm/estimates/[id]/v2/details/_state/__tests__/useEstimateV2DetailsPage.test.tsx"
git commit -m "test: add integration tests for condition modifier save payload contract"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Room-level conditions bar (always visible) — Task 12 + 14
- ✅ Collapsible per-scope panels (wall/ceiling/trim) — Task 13 + 14
- ✅ Segmented buttons for severity — Task 13
- ✅ Checkbox for binary — Task 12 + 13
- ✅ Template-configurable factor values — Task 2
- ✅ Additive on top of calculator factors — Task 10
- ✅ condition_selections persisted — Task 9
- ✅ condition_factor written to scope rows — Task 9
- ✅ Calculator reads condition_factor — Task 10
- ✅ VM badge counts — Task 6
- ✅ Auto-expand when conditions active — Task 13
- ✅ Warning when template not loaded — Task 11
- ✅ Dirty flag on change — Task 8 (no-op check in setRoomCondition)
- ✅ All 9 conditions in catalog — Task 2

**Known dependency to verify at implementation time:**
- Exact job settings table name for the DB migration (Task 1)
- Whether `useEstimateV2DetailsRollerOptions` needs to expose `ratesFlagsPayload` (Task 7)
- Exact store structure for `meta.jobSettings` (Task 8)
- Whether `round4` is importable in `v2DraftPayload.ts` (Task 9)
