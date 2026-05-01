# Estimator V2 Build Phases

## Phase 0

### Name

Project setup and planning files

### Goal

Prepare the repo so Codex has clean context and future work can happen safely in phases.

### Included

- create markdown planning files from planning content
- set up basic project structure
- define Supabase project conventions
- define app project structure for the new route
- define naming conventions
- define shared types folder if needed

### Deliverables

- `ARCHITECTURE.md`
- `BUILD_PHASES.md`
- `WALLS_SPEC.md`
- `MATERIALS_SUPPLIES_SPEC.md`
- `SUMMARY_PRICING_SPEC.md`
- route-local estimator folders
- shared estimator domain folder
- shared estimator types folder
- Supabase folder README and conventions

### Success Criteria

- Codex has readable planning docs in repo
- repo structure is ready
- project can be safely edited in phases

## Phase 1

### Name

Core estimate-version data model

### Goal

Lock the planning-level entity model into implementation-ready contracts without overbuilding.

### Scope

- decide exact mapping of `Job` and `Estimate Version` into current schema
- define shared core estimator types
- define parent-child IDs and natural keys
- define raw, override, and effective value patterns
- decide what must be persisted vs calculated on demand

### Exit Criteria

- core entities and relationships are explicit
- unresolved behaviors remain documented instead of guessed
- shared type boundaries are clear

## Phase 2

### Name

Walls module foundation

### Goal

Implement the first detailed estimating module and establish the core calculation pattern for the rest of the app.

### Scope

- room wall scope model
- `RECT` and `SEG` mode contracts
- wall segment model and shape handling
- deductions, modifiers, and overrides
- save/load flow for walls-first UI

### Exit Criteria

- walls can be entered and persisted in-app
- calculation flow for walls is traceable
- walls module sets the pattern for later scope modules

## Phase 3

### Name

Materials and supplies module

### Goal

Build grouped material and supply handling with visibility and allocation.

### Scope

- raw material requirements
- grouped purchase logic
- paint and primer separation
- per-color supplies
- area-based supplies
- manual supply rows
- allocation back to source rows

### Exit Criteria

- grouped material flow works end to end
- supply costs remain separate and visible
- room and estimate totals can consume material outputs cleanly

## Phase 4

### Name

Summary and pricing policies

### Goal

Apply estimate-level pricing logic after detailed scope and material calculations.

### Scope

- room rollups
- estimate version rollups
- labor day policy
- minimum job policy
- prep trip integration
- shared access charge integration
- advanced pricing controls and internal adjustment visibility

### Exit Criteria

- estimate totals are readable and traceable
- internal pricing adjustments are stored visibly
- summary controls do not hide underlying math

## Phase 5

### Name

Additional scope modules

### Goal

Extend the walls-first architecture to the remaining scope modules without changing the core calculation philosophy.

### Scope

- ceilings
- doors
- trim
- drywall repairs
- prep trip to drywall interactions where needed

### Exit Criteria

- each scope type follows the same input -> derived -> override -> effective pattern
- room totals roll up consistently across scope modules

## Phase 6

### Name

UX refinement and future hooks

### Goal

Stabilize the app and leave safe expansion points for later features.

### Scope

- faster editing workflow
- cleaner override UX
- proposal/output prep
- hooks for good/better/best packages
- hooks for conditional rules engine
- hooks for dashboards and reporting
- historical snapshot strategy implementation if chosen

### Exit Criteria

- the estimator is stable for real use
- future additions do not require structural rewrite

## Working Rule

For every phase:

- update the relevant spec file before or with implementation
- keep open decisions visible until resolved
- do not silently hardcode unresolved planning decisions
