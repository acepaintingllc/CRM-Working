import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRollerApplicatorQuantity } from '../rollerQuantities.ts'

test('roller and applicator quantity normalization defines whole-number positive quantity rules', () => {
  const cases = [
    [null, false, '', null, null, 'empty'],
    [undefined, false, '', null, null, 'empty'],
    ['', false, '', null, null, 'empty'],
    ['   ', false, '', null, null, 'empty'],
    ['0', false, '0', null, null, 'not-positive'],
    ['-1', false, '-1', null, null, 'not-positive'],
    ['-2', false, '-2', null, null, 'not-positive'],
    ['1.5', false, '1.5', null, null, 'not-integer'],
    ['abc', false, 'abc', null, null, 'not-number'],
    ['1a', false, '1a', null, null, 'not-number'],
    ['2', true, '2', '2', 2, null],
    [' 3 ', true, '3', '3', 3, null],
    [4, true, '4', '4', 4, null],
  ] as const

  for (const [input, ok, displayValue, persistenceValue, numberValue, reason] of cases) {
    assert.deepEqual(
      {
        ok: normalizeRollerApplicatorQuantity(input).ok,
        displayValue: normalizeRollerApplicatorQuantity(input).displayValue,
        persistenceValue: normalizeRollerApplicatorQuantity(input).persistenceValue,
        numberValue: normalizeRollerApplicatorQuantity(input).numberValue,
        reason: normalizeRollerApplicatorQuantity(input).reason,
      },
      {
        ok,
        displayValue,
        persistenceValue,
        numberValue,
        reason,
      },
      `normalizes ${JSON.stringify(input)}`
    )
  }
})
