# Estimator V2 Drywall Repairs Design

Date: 2026-04-28
Status: Approved design, pending implementation plan

## Purpose

Add the drywall repair portion of Estimator V2 for larger drywall items, not small cosmetic touchups such as nail-hole filling. The feature should make drywall repair pricing auditable while keeping the room editor fast for estimators.

Drywall repairs are a room-owned Estimator V2 scope. They are stored as their own canonical repair collection, but edited from inside the existing Walls and Ceilings sections because that is where the estimator is already thinking about the affected surface.

## V1 Scope

V1 includes these repair types:

| Repair type | Surface | Unit |
| --- | --- | --- |
| `corner_tape_replacement` | Wall | LF |
| `flat_wall_crack` | Wall | LF |
| `stress_crack_at_seam` | Wall | LF |
| `ceiling_crack` | Ceiling | LF |
| `patch_opening_repair` | Wall or ceiling | SQFT |

Out of scope for V1:

- Nail-hole filling and minor cosmetic patching.
- Texture-specific variants.
- Water-damage-specific variants.
- Skim coat area pricing.
- Note/location fields per repair line.
- Automatic creation of related paint scope.
- Estimate-level drywall repairs not tied to a room.

## Product Behavior

Each drywall repair line is tied to a room and a surface: `wall` or `ceiling`.

The estimator enters:

- repair type
- quantity
- unit, derived from the repair type

The system derives:

- default rate
- ceiling multiplier, when the surface is `ceiling`
- rounded/effective quantity
- calculated total

The system supports a hidden advanced override:

- `override_total` replaces the calculated line total when present.
- Normal editing keeps this hidden unless advanced controls are expanded.

Pricing rules:

- Rates are combined unit prices.
- LF repair types price as dollars per linear foot.
- SQFT repair types price as dollars per square foot.
- Entered quantities may be decimal.
- Effective priced quantity always rounds up with `Math.ceil`.
- There is no drywall-specific minimum per repair line or per room.
- Drywall repair pricing includes the repair prep/prime needed for the repaired area.
- Painting the wider wall or ceiling remains separate in the normal paint scopes.

## Summary And Proposal Behavior

Internal Estimator V2 summary should show a separate Drywall repairs subtotal for visibility and debugging.

Customer-facing output should mention drywall repairs as included work under the affected room or surface, without exposing a separate priced drywall line. Customer-facing totals should roll drywall repair cost into the room total.

This creates two intentionally different views of the same data:

- Internal view: drywall subtotal is broken out.
- Customer view: drywall work is included in the room/surface scope and rolled into totals.

## Data Model

Add a persisted room-level table named `public.estimate_drywall_repairs`.

Proposed columns:

- `id uuid primary key default gen_random_uuid()`
- `org_id uuid not null references public.orgs(id) on delete cascade`
- `estimate_id uuid not null references public.estimates(id) on delete cascade`
- `room_id text not null`
- `surface text not null`
- `repair_type text not null`
- `unit text not null`
- `quantity numeric not null`
- `position integer not null default 0`
- `override_total numeric null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints should enforce:

- `surface in ('wall', 'ceiling')`
- `repair_type` is one of the five V1 repair types.
- `unit in ('LF', 'SQFT')`
- `quantity >= 0`
- repair type and surface compatibility, including wall-only and ceiling-only repair types.

Indexes should support loading repairs by estimate and room:

- `(org_id, estimate_id, room_id, position)`
- `(org_id, estimate_id)`

Use the existing project-standard RLS/service-role pattern for estimator tables. Route handlers and services must continue to authenticate with `requireSessionUserOrg` and return standard envelopes.

## Rates And Seed Data

Default rates are managed in Quotes -> Rates -> Drywall through the existing `unit_rates_drywall` category.

Implementation should seed the five starting drywall repair rows through SQL so local and fresh environments have usable defaults immediately.

The current generic unit-rate row shape has:

- `unit_rate_group`
- `unit_rate_type`
- `unit`
- `default_qty`
- `labor_rate`
- `material_rate`
- `amount`
- `notes`
- `active`

V1 should store the combined unit price in `amount`. `labor_rate` and `material_rate` should either remain `0` or follow the existing unit-rate convention if the admin UI expects a split. The implementation plan must verify the existing table and adapter behavior before choosing.

Ceiling multiplier should be supported without string hacks. If the current rates table has no suitable column, add a small explicit field for drywall ceiling multiplier and extend the typed rate/admin adapter path for `unit_rates_drywall`.

Seed row identities should be stable and map to the repair type keys:

- `corner_tape_replacement`
- `flat_wall_crack`
- `stress_crack_at_seam`
- `ceiling_crack`
- `patch_opening_repair`

Exact starter dollar amounts can be chosen during implementation, but the seed SQL must be easy to adjust in one place.

## Estimator Architecture

Shared drywall types belong under `types/estimator/drywall.ts` plus V2 draft additions in `types/estimator/v2.ts`.

Shared calculation logic belongs in `lib/estimator/drywall.ts`.

Estimator V2 route-local wiring belongs under:

- `app/crm/estimates/[id]/v2/_components`
- `app/crm/estimates/[id]/v2/_lib`
- `app/crm/estimates/[id]/v2/_state`

The quote route alias must stay thin. Do not create duplicate quote-side drywall editor code under `app/crm/quotes/[id]`.

The drywall calculator should return auditable output with:

- original input quantity
- rounded/effective quantity
- base unit rate
- applied ceiling multiplier
- calculated total
- override total
- effective total
- row-level issues for missing rates or invalid inputs
- room totals
- estimate subtotal

This follows the Estimator V2 rule that input, derived, override, and effective values stay separate.

## Editor UI

The UI should be compact and embedded.

Walls section:

- Add an "Add drywall repair" control.
- Offer wall-eligible repair types:
  - corner tape replacement
  - flat wall crack
  - stress crack at seam
  - patch/opening repair

Ceilings section:

- Add an "Add drywall repair" control.
- Offer ceiling-eligible repair types:
  - ceiling crack
  - patch/opening repair

Added repairs render as small editable rows under the corresponding section. Each row should show:

- repair type
- quantity
- unit
- calculated/effective total

Advanced row controls reveal manual override total. No note/location field is included in V1.

## Save And Load

Drywall repairs should be treated as a first-class editor collection, similar to trim or doors:

- normalize loaded rows into route-local drafts
- add/update/delete/reorder rows through editor mutations
- include rows in dirty snapshots
- include rows in autosave/manual save payloads
- recalculate preview totals after edits
- reload saved rows without losing ordering or overrides

The implementation should avoid embedding drywall persistence into wall or ceiling rows. UI placement is embedded; data ownership is separate.

## Testing Requirements

Be aggressive on testing. This feature touches persistence, pricing, editor state, and summary behavior.

Required test coverage:

- Unit tests for `lib/estimator/drywall.ts`.
- Quantity rounding tests, including decimal LF and SQFT values.
- Ceiling multiplier tests.
- Override precedence tests.
- Missing-rate behavior tests.
- Invalid surface/type compatibility tests.
- Room subtotal and estimate subtotal tests.
- Type and normalization tests for draft and persisted rows.
- Editor mutation tests for add/update/delete/reorder.
- Save orchestration tests proving drywall rows are included in payloads and dirty snapshots.
- Rates/flags adapter tests for seeded drywall rows and ceiling multiplier support.
- Summary tests proving internal drywall breakout and customer rollup differ correctly.
- Golden pricing test with walls, ceilings, and drywall together so drywall does not regress estimate totals or paint material calculations.

## Open Implementation Checks

Before implementation, verify:

- Exact database table/column naming conventions used by existing V2 save/load paths.
- Existing unit-rate persistence table shape and whether it already has a safe place for ceiling multiplier.
- Existing `unit_rates_drywall` adapter behavior in Quotes -> Rates.
- Whether the current pricing summary already supports a drywall engine kind cleanly, or needs a small typed extension.
- Where customer-facing proposal rows are currently generated, so "included work" wording is added in the canonical output path.

## Acceptance Criteria

- Estimators can add wall drywall repairs from the Walls section.
- Estimators can add ceiling drywall repairs from the Ceilings section.
- Repairs price from seeded/default drywall unit rates.
- Ceiling repair pricing applies the ceiling multiplier.
- Decimal quantities price using rounded-up effective quantity.
- Hidden override total replaces the calculated line total.
- Internal summary shows a Drywall repairs subtotal.
- Customer-facing output mentions drywall repair as included work without a separate priced drywall line.
- Save/load preserves drywall repair rows, ordering, quantities, and overrides.
- Tests cover calculator, rates, editor mutations, save/load, summary behavior, and at least one combined golden pricing case.
