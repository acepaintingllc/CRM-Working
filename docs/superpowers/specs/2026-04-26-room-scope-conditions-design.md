# Room & Scope Conditions — Design Spec

**Date:** 2026-04-26
**Branch:** Room-Input
**Status:** Approved, ready for implementation planning

---

## Overview

Add a conditions & modifiers layer to the estimate v2 details (room input) page. Estimators can flag real-world conditions that affect painting labor — things like oil-based trim, heavy caulking, or a furnished room — and have them automatically apply calibrated factor multipliers on top of the existing calculator factors. Values are template-configurable per org.

---

## What We're Not Doing

These conditions live on the details page and affect painting labor only. They are not:
- A replacement for the calculator's existing factor inputs (height, profile, etc.)
- A way to add prep scope or drywall repair line items (those are separate scopes)
- A primer strategy tool (spot prime % handles water stains in the calculator)
- Per-color-group wall conditions (conditions are room-wide per scope type)

---

## Data Model

### 1. Template: `condition_modifiers` rows

Stored in `estimator_template_constant_rows` under `category_key = 'condition_modifiers'` (already a valid key in the DB constraint).

One row per condition. `values_json` shape:

```json
{
  "id": "TRIM_CAULKING",
  "display_name": "Caulking needed",
  "scope": "trim",
  "modifier_type": "severity",
  "factor_field": "caulk_fill_factor",
  "levels": {
    "minor":    1.10,
    "moderate": 1.25,
    "major":    1.50
  }
}
```

Binary conditions use `"modifier_type": "binary"` and a single `"active"` key in `levels`:

```json
{
  "id": "TRIM_OIL_BASED",
  "display_name": "Old oil-based paint",
  "scope": "trim",
  "modifier_type": "binary",
  "factor_field": "difficult_finish_factor",
  "levels": {
    "active": 1.35
  }
}
```

### 2. Room storage: `condition_selections jsonb`

New column on the rooms table (or equivalent estimate room join table). One column per room, structured by scope type:

```json
{
  "room":    { "ROOM_FURNISHED": "active" },
  "wall":    { "WALL_CUT_IN": "moderate", "WALL_TEXTURE": "none" },
  "ceiling": { "CEIL_TEXTURE": "minor" },
  "trim":    { "TRIM_OIL_BASED": "active", "TRIM_CAULKING": "major" }
}
```

Keys present with value `"none"` are equivalent to absent (no factor applied). Only non-none values affect calculation.

### 3. Calculation: additive on top of calculator factors

Conditions do NOT overwrite existing factor fields. They produce an additional `conditionFactor` per scope that multiplies into the final modifier:

```
wallModifier   = calculatorWallFactors   × wallConditionFactor   × roomConditionFactor
ceilModifier   = calculatorCeilFactors   × ceilConditionFactor   × roomConditionFactor
trimModifier   = calculatorTrimFactors   × trimConditionFactor   × roomConditionFactor
```

`conditionFactor` for a scope = product of all active condition level values for that scope type.
`roomConditionFactor` = product of all active room-level condition values (applies to every scope).

Example: `TRIM_OIL_BASED` active (1.35) + `TRIM_CAULKING` major (1.50) + room furnished (1.15):
```
trimConditionFactor = 1.35 × 1.50 = 2.025
finalTrimModifier   = calculatorTrimFactors × 2.025 × 1.15
```

---

## Condition Catalog (Default Values)

All values are defaults — orgs tune them in their template.

### Room Level

| ID | Display Name | Type | Active |
|---|---|---|---|
| `ROOM_FURNISHED` | Room is furnished | Binary | 1.15 |

### Walls (`complexity_factor` / cut-in factors)

| ID | Display Name | Type | Minor | Moderate | Major |
|---|---|---|---|---|---|
| `WALL_CUT_IN` | Heavy cut-in areas | Severity | 1.10 | 1.20 | 1.35 |
| `WALL_TEXTURE` | Heavy wall texture | Severity | 1.10 | 1.20 | 1.30 |

### Ceiling (`complexity_factor`)

| ID | Display Name | Type | Minor | Moderate | Major |
|---|---|---|---|---|---|
| `CEIL_TEXTURE` | Textured / popcorn ceiling | Severity | 1.15 | 1.30 | 1.50 |

### Trim

| ID | Display Name | Type | Factor Field | Active / Minor | Moderate | Major |
|---|---|---|---|---|---|---|
| `TRIM_OIL_BASED` | Old oil-based paint | Binary | `difficult_finish_factor` | 1.35 | — | — |
| `TRIM_CAULKING` | Caulking needed | Severity | `caulk_fill_factor` | 1.10 | 1.25 | 1.50 |
| `TRIM_PREP` | Heavy prep / sanding | Severity | `prep_factor` | 1.10 | 1.25 | 1.45 |
| `TRIM_PROFILE` | Complex profile (crown, millwork) | Severity | `profile_factor` | 1.10 | 1.20 | 1.35 |
| `TRIM_STAIRS` | Stair / step trim | Binary | `stair_factor` | 1.20 | — | — |
| `TRIM_MASKING` | Heavy masking needed | Severity | `masking_factor` | 1.10 | 1.20 | 1.35 |

---

## UI

### Layout

```
┌─ Room Conditions ──────────────────────────────────────────┐
│  [ ] Furnished                                             │
└────────────────────────────────────────────────────────────┘

┌─ Walls ────────────────────────────────────────────────────┐
│  COLOR1   480 sqft   4 gal   [override____]  [roller  ▼]  │
│  COLOR2   220 sqft   2 gal   [override____]  [roller  ▼]  │
│                                                            │
│  ▶ Wall Conditions                          (none active)  │
└────────────────────────────────────────────────────────────┘

┌─ Ceiling ──────────────────────────────────────────────────┐
│  Ceiling  180 sqft   1 gal   [override____]  [roller  ▼]  │
│                                                            │
│  ▼ Ceiling Conditions                       (1 active) ⚠  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Textured / popcorn                                   │  │
│  │ [  None  ] [ Minor ] [Moderate] [ Major ]            │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘

┌─ Trim ─────────────────────────────────────────────────────┐
│  Trim     85 lf      1 gal   [override____]                │
│                                                            │
│  ▼ Trim Conditions                          (2 active) ⚠  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [✓] Old oil-based paint                              │  │
│  │                                                      │  │
│  │ Caulking needed                                      │  │
│  │ [  None  ] [ Minor ] [Moderate] [ Major ]            │  │
│  │                                                      │  │
│  │ Heavy prep / sanding                                 │  │
│  │ [  None  ] [ Minor ] [Moderate] [ Major ]            │  │
│  │                                                      │  │
│  │ Complex profile                                      │  │
│  │ [  None  ] [ Minor ] [Moderate] [ Major ]            │  │
│  │                                                      │  │
│  │ [✓] Stair / step trim                                │  │
│  │                                                      │  │
│  │ Heavy masking needed                                 │  │
│  │ [  None  ] [ Minor ] [Moderate] [ Major ]            │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Behavior

- **Collapsed by default** when no conditions are active for a scope
- **Auto-expands on load** if any conditions are set (non-none values in `condition_selections`)
- **Badge** in collapsed header shows `(N active) ⚠` for quick scanning
- **Room conditions** always visible — no collapse, small enough to always show
- **Immediate VM update** — selecting a condition recalculates conditionFactor and rebuilds the VM, same pattern as gallon override inputs
- **No blocking validation** for conditions themselves — they're optional adjustments. The one exception: if `condition_modifiers` template rows haven't been seeded for the org, show a non-blocking warning in the conditions panel ("Conditions not configured — contact your administrator") and disable the controls
- **Dirty flag** — any condition change marks the estimate dirty, same as overrides and roller selections

### Controls

- **Binary modifier:** single checkbox, label to the right
- **Severity modifier:** label above, segmented button row: `[ None ] [ Minor ] [ Moderate ] [ Major ]`
- Selected level is highlighted; None means the condition is off (factor = 1.0, not persisted as active)

---

## Data Flow

```
User toggles condition
        ↓
setRoomCondition(scope, conditionId, level) mutation
        ↓
Merges into room's condition_selections draft
        ↓
buildEstimateV2DetailsVm() recomputes:
  - loads condition_modifiers from template
  - resolves conditionFactor per scope type
  - multiplies into finalModifier alongside calculator factors
        ↓
Material rows reflect updated hours / cost
        ↓
On save: condition_selections persisted to rooms table
         via v2DraftPayload (new field)
        ↓
On reload: condition_selections hydrated from DB,
           conditions panel shows active state
```

---

## New Files

- `estimateV2DetailsConditions.ts` — condition catalog types, `resolveConditionFactor()` pure function
- `estimateV2DetailsConditions.test.ts` — unit tests for factor resolution

## Modified Files

- `estimateV2DetailsVm.ts` — integrate `conditionFactor` into wall/ceiling/trim modifier product
- `estimateV2DetailsValidation.ts` — warning when condition_modifiers template not loaded
- `useEstimateV2DetailsMutations.ts` — add `setRoomCondition()` mutation
- `useEstimateV2DetailsPage.ts` — load condition_modifiers from template, hydrate condition_selections
- `EstimateV2DetailsPageContent.tsx` — room conditions section + per-scope collapsible sections
- `EstimateV2DetailsMaterialTable.tsx` — conditions panel within each scope section
- `v2DraftPayload.ts` — include condition_selections in save payload
- `lib/estimator/trim.ts`, `walls.ts`, `ceilings.ts` — accept conditionFactor parameter

## New DB Artifacts

- Migration: `condition_selections jsonb` column on rooms table
- Migration: seed `condition_modifiers` template rows with default catalog values
- Template admin UI (future): not in scope for this iteration

---

## Out of Scope (Add Later)

- Per-color-group wall conditions
- Custom conditions beyond the catalog (free-form factor entry)
- Conditions affecting material cost (currently labor only)
- Template admin UI for tuning factor values
