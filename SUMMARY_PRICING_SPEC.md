# Summary / Pricing Policies Module Spec

## Purpose

This document defines estimate-level pricing behavior.

It covers:

- labor day policy
- job minimum policy
- estimate-level adjustments
- final totals
- pricing controls

This module runs after detailed scope, material, and room calculations.

## Module Goal

The summary module should:

- combine all room and estimate-level totals
- apply pricing policies consistently
- keep adjustments visible internally
- allow control over final pricing behavior
- avoid hidden or confusing logic

## Position In Calculation Flow

The summary module runs after:

- scope calculations such as walls, ceilings, doors, trim, drywall
- material and supply calculations
- room rollups

Then it applies:

- labor policy
- pricing adjustments
- final totals

## Core Totals

The system should calculate and expose:

### Pre-policy totals

- total labor hours
- total labor days raw
- total material cost
- total supply cost
- total estimate price before adjustments

### Post-labor-policy totals

- adjusted labor days
- adjusted labor cost
- updated estimate total

### Post-minimum totals

- minimum adjustment amount
- final estimate total

## Labor Day Policy

### Purpose

Standardize how labor is billed at the estimate version level.

### Rules

- if labor days are under `1`, set billable labor to `1` day
- if labor days are `1` day or more, round up to the selected increment
- rounding is always upward

### Inputs

- labor policy enabled, default `true`
- rounding increment such as `0.5` day

### Examples

- `0.5` days -> `1.0` day
- `2.2` days -> `2.5` days
- `2.7` days -> `3.0` days

### Notes

- applies at estimate level only
- should not be applied per room
- should not be applied per scope line
- must stay clearly visible in summary

## Job Minimum Policy

### Purpose

Ensure minimum job pricing while keeping customer-facing output clean.

### Rules

- if estimate total is below the job minimum, increase total to the minimum
- customer does not see a separate minimum-charge line
- system stores the adjustment internally
- system distributes the adjustment across rooms

### Inputs

- job minimum value

### Outputs

- pre-minimum total
- minimum adjustment amount
- post-minimum final total

### Room allocation logic

Allocate the minimum adjustment across rooms:

- based on each room's share of the pre-adjustment total

Each room should be able to expose:

- base room total
- allocated minimum adjustment
- final room total

## Prep Job Trips Integration

Prep job trips should be included in estimate totals.

Behavior:

- included after scope calculations
- treated as a separate internal estimate component
- included in final total before minimum policy

Prep trips may include:

- trip fee
- actual work time
- minimum billable time

## Access / Shared Charges Integration

Access charges should:

- be included once per estimate version
- be allocated across rooms where used
- contribute to final totals
- avoid duplicate charging of the same fee type

## Material And Supply Totals

Summary should include and keep visible:

- total paint cost
- total primer cost
- total supply cost

These should remain separate from labor.

## Final Estimate Total

The final total should include:

- labor
- materials
- supplies
- prep job trips
- access/shared charges
- minimum adjustment when applicable

## Adjustment Visibility

Internally, the system should expose:

- raw totals
- labor-adjusted totals
- minimum-adjusted totals

Customer-facing output may be simpler than internal calculation detail.
The internal detail must still remain traceable.

## Manual Pricing Controls

The summary module should allow:

- manual override of total estimate price
- optional manual adjustment amount
- advanced pricing controls in a clearly visible section

Rules:

- overrides must not destroy underlying calculations
- overrides must remain visible internally

## Future Pricing Features

The design should leave room for:

### Pricing packages

- good / better / best
- package-based defaults

### Rules engine

- conditional pricing changes
- automatic adjustments

### Optional and alternate pricing

- alternate estimate versions
- optional add-ons
- split vs combined pricing

## Open Decisions

- whether labor rate is fixed or adjustable per estimate
- how manual total override interacts with room totals
- whether rounding can be disabled per estimate
- whether minimum should be optional or always present

## Design Rules

- apply pricing policies after all scope calculations
- keep all adjustments traceable internally
- avoid hidden math
- separate calculation from pricing control
- ensure final total is easy to understand

## Final Flow Summary

1. calculate all scope items
2. roll up to rooms
3. roll up to estimate version
4. apply labor policy
5. apply job minimum
6. produce final total
