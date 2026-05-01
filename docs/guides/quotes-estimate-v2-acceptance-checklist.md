# Quotes / Estimate V2 Acceptance Checklist

Run this before shipping major estimator changes or adding a new scope engine.

Architecture source: `docs/architecture/quote-estimate-architecture.md`.

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
