import { describe, expect, it } from 'vitest'
import {
  decideRatesFlagsMutationReconciliation,
  findReconciledRatesRow,
  reconcileRatesFlagsPayload,
} from '../quoteRatesMutationReconciliation'
import type {
  RatesFlagsArchiveRequest,
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsCreateRequest,
  RatesFlagsPayload,
  RatesFlagsReactivateRequest,
  RatesFlagsRow,
  RatesFlagsUpdateRequest,
  ScopeDefaultMutationValues,
  ScopeDefaultRow,
} from '@/types/estimator/ratesFlags'

function scopeRow(id: string, overrides: Partial<ScopeDefaultRow> = {}): ScopeDefaultRow {
  return {
    id,
    display_name: `Scope ${id}`,
    default_wall_mode: 'RECT',
    top_cut_in_factor: '1',
    bot_cut_in_factor: '1',
    typical_height_ft: '8',
    include_walls: 'Y',
    include_ceilings: 'N',
    include_trim: 'N',
    include_doors: 'N',
    include_drywall: 'N',
    notes: `Notes ${id}`,
    active: true,
    ...overrides,
  }
}

function scopeValues(
  id: string,
  overrides: Partial<ScopeDefaultMutationValues> = {}
): ScopeDefaultMutationValues {
  return {
    id,
    display_name: `Scope ${id}`,
    default_wall_mode: 'RECT',
    top_cut_in_factor: '1',
    bot_cut_in_factor: '1',
    typical_height_ft: '8',
    include_walls: 'Y',
    include_ceilings: 'N',
    include_trim: 'N',
    include_doors: 'N',
    include_drywall: 'N',
    notes: `Notes ${id}`,
    active: 'Y',
    ...overrides,
  }
}

function ratesCategory(
  key: RatesFlagsCategoryKey,
  rows: RatesFlagsRow[] = []
): RatesFlagsCategory {
  return {
    key,
    tab: 'room_defaults',
    group: key === 'scope_defaults' ? 'scope_defaults' : 'condition_modifiers',
    label: key,
    table_title: key,
    description: key,
    columns: [],
    fields: [],
    rows,
  }
}

function payloadWith(categories: RatesFlagsCategory[]): RatesFlagsPayload {
  return {
    source: 'db',
    seeded: true,
    template_version: 1,
    categories,
  }
}

function createRequest(values: ScopeDefaultMutationValues): RatesFlagsCreateRequest<'scope_defaults'> {
  return {
    category: 'scope_defaults',
    action: 'create',
    values,
  }
}

function updateRequest(
  originalId: string,
  values: ScopeDefaultMutationValues
): RatesFlagsUpdateRequest<'scope_defaults'> {
  return {
    category: 'scope_defaults',
    action: 'update',
    original_id: originalId,
    values,
  }
}

function archiveRequest(rowId: string): RatesFlagsArchiveRequest<'scope_defaults'> {
  return {
    category: 'scope_defaults',
    action: 'archive',
    rowId,
  }
}

function reactivateRequest(rowId: string): RatesFlagsReactivateRequest<'scope_defaults'> {
  return {
    category: 'scope_defaults',
    action: 'reactivate',
    rowId,
  }
}

function rowsFor(payload: RatesFlagsPayload, key: RatesFlagsCategoryKey = 'scope_defaults') {
  const category = payload.categories.find((entry) => entry.key === key)
  expect(category).toBeDefined()
  return category?.rows ?? []
}

describe('reconcileRatesFlagsPayload', () => {
  describe('create', () => {
    it('prepends a row with a new id to the front', () => {
      const existing = scopeRow('EXISTING')
      const payload = payloadWith([ratesCategory('scope_defaults', [existing])])

      const result = reconcileRatesFlagsPayload(
        payload,
        createRequest(scopeValues('NEW', { display_name: 'New Scope', active: 'N' }))
      )

      expect(rowsFor(result)).toEqual([
        {
          ...scopeRow('NEW'),
          display_name: 'New Scope',
          notes: 'Notes NEW',
          active: false,
        },
        existing,
      ])
    })

    it('deduplicates a row when the same id already exists', () => {
      const existing = scopeRow('SAME', { display_name: 'Old Scope' })
      const payload = payloadWith([ratesCategory('scope_defaults', [scopeRow('FIRST'), existing])])

      const result = reconcileRatesFlagsPayload(
        payload,
        createRequest(scopeValues('SAME', { display_name: 'Fresh Scope' }))
      )

      expect(rowsFor(result).map((row) => row.id)).toEqual(['SAME', 'FIRST'])
      expect(rowsFor(result)[0]).toMatchObject({
        id: 'SAME',
        display_name: 'Fresh Scope',
        active: true,
      })
    })

    it('does not modify unrelated categories', () => {
      const targetCategory = ratesCategory('scope_defaults', [scopeRow('EXISTING')])
      const unrelatedCategory = ratesCategory('condition_modifiers', [scopeRow('OTHER')])
      const payload = payloadWith([targetCategory, unrelatedCategory])

      const result = reconcileRatesFlagsPayload(payload, createRequest(scopeValues('NEW')))

      expect(result.categories[0]).not.toBe(targetCategory)
      expect(result.categories[1]).toBe(unrelatedCategory)
      expect(rowsFor(result, 'condition_modifiers')).toEqual(unrelatedCategory.rows)
    })

    it('returns an unchanged payload shape when the category is not found', () => {
      const existingCategory = ratesCategory('condition_modifiers', [scopeRow('OTHER')])
      const payload = payloadWith([existingCategory])

      const result = reconcileRatesFlagsPayload(payload, createRequest(scopeValues('NEW')))

      expect(result).toEqual(payload)
      expect(result.categories[0]).toBe(existingCategory)
    })
  })

  describe('update (same id)', () => {
    it('replaces the row in place and preserves order when original_id equals nextRow.id', () => {
      const first = scopeRow('FIRST')
      const original = scopeRow('TARGET', { display_name: 'Old Target' })
      const last = scopeRow('LAST')
      const payload = payloadWith([ratesCategory('scope_defaults', [first, original, last])])

      const result = reconcileRatesFlagsPayload(
        payload,
        updateRequest('TARGET', scopeValues('TARGET', { display_name: 'Updated Target' }))
      )

      expect(rowsFor(result).map((row) => row.id)).toEqual(['FIRST', 'TARGET', 'LAST'])
      expect(rowsFor(result)[0]).toBe(first)
      expect(rowsFor(result)[1]).toMatchObject({
        id: 'TARGET',
        display_name: 'Updated Target',
      })
      expect(rowsFor(result)[2]).toBe(last)
    })
  })

  describe('update (id change)', () => {
    it('replaces the old row with the new row at the old position', () => {
      const payload = payloadWith([
        ratesCategory('scope_defaults', [scopeRow('FIRST'), scopeRow('OLD'), scopeRow('LAST')]),
      ])

      const result = reconcileRatesFlagsPayload(
        payload,
        updateRequest('OLD', scopeValues('NEW', { display_name: 'Renamed Scope' }))
      )

      expect(rowsFor(result).map((row) => row.id)).toEqual(['FIRST', 'NEW', 'LAST'])
      expect(rowsFor(result)[1]).toMatchObject({
        id: 'NEW',
        display_name: 'Renamed Scope',
      })
    })

    it('drops an existing duplicate with nextRow.id elsewhere in the list', () => {
      const payload = payloadWith([
        ratesCategory('scope_defaults', [
          scopeRow('FIRST'),
          scopeRow('OLD'),
          scopeRow('NEW', { display_name: 'Duplicate New' }),
          scopeRow('LAST'),
        ]),
      ])

      const result = reconcileRatesFlagsPayload(
        payload,
        updateRequest('OLD', scopeValues('NEW', { display_name: 'Canonical New' }))
      )

      expect(rowsFor(result).map((row) => row.id)).toEqual(['FIRST', 'NEW', 'LAST'])
      expect(rowsFor(result)[1]).toMatchObject({
        id: 'NEW',
        display_name: 'Canonical New',
      })
    })

    it('unshifts nextRow to the front when original_id is not found', () => {
      const payload = payloadWith([
        ratesCategory('scope_defaults', [scopeRow('FIRST'), scopeRow('LAST')]),
      ])

      const result = reconcileRatesFlagsPayload(
        payload,
        updateRequest('MISSING', scopeValues('NEW'))
      )

      expect(rowsFor(result).map((row) => row.id)).toEqual(['NEW', 'FIRST', 'LAST'])
    })
  })

  describe('archive', () => {
    it('flips the matching row to inactive and leaves other rows untouched', () => {
      const first = scopeRow('FIRST')
      const target = scopeRow('TARGET')
      const last = scopeRow('LAST', { active: false })
      const payload = payloadWith([ratesCategory('scope_defaults', [first, target, last])])

      const result = reconcileRatesFlagsPayload(payload, archiveRequest('TARGET'))

      expect(rowsFor(result)[0]).toBe(first)
      expect(rowsFor(result)[1]).toEqual({ ...target, active: false })
      expect(rowsFor(result)[2]).toBe(last)
    })
  })

  describe('reactivate', () => {
    it('flips the matching row to active', () => {
      const first = scopeRow('FIRST')
      const target = scopeRow('TARGET', { active: false })
      const payload = payloadWith([ratesCategory('scope_defaults', [first, target])])

      const result = reconcileRatesFlagsPayload(payload, reactivateRequest('TARGET'))

      expect(rowsFor(result)[0]).toBe(first)
      expect(rowsFor(result)[1]).toEqual({ ...target, active: true })
    })
  })
})

describe('findReconciledRatesRow', () => {
  it('returns a row when it is found', () => {
    const target = scopeRow('TARGET')
    const payload = payloadWith([ratesCategory('scope_defaults', [scopeRow('FIRST'), target])])

    expect(findReconciledRatesRow(payload, 'scope_defaults', 'TARGET')).toBe(target)
  })

  it('returns null when the row is not found', () => {
    const payload = payloadWith([ratesCategory('scope_defaults', [scopeRow('FIRST')])])

    expect(findReconciledRatesRow(payload, 'scope_defaults', 'MISSING')).toBeNull()
  })

  it('returns null when the category is not found', () => {
    const payload = payloadWith([ratesCategory('condition_modifiers', [scopeRow('FIRST')])])

    expect(findReconciledRatesRow(payload, 'scope_defaults', 'FIRST')).toBeNull()
  })
})

describe('decideRatesFlagsMutationReconciliation', () => {
  it('uses the verified server payload when refresh succeeds', () => {
    const currentPayload = payloadWith([ratesCategory('scope_defaults', [scopeRow('OLD')])])
    const serverPayload = payloadWith([ratesCategory('scope_defaults', [scopeRow('SERVER')])])

    const result = decideRatesFlagsMutationReconciliation({
      currentPayload,
      request: createRequest(scopeValues('LOCAL')),
      verification: {
        ok: true,
        data: serverPayload,
        error: null,
      },
    })

    expect(result).toEqual({
      kind: 'server_verified',
      payload: serverPayload,
      verificationError: null,
    })
  })

  it('falls back to a locally reconciled payload when refresh verification fails', () => {
    const currentPayload = payloadWith([ratesCategory('scope_defaults', [scopeRow('OLD')])])

    const result = decideRatesFlagsMutationReconciliation({
      currentPayload,
      request: createRequest(scopeValues('LOCAL')),
      verification: {
        ok: false,
        data: null,
        error: 'verification failed',
      },
    })

    expect(result.kind).toBe('local_fallback')
    expect(result.verificationError).toBe('verification failed')
    expect(rowsFor(result.payload).map((row) => row.id)).toEqual(['LOCAL', 'OLD'])
  })
})
