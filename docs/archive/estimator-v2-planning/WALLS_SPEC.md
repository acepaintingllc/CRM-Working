# Walls Module Spec

## Purpose

The walls module is the first core estimating module.
It is one of the most complex parts of the system and sets patterns that later modules should follow.

## Module Goal

The wall module should:

- support fast estimating for simple rooms
- support detailed segmented estimating
- support multiple wall scopes when needed
- support odd shapes and partial work
- support paint, primer, and supplies separately
- support labor modifiers and overrides

## Parent Structure

- Estimate Version
- Room
- Room Wall Scopes
- Wall Segments in `SEG` mode only

## Wall Scope Structure

### Scope rules

- `RECT` mode: only one wall scope per room
- `SEG` mode: multiple wall scopes are allowed per room
- each wall scope acts as its own mini-estimate unit

Use cases for multiple scopes:

- different colors in the same room
- different products
- partial repaint sections
- different prep conditions

### Wall modes

#### RECT mode

- simple room-level input
- no segments
- used for standard rooms

#### SEG mode

- uses wall segments
- segments are the source of truth
- supports partial work and complex layouts

## Wall Scope Inputs

### Core inputs

- mode: `RECT` or `SEG`
- include toggle
- paint yes/no
- prime mode
- wall color / product reference
- primer reference
- height input
- standard door count in `RECT`
- standard window count in `RECT`
- height factor
- complexity factor
- wall flag factor
- cut-in top modifier
- cut-in bottom modifier
- notes

### RECT mode inputs

- perimeter or wall length
- height
- door count
- window count
- optional area override

### SEG mode inputs

- segments drive area
- scope stores settings, modifiers, and overrides

## Wall Segments

### Segment inputs

- name
- include toggle
- shape type
- quantity
- dimensions based on shape
- door count
- window count
- manual area override
- notes

### Segment shapes

Initial support:

- Rectangle
- Triangle
- Manual Area

Future-ready support:

- angled stair walls
- knee walls
- trapezoid-like shapes
- other odd shapes

## Deductions

### Model

- standard door count
- standard window count

### Behavior

- `RECT` mode uses room-level counts
- `SEG` mode uses segment-level counts
- deductions are applied before effective area

### Rules

- allow over-estimation through count scaling when needed
- do not allow negative final area
- clamp or flag impossible deduction results

## Paint and Prime Logic

Paint and primer are separate.
Each should have its own labor and material path.

The wall module must support:

- paint labor
- paint materials
- primer labor
- primer materials
- prime modes that can expand later

Prime is not just a flag.
It is its own path through calculations and pricing.

## Labor Modifiers

The wall module should support:

- height factor
- complexity factor
- wall flag factor
- cut-in top modifier
- cut-in bottom modifier

Cut-in modifiers are for real-world relief cases such as:

- same wall and ceiling color making top cut easier
- no baseboard or easier bottom cut

## Supplies Logic

Wall scope contributes supplies separately from paint and primer.

### Supply types

#### Per-color supplies

Examples:

- brush
- roller cover
- tray/liner

Behavior:

- generated once per color group
- split across all scopes and rooms using that color

#### Area-based supplies

Examples:

- nail holes
- tape
- caulk
- minor prep materials

Behavior:

- based on effective area
- applied directly to the wall scope

#### Manual supplies

- optional manual additions
- assigned to scope or room

Rules:

- per-color supplies should not duplicate across rooms
- supplies must remain visible separately from labor and paint/primer

## Calculation Flow

1. determine mode
2. calculate raw area
3. apply deductions
4. determine effective area
5. calculate labor
6. apply labor overrides
7. calculate raw materials
8. apply material overrides
9. calculate supplies
10. calculate final totals

### Step details

#### 1. Mode

- `RECT` uses room inputs
- `SEG` uses segments

#### 2. Raw area

- `RECT`: calculated from room-level wall inputs
- `SEG`: sum of segments

#### 3. Deductions

- subtract door and window deductions

#### 4. Effective area

- use calculated area first
- use override area when provided
- store final effective area explicitly

#### 5. Labor

- calculate paint labor
- calculate primer labor
- apply modifiers

#### 6. Labor overrides

- override hours if present
- determine effective hours

#### 7. Materials

- calculate raw paint gallons
- calculate raw primer gallons

#### 8. Material overrides

- apply gallon overrides if present
- determine effective gallons

#### 9. Supplies

- calculate area-based supplies
- attach per-color supply references
- include manual supplies

#### 10. Final totals

- labor total
- material total
- supply total
- final wall scope total

## Value Pattern

Each wall scope should expose:

### Inputs

- dimensions
- counts
- modifiers
- selections

### Derived values

- raw area
- raw hours
- raw gallons

### Overrides

- area override
- hours override
- gallons override
- total override

### Effective values

- effective area
- effective hours
- effective gallons
- final total

## Rollups

- Segment -> Wall Scope
- Wall Scope -> Room
- Room -> Estimate Version

Walls should contribute:

- scope totals
- room totals
- estimate totals
- grouped material references
- shared supply allocations

## Edge Cases Covered

- multiple wall scopes per room in `SEG` mode
- partial wall work
- one wall only
- accent walls
- weird shapes
- large opening approximations
- easier cut-in conditions
- shared supplies across rooms
- manual area fallback
- include/exclude segments
- `SEG` with a single segment
- rooms with no wall scope
- negative area after deductions

## Open Decisions

- exact `RECT` input structure
- whether one wall scope can support multiple products immediately or later
- whether segment-level product or color overrides are first-pass or later
- how quickly to expand shape support beyond rectangle, triangle, and manual area
- whether manual pricing lives directly on the wall scope or through a separate pricing mode

## Design Rules

- one source of truth per mode
- keep `RECT` simple
- keep `SEG` flexible
- do not mix raw and effective values
- keep overrides visible
- do not block future multi-color and multi-product support
