import { describe, expect, it } from 'vitest'
import {
  buildMissingProductConfigurationWarning,
  resolveDefaultProductLabel,
  resolveScopeProductStateLabel,
} from '../useEstimateV2ProductLabels'

describe('useEstimateV2ProductLabels helpers', () => {
  it('resolves defaults and preserves explicit scope overrides', () => {
    const labelForId = (value: string) =>
      ({
        wall: 'Wall Satin',
        primer: 'Wall Primer',
      })[value] ?? value

    expect(resolveDefaultProductLabel('', labelForId, 'No Default')).toBe('No Default')
    expect(resolveDefaultProductLabel('wall', labelForId, 'No Default')).toBe('Wall Satin')
    expect(
      resolveScopeProductStateLabel({
        productId: '',
        defaultProductId: 'wall',
        labelForId,
      })
    ).toBe('Wall Satin')
    expect(
      resolveScopeProductStateLabel({
        productId: 'primer',
        defaultProductId: 'wall',
        labelForId,
      })
    ).toBe('Wall Primer')
  })

  it('builds a targeted warning when required defaults are missing', () => {
    expect(
      buildMissingProductConfigurationWarning(
        {
          wallPaintProductId: 'wall-paint',
          wallPrimerProductId: '',
          ceilingPaintProductId: null,
          ceilingPrimerProductId: 'ceiling-primer',
          trimPaintProductId: '',
          trimPrimerProductId: 'trim-primer',
        },
        'Open Paint Defaults to fix the missing defaults.'
      )
    ).toEqual({
      title: 'Required paint defaults are missing',
      detail:
        'Missing walls default primer, ceilings default paint, and trim default paint. Pricing and send readiness stay blocked until every required paint and primer default is set.',
      fixHint: 'Open Paint Defaults to fix the missing defaults.',
      missingLabels: [
        'walls default primer',
        'ceilings default paint',
        'trim default paint',
      ],
    })
  })
})
