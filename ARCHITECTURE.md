# Estimator V2 Architecture

## Purpose

Estimator V2 is a custom estimating app for a residential painting business.
It is being rebuilt in this Next.js + Supabase codebase to replace the spreadsheet-based system.

The core goals are:

- better visibility into calculations
- easier debugging
- cleaner handling of edge cases
- more flexible pricing and overrides
- real-time totals and tracking

## Design Priorities

- clear structure instead of hidden spreadsheet logic
- easy to audit calculations
- flexible overrides when needed
- support real-world edge cases
- separate inputs, derived values, overrides, and effective values
- plan structure before implementation

## Top-Level Structure

The top-level object is `Job`.

A `Job` can contain multiple `Estimate Versions`.
Each estimate version is a separate quote option, revision, split scope, or combined scope under the same job.
Multiple estimate versions can be active at the same time.

Examples:

- interior repaint
- exterior garage door
- combined option
- alternate scope options

## Core Relationship Model

### Planning-level structure

- Job
- Estimate Version
- Room
- Scope modules under each room or estimate version
- Global catalogs and pricing settings

### Relationship summary

- Job -> Estimate Versions: one-to-many
- Estimate Version -> Rooms: one-to-many
- Estimate Version -> Job Colors: one-to-many
- Estimate Version -> Prep Job Trips: one-to-many
- Estimate Version -> Access Charges: one-to-many
- Estimate Version -> Material Requirements: one-to-many
- Estimate Version -> Material Purchase Groups: one-to-many
- Room -> Room Wall Scopes: one-to-many
- Room Wall Scope -> Wall Segments: one-to-many when in `SEG`
- Room -> Ceiling Scopes: one-to-many
- Room -> Doors: one-to-many
- Room -> Trim Scopes: one-to-many
- Room -> Drywall Repairs: one-to-many

## Scope Structure

Each estimate version can include:

- rooms
- wall scope
- ceiling scope
- doors
- trim
- drywall repairs
- access/shared charges
- colors/material selections
- prep job trips

## Current Repo Mapping

The current repo already contains part of this model, even if naming is still evolving.

Current tables and concepts already visible in the repo:

- `jobs`
- `estimates`
- `estimate_jobsettings`
- `estimate_rooms`
- `estimate_segments`
- `estimate_job_colors`
- `estimate_room_flags`
- `estimate_access_fees`

Planning note:
The current `estimates` record effectively maps to the planned "Estimate Version" concept.
Future implementation can keep the current table name while using "Estimate Version" in product language if that stays the preferred UI term.

## Calculation Philosophy

The system should follow a consistent sequence:

1. collect user input
2. calculate derived values
3. apply overrides
4. determine final effective values
5. roll values up into room and estimate totals
6. apply estimate-level pricing policies
7. generate final outputs

This rule should apply across:

- walls
- ceilings
- doors
- trim
- drywall
- prep job trips
- access/shared charges

## Value Layers

Each major scope area should separate values into:

- User Input
- Derived Values
- Override Values
- Effective Values

This is a hard architecture rule.
Do not mix raw values and final values inside the same field without naming them clearly.

## Estimate-Level Pricing Policies

The system must support:

- estimate-level labor policy
- estimate-level minimum pricing
- overrides
- hidden internal adjustments

### Labor day policy

Applied at the estimate version level.

Rules:

- if labor is less than 1 day, bill 1 day
- if labor is 1 day or more, round up to the configured increment
- rounding is always upward
- enabled by default and editable in summary/settings

### Job minimum policy

Rules:

- if total is below the minimum, raise the total to the minimum
- do not show a separate line item to the customer
- store the adjustment internally
- allocate the adjustment across rooms proportionally

## UI Structure

The UI should be organized around an estimate version.

Primary navigation should include:

- Job Overview
- Estimate Versions
- Rooms / Scope
- Materials
- Summary

Design rules:

- always show key totals
- avoid hidden logic
- keep inputs close to where they are used
- use consistent layouts across scope types
- separate basic and advanced inputs
- make editing fast and intuitive

## Folder Strategy In This Repo

### Route-local V2 code

Use these folders for the new route-local estimator UI:

- `app/crm/estimates/[id]/v2/_components`
- `app/crm/estimates/[id]/v2/_lib`
- `app/crm/estimates/[id]/v2/_state`

### Shared estimator domain

Use:

- `lib/estimator`

For:

- calculators
- normalization helpers
- rollup logic
- pricing policy helpers
- serializers and reusable transforms

### Shared types

Use:

- `types/estimator`

For types shared across:

- route UI
- API handlers
- shared estimator logic

## Naming Conventions

### File naming

- route React components: `PascalCase.tsx`
- route helpers: `camelCase.ts`
- shared estimator domain files: `camelCase.ts`
- shared type files: short feature names such as `core.ts`, `walls.ts`, `materials.ts`, `pricing.ts`
- SQL migrations: numeric prefix plus concise snake_case description

Examples:

- `app/crm/estimates/[id]/v2/_components/RoomScopeShell.tsx`
- `app/crm/estimates/[id]/v2/_lib/normalizeRoomDraft.ts`
- `lib/estimator/calculateWallScope.ts`
- `types/estimator/walls.ts`
- `supabase/sql/040_estimator_v2_materials_tables.sql`

### Data naming

- database columns: `snake_case`
- React state: `camelCase`
- shared types: `PascalCase`

Rule:
Map deliberately between layers. Do not let mixed naming conventions become the source of confusion.

## Future-Ready Requirements

The architecture should leave room for:

- good / better / best pricing
- conditional rules engine
- alternate and split estimates
- dashboards and reporting
- more complex geometry
- customizable proposal text
- historical snapshot protection

## Important Edge Cases

The structure must not block:

- multiple live estimate versions under one job
- shared charges used across multiple rooms
- partial room work
- wall geometry beyond rectangles
- approximate opening deductions
- cut-in relief cases
- hidden internal pricing adjustments
- room-level allocation of estimate-level adjustments
- separate prep trips before main job
- manual pricing cases

## Open Decisions To Keep Visible

These are not implementation-ready decisions yet and should not be guessed in code:

- customer model structure
- ceiling scope detail level
- trim scope detail level
- door scope detail level
- drywall scope detail level
- prep job trip detail rules
- access charge allocation method
- material cost allocation method
- product/package structure
- future rules engine scope
- proposal output structure
- manual pricing mode scope
- historical snapshot strategy

## Implementation Rule

This document is a blueprint, not the final app behavior.
If a behavior is still listed as an open decision, keep it unresolved in code until explicitly chosen.
