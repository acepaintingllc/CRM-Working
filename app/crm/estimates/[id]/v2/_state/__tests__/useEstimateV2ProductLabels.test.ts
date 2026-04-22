import { describe, expect, it } from 'vitest'
import {
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
})
