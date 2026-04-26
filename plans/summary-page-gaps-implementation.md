# Summary Page — Information Gap Implementation Plan

## Overview

This plan addresses 8 information gaps identified on the Estimator V2 / Quotes summary page at [`app/crm/estimates/[id]/v2/summary/`](app/crm/estimates/[id]/v2/summary/). Each gap is ranked by priority and includes the files that need modification, the approach, and data source.

---

## Priority 1 — High Impact

### 1.1 Add `trimPaintMaterialCost` line item to Paint & Supplies table

**Files to modify:**
- [`app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts) — `buildPaintSupplyRows()` function

**Change:** Add a `Trim paint` row between `Ceiling paint` and `Primer` in the returned array, sourcing from `pricingSummary.trimPaintMaterialCost`.

**Data source:** [`EstimateV2PricingSummary.trimPaintMaterialCost`](types/estimator/v2.ts:159) — already available in the data.

**Why this is a bug:** The [`calculatePaintSuppliesTotal`](app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts:561-568) function already includes `trimPaintMaterialCost` in the total, but the breakdown table omits it. This creates a confusing discrepancy where the line items don't sum to the total.

---

### 1.2 Add job title and customer contact info to header

**Files to modify:**
- [`app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx`](app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx) — header section (both mobile and desktop)
- [`app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts) — expose `job.title`, `job.customer_email`, `job.customer_phone`

**Change:** Below the customer name/address line, add a secondary line showing:
- Job title (if available)
- Customer email and phone (if available)

**Data source:** [`EstimateV2JobMeta`](types/estimator/v2.ts:45-54) — `title`, `customer_email`, `customer_phone` are already loaded via [`useEstimateV2SummaryLoader`](app/crm/estimates/[id]/v2/_state/useEstimateV2SummaryLoader.ts:164-170) and available as the `job` prop.

---

## Priority 2 — Medium Impact

### 2.1 Add "last updated" timestamp

**Files to modify:**
- [`app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx`](app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx) — header area
- [`app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts) — expose `updatedAt` from `data.estimate.updated_at`

**Change:** Add a small timestamp line in the header area showing when the estimate was last updated, formatted as a relative time (e.g., "Updated 2 hours ago") or absolute date.

**Data source:** [`EstimateV2EstimateMeta.updated_at`](types/estimator/v2.ts:42) — already in the `data.estimate` object.

**Format helper:** Use a simple formatter in [`estimateV2SummaryFormat.ts`](app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryFormat.ts) — no need for a library dependency; a basic relative-time formatter can be added.

---

### 2.2 Add raw vs effective labor comparison

**Files to modify:**
- [`app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryKPIRail.tsx`](app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryKPIRail.tsx) — add raw labor info
- [`app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts) — expose `rawLaborHours`, `rawLaborDays`
- [`app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts) — `buildPricingKpis()` to include raw values

**Change:** In the KPI rail, when labor day policy is enabled and raw != effective, show a subtle indicator like "Raw: Xh → Effective: Yh" or add a tooltip. On desktop, add a 6th KPI card showing "Raw Hours" when different from effective.

**Data source:** [`EstimateV2PricingSummary.rawLaborHours`](types/estimator/v2.ts:152) and `rawLaborDays` — already in the data.

**Conditional display:** Only show when `rawLaborHours !== effectiveLaborHours` (i.e., when a policy adjustment is active).

---

### 2.3 Add room table footer with roll-up totals

**Files to modify:**
- [`app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx`](app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx) — `renderRoomsSection()` to add a footer row
- [`app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts) — expose aggregated totals

**Change:** Add a sticky footer row at the bottom of the room table (desktop) or a summary card (mobile) showing:
- Total rooms
- Total effective sq ft
- Total labor hours
- Total paint $
- Total supplies $
- Total $
- 100% (for % of job column)

**Data source:** Aggregate from `derived.roomBlocks` — sum up `roomArea`, `totals.labor`, `totals.paint`, `totals.supplies`, `roomTotal`.

---

## Priority 3 — Lower Impact

### 3.1 Show condition modifiers per room

**Files to modify:**
- [`app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts) — `buildRoomBlocks()` to include condition info
- [`app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryRoomBlock.tsx`](app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryRoomBlock.tsx) — display condition chips
- [`app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts) — pass condition data through

**Change:** When a room has active condition selections (e.g., `wall: 'moderate'`), show a small badge or chip in the room row indicating the condition level. This is subtle — a colored dot or short label.

**Data source:** [`EstimateV2RoomInputRow.condition_selections`](types/estimator/v2.ts:215) — already in `data.inputs.rooms[]`.

**Conditional display:** Only show if any condition is non-default (not `'active'`).

---

### 3.2 Show access fees and "other" charges

**Files to modify:**
- [`app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived.ts) — add `buildAccessFeesRows()` and `buildOtherChargesRows()` functions
- [`app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts`](app/crm/estimates/[id]/v2/summary/_lib/useEstimateV2SummaryDerived.ts) — expose access fee and other charge data
- [`app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx`](app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx) — add section for access fees / other charges
- [`types/estimator/v2.ts`](types/estimator/v2.ts) — may need to add typed shapes for `access_fees` and `other` rows

**Change:** Add a new section (or extend the Price Breakdown table) to show access fees and other charges when present. These are stored in [`EstimateV2ResponseInputs.access_fees`](types/estimator/v2.ts:255) and [`other`](types/estimator/v2.ts:256), which are `UnsafeRecord[]`.

**Data source:** `data.inputs.access_fees` and `data.inputs.other` — these are already in the `Partial<EstimateV2ResponseInputs>` type on [`EstimateV2SummaryPageData`](types/estimator/v2.ts:269-286).

**Note:** The `access_fees` and `other` arrays are loaded from the DB in [`loadEstimateAssembly.ts`](lib/server/estimate-v2/loadEstimateAssembly.ts:36-37) and included in the response. They are available on the summary page via the same API endpoint.

---

### 3.3 Add send history / portal status indicator

**Files to modify:**
- [`app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx`](app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx) — add send status section near the action links
- [`app/crm/estimates/[id]/v2/_state/useEstimateV2SummaryData.ts`](app/crm/estimates/[id]/v2/_state/useEstimateV2SummaryData.ts) — load send status data
- [`app/crm/estimates/[id]/v2/_state/useEstimateV2SummaryLoader.ts`](app/crm/estimates/[id]/v2/_state/useEstimateV2SummaryLoader.ts) — fetch send status alongside estimate data

**Change:** Add a small indicator showing:
- Whether the estimate has been sent (status badge)
- When it was last sent
- Whether the customer has viewed/accepted/declined it

**Data source:** The [`CustomerSendVersion`](lib/customer-send/client.ts:5-12) type has `status`, `sent_at`, `viewed_at`, `accepted_at`, `declined_at`. This data would need to be fetched from the customer send API or included in the summary API response.

**Approach options:**
1. **Lightweight:** Add a new API call in the summary loader to fetch send status from the existing customer-send endpoint.
2. **Better:** Include send status in the summary API response by extending the server-side `loadEstimateV2Response` to also load public version data.

---

## Implementation Order

```
Phase 1 — Bug fix + high-value additions
├── 1.1 Add trimPaintMaterialCost to Paint & Supplies table
├── 1.2 Add job title and customer contact info
└── 2.1 Add last-updated timestamp

Phase 2 — Medium-value improvements
├── 2.2 Add raw vs effective labor comparison
└── 2.3 Add room table footer with roll-up totals

Phase 3 — Niche enhancements
├── 3.1 Show condition modifiers per room
├── 3.2 Show access fees and other charges
└── 3.3 Add send history / portal status
```

---

## File Change Summary

| File | Changes |
|------|---------|
| `estimateV2SummaryDerived.ts` | Add trim paint row, raw labor KPIs, room footer totals, access fees/other helpers, condition data |
| `useEstimateV2SummaryDerived.ts` | Expose new derived fields (job meta, timestamps, raw KPIs, aggregated totals, conditions, fees) |
| `estimateV2SummaryFormat.ts` | Add relative-time formatter |
| `EstimateV2SummaryPageContent.tsx` | Add job info line, timestamp, room table footer, access fees section, send status indicator |
| `EstimateV2SummaryKPIRail.tsx` | Add raw labor display when policy-active |
| `EstimateV2SummaryRoomBlock.tsx` | Add condition badge display |
| `useEstimateV2SummaryLoader.ts` | Optionally load send status data |
| `useEstimateV2SummaryData.ts` | Optionally thread send status through |
| `types/estimator/v2.ts` | Optionally add typed shapes for access_fees/other rows |

---

## Test Files to Update

| Test File | What to Add |
|-----------|-------------|
| `EstimateV2SummaryDerived.test.tsx` | Test trim paint row in `buildPaintSupplyRows`, test raw KPIs, test room footer aggregation |
| `EstimateV2SummaryEditorParity.test.tsx` | Verify new derived fields match editor state |
| `EstimateV2SummaryPageContent.test.tsx` | Verify new UI elements render correctly |
