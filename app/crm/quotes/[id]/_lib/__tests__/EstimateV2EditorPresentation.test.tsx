import { describe, expect, it } from 'vitest'
import {
  buildCalculationState,
  buildHeaderSubtitle,
  buildIncludedScopeLabels,
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
    expect(buildRunningTotalLabel(2)).toBe('Running total - 2 rooms - active scopes')
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
})
