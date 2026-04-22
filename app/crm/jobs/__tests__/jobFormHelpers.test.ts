import { describe, expect, it } from 'vitest'
import {
  normalizeJobCreateValues,
  validateJobCreateValues,
} from '@/lib/jobs/forms'

describe('job form helpers', () => {
  it('rejects invalid quote date values during normalization validation', () => {
    const values = normalizeJobCreateValues({
      customerId: 'customer-1',
      title: 'Exterior repaint',
      estimateDateLocal: 'invalid',
    })

    const result = validateJobCreateValues(values)

    expect(result).toEqual({
      ok: false,
      error: 'Quote date/time is invalid',
    })
  })
})
