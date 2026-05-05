import { describe, expect, it } from 'vitest'
import {
  buildCalculationState,
  buildHeaderSubtitle,
  buildIncludedScopeLabels,
  buildRoomFlagChipVms,
  buildRoomFlagModifierHint,
  buildRoomSubtitle,
  buildRunningTotalLabel,
  buildScopeToggleLabels,
  buildSectionSummaryChips,
  buildValidationState,
} from '../estimateV2EditorPresentation'

describe('estimateV2EditorPresentation', () => {
  it('builds included scope labels and toggle labels', () => {
    expect(
      buildIncludedScopeLabels({
        wallsIncluded: true,
        ceilingsIncluded: false,
        trimsIncluded: true,
      })
    ).toBe('Walls, Trim')

    expect(
      buildScopeToggleLabels({
        wallsIncluded: true,
        ceilingsIncluded: false,
        trimsIncluded: true,
      })
    ).toEqual({
      walls: 'Walls included',
      ceilings: 'Ceilings excluded',
      trim: 'Trim included',
      doors: 'Doors excluded',
    })
  })

  it('returns fallback labels for empty states', () => {
    expect(
      buildIncludedScopeLabels({
        wallsIncluded: false,
        ceilingsIncluded: false,
        trimsIncluded: false,
      })
    ).toBe('No scopes included')

    expect(buildHeaderSubtitle(null)).toBe('')
    expect(buildRunningTotalLabel(2)).toBe('Active scope totals - 2 rooms')
  })

  it('builds display state text and colors', () => {
    expect(buildValidationState(0)).toEqual({
      text: 'No open issues',
      color: 'var(--v2-ink-2)',
    })
    expect(buildValidationState(3)).toEqual({
      text: '3 issue(s)',
      color: '#f9e2b7',
    })

    expect(buildCalculationState(false)).toEqual({
      text: 'Saved server values',
      color: 'var(--v2-ink-2)',
    })
    expect(buildCalculationState(true)).toEqual({
      text: 'Live preview (not saved)',
      color: '#f9e2b7',
    })
  })

  it('builds room subtitles and section summary chips', () => {
    expect(buildRoomSubtitle('Living Room', 'Walls, Ceilings')).toBe(
      'Living Room - Walls, Ceilings'
    )

    expect(
      buildSectionSummaryChips({
        modeLabel: 'SEG',
        itemCount: 2,
        primaryValue: '364',
        primaryUnit: 'Sq Ft',
        paintLabel: 'Wall Paint',
        primerLabel: 'Wall Primer',
        secondaryValue: '$180.00',
        secondaryLabel: 'Subtotal',
        validationIssueCount: 1,
      })
    ).toEqual([
      { label: 'Mode: SEG' },
      { label: 'Items: 2' },
      { label: 'Sq Ft: 364' },
      { label: 'Paint: Wall Paint' },
      { label: 'Primer: Wall Primer' },
      { label: 'Subtotal: $180.00' },
      { label: '1 issue(s)', tone: 'warning' },
    ])
  })

  it('omits primer summary chips when primer is inactive', () => {
    expect(
      buildSectionSummaryChips({
        modeLabel: 'RECT',
        primaryValue: '144',
        primaryUnit: 'Sq Ft',
        paintLabel: 'Ceiling Paint',
        primerLabel: 'Ceiling Primer',
        showPrimer: false,
      })
    ).toEqual([
      { label: 'Mode: RECT' },
      { label: 'Sq Ft: 144' },
      { label: 'Paint: Ceiling Paint' },
    ])
  })

  it('builds wall-only room flag modifier hints from canonical factors', () => {
    expect(
      buildRoomFlagModifierHint({
        id: 'wall-flag',
        label: 'Difficult x1.4',
        wall_factor: 1.2,
        ceil_factor: 1,
        trim_factor: 1,
      })
    ).toBe('Walls x1.2')
  })

  it('builds ceiling-only room flag modifier hints from canonical factors', () => {
    expect(
      buildRoomFlagModifierHint({
        id: 'ceiling-flag',
        label: 'Walls x1.2',
        wall_factor: 1,
        ceil_factor: 1.15,
        trim_factor: 1,
      })
    ).toBe('Ceilings x1.15')
  })

  it('builds trim-only room flag modifier hints from canonical factors', () => {
    expect(
      buildRoomFlagModifierHint({
        id: 'trim-flag',
        label: 'Fine trim',
        wall_factor: 1,
        ceil_factor: null,
        trim_factor: 1.1,
      })
    ).toBe('Trim x1.1')
  })

  it('builds multi-factor room flag modifier hints from canonical factors', () => {
    expect(
      buildRoomFlagModifierHint({
        id: 'multi-flag',
        label: 'High complexity',
        wall_factor: 1.2,
        ceil_factor: 1.15,
        trim_factor: 1.1,
      })
    ).toBe('Walls x1.2, Ceilings x1.15, Trim x1.1')
  })

  it('omits no-factor room flag modifier hints unless the label has a fallback multiplier', () => {
    expect(
      buildRoomFlagModifierHint({
        id: 'no-factor',
        label: 'Standard condition',
        wall_factor: null,
        ceil_factor: 1,
        trim_factor: 0,
      })
    ).toBeNull()

    expect(
      buildRoomFlagModifierHint({
        id: 'fallback-factor',
        label: 'Legacy walls x1.3',
        wall_factor: null,
        ceil_factor: null,
        trim_factor: null,
      })
    ).toBe('walls x1.3')
  })

  it('builds room flag chip state from selected flags and canonical modifier hints', () => {
    expect(
      buildRoomFlagChipVms({
        roomId: 'R001',
        selectedFlags: [
          { id: 'selected-1', roomId: 'R001', flagId: 'wall-flag', position: 0 },
          { id: 'selected-2', roomId: 'R002', flagId: 'trim-flag', position: 0 },
        ],
        flags: [
          {
            id: 'wall-flag',
            label: 'Wall prep',
            wall_factor: 1.2,
            ceil_factor: 1,
            trim_factor: 1,
          },
          {
            id: 'trim-flag',
            label: 'Trim detail',
            wall_factor: 1,
            ceil_factor: 1,
            trim_factor: 1.1,
          },
        ],
      })
    ).toEqual([
      {
        id: 'wall-flag',
        label: 'Wall prep',
        active: true,
        modifierHint: 'Walls x1.2',
      },
      {
        id: 'trim-flag',
        label: 'Trim detail',
        active: false,
        modifierHint: 'Trim x1.1',
      },
    ])
  })
})
