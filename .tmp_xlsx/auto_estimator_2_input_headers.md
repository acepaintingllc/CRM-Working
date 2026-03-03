# Workbook input tab headers

Source: .tmp_xlsx\auto_estimator_2_headers.json

## INPUT_Doors

- Header row: 3
- Columns: 7

| # | Header | Notes |
|---:|---|---|
| 1 | JobID |  |
| 2 | RoomID |  |
| 3 | DoorType |  |
| 4 | Qty |  |
| 5 | Sides (0.5/1) |  |
| 6 | PrepMins_side (calc) |  |
| 7 | PaintMins_coat_side (calc) |  |

## INPUT_JobSettings

- Header row: 5
- Columns: 16

| # | Header | Notes |
|---:|---|---|
| 1 | JobID |  |
| 2 | WallsPaintProductID |  |
| 3 | CeilingPaintProductID |  |
| 4 | TrimPaintProductID |  |
| 5 | PrimerProductID |  |
| 6 | LaborRateOverride_perHr |  |
| 7 | MarkupOverride_multiplier |  |
| 8 | RoundingIncrement_hours |  |
| 9 | WorkdayHours |  |
| 10 | Notes |  |
| 11 | WallsPaint_gal_override |  |
| 12 | CeilingPaint_gal_override |  |
| 13 | Primer_gal_override |  |
| 14 | ExtraSupplies_Walls$ |  |
| 15 | ExtraSupplies_Ceilings$ |  |
| 16 | ExtraSupplies_Trim$ |  |

## INPUT_Openings

- Header row: 3
- Columns: 6

| # | Header | Notes |
|---:|---|---|
| 1 | JobID |  |
| 2 | RoomID |  |
| 3 | OpeningType |  |
| 4 | Qty |  |
| 5 | Category (calc) |  |
| 6 | CutInMins_each (calc) |  |

## INPUT_PreJobTrips

- Header row: 3
- Columns: 10

| # | Header | Notes |
|---:|---|---|
| 1 | JobID |  |
| 2 | Category (Walls/Trim/Ceiling/Other) |  |
| 3 | Trip Name |  |
| 4 | Qty |  |
| 5 | Hours_each |  |
| 6 | LaborRate |  |
| 7 | Markup |  |
| 8 | Total (calc) |  |
| 9 | Notes |  |
| 10 | Active? |  |

## INPUT_Rollers

- Header row: 3
- Columns: 7

| # | Header | Notes |
|---:|---|---|
| 1 | JobID |  |
| 2 | Scope |  |
| 3 | ColorID |  |
| 4 | RollerSize |  |
| 5 | Quantity |  |
| 6 | Notes |  |
| 7 | Active? |  |

## INPUT_Rooms

- Header row: 3
- Columns: 35

| # | Header | Notes |
|---:|---|---|
| 1 | JobID |  |
| 2 | RoomID |  |
| 3 | Room Name |  |
| 4 | Mode (RECT/SEG) |  |
| 5 | Length_in (RECT) |  |
| 6 | Width_in (RECT) |  |
| 7 | WallHeight_in |  |
| 8 | CeilingHeight_in |  |
| 9 | CeilingSqft_override (SEG optional) |  |
| 10 | BaseExclude_in (RECT) |  |
| 11 | Walls Include |  |
| 12 | Walls Primer |  |
| 13 | Walls Topcoats |  |
| 14 | Walls Prep Override |  |
| 15 | Ceiling Include |  |
| 16 | Ceiling Primer |  |
| 17 | Ceiling Topcoats |  |
| 18 | Ceiling Prep Override |  |
| 19 | Ceiling Height Surcharge $ |  |
| 20 | Trim Include |  |
| 21 | Trim Primer |  |
| 22 | Trim Topcoats |  |
| 23 | Trim Prep Override |  |
| 24 | Paint Base? |  |
| 25 | Paint Crown? |  |
| 26 | Paint Window Casing? |  |
| 27 | Paint Door Casing? |  |
| 28 | Paint Doors? |  |
| 29 | Perimeter_in (calc) |  |
| 30 | WallSqft (calc) |  |
| 31 | CeilingSqft (calc) |  |
| 32 | Base_LF (calc) |  |
| 33 | Crown_LF (calc) |  |
| 34 | WallColorID (A/B/C...) |  |
| 35 | CeilingTypeID |  |

## INPUT_Segments

- Header row: 3
- Columns: 9

| # | Header | Notes |
|---:|---|---|
| 1 | JobID |  |
| 2 | RoomID |  |
| 3 | Seg# |  |
| 4 | SegLen_in |  |
| 5 | BaseExclude_in |  |
| 6 | Notes |  |
| 7 | WallLabel (optional) |  |
| 8 | WallColorOverrideID (optional) |  |
| 9 | Active? |  |

## INPUT_TrimLines

- Header row: 5
- Columns: 9

| # | Header | Notes |
|---:|---|---|
| 1 | JobID |  |
| 2 | RoomID |  |
| 3 | TrimItemID |  |
| 4 | Quantity |  |
| 5 | PrimerMode |  |
| 6 | Coats |  |
| 7 | PrepLevelOverride |  |
| 8 | AutoCalc |  |
| 9 | Notes |  |

