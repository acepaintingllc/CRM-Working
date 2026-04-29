# Estimator V2 Other Items Design

## Purpose

Estimator V2 needs an **Other** section for unusual, custom, or one-off estimate work that does not fit cleanly into walls, ceilings, trim, doors, drywall, access fees, or standard materials.

The feature should make custom work fast to enter, easy to audit, and flexible enough to either show as its own line or roll into an existing estimate bucket. It should not become a second full estimator engine.

## Decisions

- Use **Other Items** as flexible estimate line items.
- Each item may optionally attach to a room.
- Each item chooses its own rollup and customer visibility behavior.
- Pricing supports a small set of fast entry modes:
  - fixed amount
  - quantity times unit rate
  - hours times labor rate
  - material/supply cost
- Labor-mode items always contribute to raw labor hours and therefore participate in the estimate-level labor-day policy.
- Cost-only items affect dollars only and do not add labor hours.
- Do not add negative values or discount behavior in v1.
- Do not add a full reusable catalog in v1.
- Do not add taxes, markup, or margin behavior unless those are later handled by a shared pricing policy.

## Item Model

Each Other item should include:

- `id`
- `estimate_id`
- `room_id` nullable
- `position`
- `active`
- `description`
- `customer_label`
- `pricing_mode`
- `quantity`
- `unit_rate`
- `labor_hours`
- `labor_rate`
- `material_cost`
- `supply_cost`
- `fixed_amount`
- `rollup_target`
- `customer_visibility`
- `internal_notes`

The persisted database shape may use snake_case column names. Client drafts should map deliberately to camelCase fields.

### Pricing Mode

Supported modes:

- `fixed`: uses `fixed_amount`.
- `quantity_rate`: uses `quantity * unit_rate`.
- `labor`: uses `labor_hours * labor_rate`.
- `material_supply`: uses `material_cost + supply_cost`.

The calculation result should separate raw inputs from derived/effective totals, matching the estimator architecture rule:

- input values
- derived values
- override values, if added later
- effective values

For v1, Other items should not need separate override fields because each item is already manually entered.

## Rollup Targets

Each item should choose one rollup target:

- `other`: show and total under an Other bucket
- `walls`
- `ceilings`
- `trim`
- `doors`
- `drywall`
- `room_total`
- `job_total`

Rollup target controls where the amount is grouped for internal and customer-facing summaries. It does not change how the item is calculated.

Room behavior:

- If `room_id` is set, the item contributes to that room's total.
- If `room_id` is null, the item contributes at job level.
- A job-level item may still roll into a scope bucket or the Other bucket.
- A room-attached item with `rollup_target = room_total` contributes to that room without appearing under a specific scope bucket.

## Customer Visibility

Each item should choose one visibility mode:

- `standalone`: customer-facing outputs can show the item as its own line using `customer_label`.
- `rollup`: customer-facing outputs hide the item and include the amount in the selected rollup target.

Internal editor, details, and summary/debug views should show all active Other items regardless of visibility so hidden rollups remain auditable.

## Pricing Behavior

Other item calculations should produce an engine-compatible output or equivalent pricing input so estimate-level pricing policies can consume it.

Rules:

- Active labor-mode items add `labor_hours` to raw labor hours.
- Active labor-mode item labor cost uses the item's labor rate. If blank, it should use the effective estimate labor rate.
- Active fixed and quantity-rate items add to effective total only.
- Active material/supply items add material/supply dollars according to their entered fields.
- Inactive items are persisted but ignored by calculations.
- All valid active items contribute before labor-day and job-minimum policies.
- Job minimum allocation should include room-attached Other item base totals.

## UI Placement

Add **Other** to the Estimator V2 editor as a scope-like section, but keep the controls simpler than walls, ceilings, trim, doors, or drywall.

Expected controls:

- add Other item
- duplicate item
- include/exclude item
- delete item
- choose optional room
- choose pricing mode
- choose rollup target
- choose customer visibility
- edit description/customer label
- edit notes
- reorder items

The section should work for both selected-room context and job-level custom work:

- room-attached items should be easy to add while editing a room
- job-level items should be reachable without needing a fake room

## Architecture

Canonical implementation belongs under the Estimator V2 estimate route and shared estimator domain:

- route UI: `app/crm/estimates/[id]/v2`
- shared calculations/normalization: `lib/estimator`
- shared types: `types/estimator`
- server save/load orchestration: existing estimate V2 server modules

Do not add quote-side duplicate behavior under `app/crm/quotes/[id]`.

The feature should follow the existing V2 save/load pattern:

- sanitize drafts before save
- build save payload with snake_case persistence rows
- server persists through the canonical V2 save path
- server returns calculation payloads and pricing summary
- editor reconciles returned rows into local drafts
- dirty snapshots include Other items

## Summary And Output

Editor summary:

- selected-room totals should include room-attached Other items
- job-level totals should include job-level Other items
- hidden rollups should still be visible in internal summary/debug context

Customer-facing summary:

- `standalone` Other items may appear as their own rows
- `rollup` Other items should be included in the chosen rollup target without exposing the internal Other label
- no hidden item should be lost from final totals

## Validation

Validation should be permissive for autosave and stricter for manual save, matching existing V2 behavior.

Manual save should reject:

- active items where both `description` and `customer_label` are blank
- active fixed items without a positive fixed amount
- active quantity-rate items without positive quantity and unit rate
- active labor items without positive labor hours
- active material/supply items without at least one positive cost field
- invalid room references
- invalid rollup targets or visibility values

Labor rate may be blank for labor-mode items because the estimate labor rate can be used as default.

## Tests

Add focused tests for:

- draft payload normalization
- calculation results per pricing mode
- labor-mode contribution to raw labor hours and labor-day policy
- cost-only items not adding labor hours
- room-attached rollup into room totals
- job-level rollup into estimate totals
- hidden rollup vs standalone customer-facing rows
- dirty snapshot coverage
- save/load reconciliation
- summary row rendering

## Out Of Scope For V1

- reusable Other item catalog
- negative values, discounts, or credits
- tax, markup, margin, or commission policies
- complex formulas
- file attachments
- approval workflows
- customer-editable custom lines

## Open Implementation Notes

- The existing `EstimateV2ResponseInputs` already includes `other: UnsafeRecord[]`; implementation must inspect the current load/save path and either wire that placeholder through or replace it with typed Other item rows.
- `pricingPolicies.ts` already has an `other` engine kind, which may be the right integration point if it keeps pricing policy code simple.
- The implementation should avoid blending Other with access fees. Access fees are cataloged job-level access charges; Other items are custom estimating work.
