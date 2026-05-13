h# Playwright Agent E2E Test Plan — Estimate V2 Full Flow

**Date:** 2026-05-08
**Branch:** Quote-Rewrites
**Tester:** GPT/Claude browser agent via Playwright

---

## Overview

Three end-to-end quote runs that each exercise the full Estimate V2 surface area with different data. After all three are complete, actuals are entered on each job, then the job review page and insights dashboard are verified.

**Flow per quote:**
1. Create quote → Editor (add rooms + scopes) → Details (verify calculations) → Summary (verify totals + readiness) → Send to customer
2. After all 3 quotes: Enter actuals on each job → Job Review page → Insights dashboard

**Base URL:** `http://localhost:3000` (or dev URL)
**Test customer:** Use an existing test customer with an open job for each quote, or create one per run.

---

## Quote 1 — Basic Interior (Happy Path)

**Goal:** Exercise the core walls/ceiling/trim happy path with auto-calc pricing and a clean send.

### 1.1 Create the Quote
- Navigate to `/crm/quotes/create`
- Select test job (or create job: "Q1 Basic Interior")
- Confirm new quote opens in Editor at `/crm/quotes/[id]/v2` or `/crm/estimates/[id]/v2`

### 1.2 Editor — Room 1: Living Room
- Add room: name "Living Room", type Rectangular
- Dimensions: length 14ft, width 16ft, wall height 9ft
- Enable **Walls**: include Y, topcoats 2, no primer
- Enable **Ceiling**: include Y, topcoats 2, no primer
- Enable **Trim**: include Y, measurement mode = room helper (auto-calc perimeter)
- Assign wall paint product, ceiling paint product, trim paint product from catalog
- Save

### 1.3 Editor — Room 2: Bedroom
- Add room: name "Bedroom", type Rectangular
- Dimensions: 12ft x 10ft, wall height 9ft
- Enable **Walls**: include Y, topcoats 2
- Enable **Ceiling**: include Y, topcoats 1
- Trim: leave excluded
- Assign paint products
- Save

### 1.4 Editor — Verify Save/Reload
- Save estimate
- Reload the page
- Confirm room count is still 2, totals unchanged

### 1.5 Details Page
- Navigate to Details (`/v2/details`)
- Verify Paint & Supplies section shows wall paint, ceiling paint, trim paint
- Verify no readiness errors are shown
- Verify access fees section is empty

### 1.6 Summary Page
- Navigate to Summary (`/v2/summary`)
- Confirm KPI rail shows labor hours, total price, paint gallons
- Confirm no error alerts (info alerts OK)
- Confirm room blocks for "Living Room" and "Bedroom" are present
- Confirm visible scope rows sum to displayed total

### 1.7 Send to Customer
- Navigate to Send page (`/send`)
- Verify email composer loads with customer email pre-filled
- Leave template and email body as-is
- Proceed to Review stage
- Confirm customer document shows product names (not internal IDs)
- Confirm excluded scopes are absent
- Confirm quote total on document matches summary total
- Submit / generate customer quote
- Confirm success state

---

## Quote 2 — Overrides + Access Fees + Drywall

**Goal:** Exercise override paths (hours, supply cost), access fees on a room, and drywall repairs.

### 2.1 Create the Quote
- Navigate to `/crm/quotes/create`
- Select or create job: "Q2 Overrides & Fees"

### 2.2 Editor — Room 1: Kitchen
- Add room: name "Kitchen", type Rectangular
- Dimensions: 10ft x 12ft, wall height 9ft
- Enable **Walls**: include Y, topcoats 2
  - Set **override hours** on the wall scope (enter a value higher than raw)
- Enable **Ceiling**: include Y, topcoats 2
  - Set **override supply cost** on ceiling scope
- Enable **Trim**: include Y, measurement mode = manual (enter 38 LF)
- Add **access fee** to this room (e.g. standard scaffold or ladder fee, qty 1)
- Assign all paint products
- Save

### 2.3 Editor — Room 2: Hallway
- Add room: name "Hallway", type Rectangular
- Dimensions: 4ft x 20ft, wall height 9ft
- Enable **Walls**: include Y, topcoats 2
- Ceiling: excluded
- Trim: excluded
- Add a wall **flag** (e.g. high-difficulty or narrow-space flag if available)
- Save

### 2.4 Editor — Room 3: Bathroom (Drywall)
- Add room: name "Bathroom", type Rectangular
- Dimensions: 8ft x 8ft, wall height 8ft
- Walls: excluded
- Ceiling: excluded
- Trim: excluded
- Add **drywall repair**: surface = Wall, type = patch, qty 3
- Save

### 2.5 Editor — Pricing Policy
- Open job settings / pricing panel
- Set a custom **markup override** (e.g. 15% above default)
- Confirm totals update

### 2.6 Details Page
- Verify access fee row appears for Kitchen
- Verify wall scope override hours are reflected
- Verify drywall repair line for Bathroom is present
- Verify override indicator is shown on affected scopes

### 2.7 Summary Page
- Confirm all three rooms appear
- Confirm override indicators visible on Kitchen scopes
- Confirm drywall section total is non-zero
- Confirm no blocking error alerts

### 2.8 Send to Customer
- Navigate to Send
- Edit scope notes: add a note "Includes scaffold fee for kitchen access"
- Proceed to Review
- Confirm scope notes appear in customer document
- Confirm access fee appears (or is correctly rolled up) in customer view
- Submit

---

## Quote 3 — Full Complexity

**Goal:** Exercise prejob items, other line items, job minimum, paint-supplied-by-customer, primer, roller setup, and conditions.

### 3.1 Create the Quote
- Navigate to `/crm/quotes/create`
- Select or create job: "Q3 Full Complexity"

### 3.2 Job Settings
- Set **paint supplied by**: Customer
- Enable **job minimum**: set amount above expected subtotal to force it active
- Enable **labor day policy** if available
- Set crew size: 2

### 3.3 Editor — Room 1: Master Bedroom
- Add room: name "Master Bedroom", type Rectangular
- Dimensions: 16ft x 18ft, wall height 9ft
- Enable **Walls**: include Y, topcoats 2, **primer Y** (add primer product), spot prime 25%
- Enable **Ceiling**: include Y, topcoats 2, primer Y
- Enable **Trim**: include Y, measurement mode = room helper
  - Add baseboard type, door count 2, window count 2
- Add a **room condition** selection (e.g. existing damage or preparation condition)
- Add room **flag** if available
- Assign all paint products
- Save

### 3.4 Editor — Prejob Items
- Navigate to Prejob section
- Add prejob item: category = "Prep", task = "Cover furniture", qty 1, hours each 0.5
- Add second prejob item: category = "Travel", trip name = "Initial walkthrough", man qty 1, hours each 1.0
- Save

### 3.5 Editor — Other Line Items
- Navigate to Other Items section
- Add item: description "Tape and plastic protection", qty 2, unit rate $25, rollup target = supplies
- Add item: description "Specialty brush surcharge", fixed amount $75, customer visibility = visible
- Save

### 3.6 Editor — Rollers
- Navigate to Roller/Color section
- Add at least one color entry with roller cover selection
- Save

### 3.7 Details Page
- Verify primer gallons appear in Paint & Supplies
- Verify prejob items are listed
- Verify other line items appear
- Verify job minimum is shown as active and overrides subtotal
- Verify paint-supplied-by-customer flag affects material cost display (materials $0 or supplier flag)

### 3.8 Summary Page
- Confirm KPI rail reflects job minimum as final total
- Confirm primer scopes show separate primer rows
- Confirm other items and prejob roll up correctly
- Confirm no blocking errors

### 3.9 Readiness Error Check (while on this quote)
- Temporarily remove the paint product from one wall scope
- Confirm Summary shows an **error alert** (not just info)
- Confirm readiness blocks quote generation
- Re-assign the product
- Confirm error clears

### 3.10 Send to Customer
- Navigate to Send
- Select a non-default email template if available
- Set quote validity date (e.g. 30 days out)
- Add scope notes describing the complexity
- Proceed to Review
- Confirm customer document total equals job minimum amount
- Confirm "paint supplied by customer" is reflected appropriately
- Confirm product names visible, internal IDs absent
- Submit

---

## Actuals Entry (All 3 Jobs)

For each of the 3 jobs created above:

- Navigate to `/crm/jobs/[id]/actuals`
- Enter **actual labor hours**: use a value meaningfully different from the estimate (e.g. ±20%)
- Enter **actual material cost**: slightly over or under estimate
- Enter **actual other costs** if fields are available
- Save actuals
- Confirm save success state

**Suggested actuals data:**
| Job | Est. Labor | Actual Labor | Est. Materials | Actual Materials |
|-----|-----------|--------------|----------------|------------------|
| Q1 Basic | (from summary) | +15% | (from summary) | -5% |
| Q2 Overrides | (from summary) | -10% | (from summary) | +20% |
| Q3 Complex | (from summary) | +25% | (from summary) | +10% |

---

## Job Review Page (All 3 Jobs)

For each job:

- Navigate to `/crm/jobs/[id]/review`
- Confirm variance breakdown shows estimate vs actual comparison
- Confirm labor variance is flagged (positive or negative delta visible)
- Confirm material variance is flagged
- Use **ReviewClassificationSection** to classify at least one variance (mark as expected or unexpected)
- Confirm classification saves
- Note any anomalies in summary section

---

## Insights Dashboard

- Navigate to `/crm/insights`
- Confirm dashboard loads without error
- Confirm trend data reflects the 3 recently-completed jobs (may require a moment for aggregation)
- Confirm at least one insight or recommendation card is present
- Confirm no broken chart or empty-state error for charts that should have data

---

## Regression Notes

- [ ] Browser: Playwright Chromium
- [ ] Date: 2026-05-08
- [ ] Branch: Quote-Rewrites
- [ ] Record any mismatch between editor, summary, and customer quote totals
- [ ] Record any fields that fail to save/reload correctly
- [ ] Record any broken navigation between quote → review → insights
