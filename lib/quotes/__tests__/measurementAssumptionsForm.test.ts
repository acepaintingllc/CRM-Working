import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeQuoteMeasurementAssumptions,
  parseQuoteMeasurementAssumptions,
} from '../measurementAssumptionsForm.ts'

test('normalizeQuoteMeasurementAssumptions applies measurement defaults for missing values', () => {
  assert.deepEqual(normalizeQuoteMeasurementAssumptions(null), {
    standard_door_deduction_sf: 21,
    standard_window_deduction_sf: 15,
    baseboard_opening_deduction_lf: 3,
  })
})

test('parseQuoteMeasurementAssumptions accepts explicit nonnegative values', () => {
  assert.deepEqual(
    parseQuoteMeasurementAssumptions({
      standard_door_deduction_sf: '22',
      standard_window_deduction_sf: 16,
      baseboard_opening_deduction_lf: 3.5,
    }),
    {
      ok: true,
      data: {
        standard_door_deduction_sf: 22,
        standard_window_deduction_sf: 16,
        baseboard_opening_deduction_lf: 3.5,
      },
    }
  )
})

test('parseQuoteMeasurementAssumptions rejects negative deductions', () => {
  assert.deepEqual(
    parseQuoteMeasurementAssumptions({
      standard_door_deduction_sf: -1,
      standard_window_deduction_sf: 15,
      baseboard_opening_deduction_lf: 3,
    }),
    {
      ok: false,
      error: 'Measurement deductions cannot be negative.',
    }
  )
})
