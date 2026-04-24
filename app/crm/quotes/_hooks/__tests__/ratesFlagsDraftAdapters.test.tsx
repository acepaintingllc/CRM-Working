import { describe, expect, it } from 'vitest'
import {
  getRatesFlagsDraftAdapter,
  ratesFlagsEditableCategoryKeys,
} from '@/lib/quotes/ratesFlagsDraftAdapters'
import {
  buildClientRatesFlagsMutationRequests,
  getRatesFlagsParityCategoryKeys,
} from '@/lib/quotes/__tests__/ratesFlagsParityHelpers'
import type {
  RatesFlagsEditableCategory,
  ScopeDefaultDraft,
  SupplyRateDraft,
} from '@/types/estimator/ratesFlags'

const baseCategory: RatesFlagsEditableCategory<'scope_defaults'> = {
  key: 'scope_defaults',
  tab: 'room_defaults',
  group: 'scope_defaults',
  label: 'Scope Defaults',
  table_title: 'Scope Defaults',
  description: 'Defaults',
  columns: [],
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true },
    { key: 'display_name', label: 'Display Name', type: 'text', required: true },
    { key: 'typical_height_ft', label: 'Typical Height', type: 'number' },
    { key: 'default_wall_mode', label: 'Wall Mode', type: 'select', options: ['RECT', 'SEG'] },
    { key: 'include_walls', label: 'Include Walls', type: 'select', options: ['Y', 'N'] },
    { key: 'system_group', label: 'System Group', type: 'select', readOnly: true, options: ['template'] },
  ],
  rows: [],
}

describe('ratesFlagsDraftAdapters', () => {
  it('builds valid create, update, archive, and reactivate requests for every editable category', () => {
    expect(getRatesFlagsParityCategoryKeys()).toEqual(ratesFlagsEditableCategoryKeys)

    for (const categoryKey of ratesFlagsEditableCategoryKeys) {
      const adapter = getRatesFlagsDraftAdapter(categoryKey)
      const requests = buildClientRatesFlagsMutationRequests(categoryKey)

      expect(adapter.validateDraft(requests.category, requests.draft), categoryKey).toEqual({
        ok: true,
      })
      expect(requests.create, categoryKey).toMatchObject({
        category: categoryKey,
        action: 'create',
      })
      expect(requests.update, categoryKey).toMatchObject({
        category: categoryKey,
        action: 'update',
        original_id: requests.create.values.id,
      })
      expect(requests.update.values.active, categoryKey).toBe('N')
      expect(requests.archive, categoryKey).toEqual({
        category: categoryKey,
        action: 'archive',
        rowId: requests.create.values.id,
      })
      expect(requests.reactivate, categoryKey).toEqual({
        category: categoryKey,
        action: 'reactivate',
        rowId: requests.create.values.id,
      })
    }
  })

  it('converts rows into typed drafts and formats values for the UI', () => {
    const adapter = getRatesFlagsDraftAdapter(baseCategory.key)
    const draft = adapter.rowToDraft(baseCategory, {
      id: 'ROOM_A',
      display_name: 'Room A',
      notes: '',
      active: true,
      default_wall_mode: 'SEG',
      top_cut_in_factor: '1',
      bot_cut_in_factor: '1',
      typical_height_ft: '9.5',
      include_walls: 'Y',
      include_ceilings: 'N',
      include_trim: 'N',
      include_doors: 'N',
      include_drywall: 'N',
      system_group: 'template',
    } as never) as ScopeDefaultDraft

    expect(draft.id).toBe('ROOM_A')
    expect(draft.typical_height_ft).toBe(9.5)
    expect(draft.default_wall_mode).toBe('SEG')
    expect(draft.include_walls).toBe(true)
    expect(adapter.formatDraftValue(baseCategory, draft, 'include_walls')).toBe('Y')
    expect(adapter.formatDraftValue(baseCategory, draft, 'typical_height_ft')).toBe('9.5')
  })

  it('builds empty drafts with category defaults and typed blanks', () => {
    const category = {
      ...baseCategory,
      key: 'supply_rates_area_based',
      tab: 'rates',
      group: 'supply_rates',
      fields: [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'unit', label: 'Unit', type: 'select', options: ['$/sqft'] },
        { key: 'cost_per', label: 'Cost Per', type: 'number' },
      ],
    } as RatesFlagsEditableCategory<'supply_rates_area_based'>
    const draft = getRatesFlagsDraftAdapter(category.key).createEmptyDraft(category) as SupplyRateDraft

    expect(draft.id).toBe('')
    expect(draft.unit).toBe('$/sqft')
    expect(draft.cost_per).toBeNull()
  })

  it('updates typed fields, rejects read-only edits, and validates required/select rules', () => {
    const adapter = getRatesFlagsDraftAdapter(baseCategory.key)
    const empty = adapter.createEmptyDraft(baseCategory) as ScopeDefaultDraft & { system_group?: string }
    const next = adapter.updateDraftField(baseCategory, empty, 'typical_height_ft', '10.25') as ScopeDefaultDraft & {
      system_group?: string
    }
    const withSelect = adapter.updateDraftField(baseCategory, next, 'default_wall_mode', 'SEG') as ScopeDefaultDraft & {
      system_group?: string
    }
    const withBoolean = adapter.updateDraftField(baseCategory, withSelect, 'include_walls', 'N') as ScopeDefaultDraft & {
      system_group?: string
    }
    const readOnlyAttempt = adapter.updateDraftField(baseCategory, withBoolean, 'system_group', 'other') as ScopeDefaultDraft & {
      system_group?: string
    }

    expect(withBoolean.typical_height_ft).toBe(10.25)
    expect(withBoolean.default_wall_mode).toBe('SEG')
    expect(withBoolean.include_walls).toBe(false)
    expect(readOnlyAttempt.system_group).toBe('template')

    const invalidSelect = adapter.validateDraft(baseCategory, {
      ...withBoolean,
      id: 'ROOM_A',
      display_name: 'Room A',
      default_wall_mode: 'INVALID',
    })
    expect(invalidSelect).toEqual({
      ok: false,
      error: 'Wall Mode must be one of: RECT, SEG.',
      fieldKey: 'default_wall_mode',
    })

    const missingRequired = adapter.validateDraft(baseCategory, {
      ...withBoolean,
      id: '',
      display_name: '',
    })
    expect(missingRequired).toEqual({
      ok: false,
      error: 'ID is required.',
      fieldKey: 'id',
    })
  })

  it('builds category-specific mutation requests from drafts', () => {
    const adapter = getRatesFlagsDraftAdapter(baseCategory.key)
    const request = adapter.toMutationRequest({
      action: 'update',
      draft: {
        id: 'ROOM_A',
        display_name: 'Room A',
        typical_height_ft: 8.5,
        default_wall_mode: 'RECT',
        include_walls: true,
        include_ceilings: false,
        include_trim: false,
        include_doors: false,
        include_drywall: false,
        top_cut_in_factor: 1.1,
        bot_cut_in_factor: 1,
        notes: '',
      },
      draftActive: false,
      originalId: 'ROOM_A',
    })

    expect(request).toEqual({
      category: 'scope_defaults',
      action: 'update',
      original_id: 'ROOM_A',
      values: {
        id: 'ROOM_A',
        display_name: 'Room A',
        default_wall_mode: 'RECT',
        top_cut_in_factor: '1.1',
        bot_cut_in_factor: '1',
        typical_height_ft: '8.5',
        include_walls: 'Y',
        include_ceilings: 'N',
        include_trim: 'N',
        include_doors: 'N',
        include_drywall: 'N',
        notes: '',
        active: 'N',
      },
    })
  })

  it('builds explicit discriminator values and archive requests for non-default categories', () => {
    const category = {
      ...baseCategory,
      key: 'access_fees_scaffolding',
      tab: 'rates',
      group: 'access_fees',
      fields: [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'display_name', label: 'Display Name', type: 'text', required: true },
        { key: 'fee_type', label: 'Fee Type', type: 'select', options: ['Labor', 'Other'] },
        { key: 'amount', label: 'Amount', type: 'number', required: true },
        { key: 'unit', label: 'Unit', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
    } as RatesFlagsEditableCategory<'access_fees_scaffolding'>
    const adapter = getRatesFlagsDraftAdapter(category.key)
    const accessRequest = adapter.toMutationRequest({
      action: 'create',
      draft: {
        id: 'ROLLING_SCAFFOLD',
        display_name: 'Rolling Scaffold',
        fee_type: 'Labor',
        amount: 250,
        unit: 'each',
        notes: '',
      } as never,
      draftActive: true,
    })

    expect(accessRequest).toEqual({
      category: 'access_fees_scaffolding',
      action: 'create',
      values: {
        access_group: 'scaffolding',
        id: 'ROLLING_SCAFFOLD',
        display_name: 'Rolling Scaffold',
        fee_type: 'Labor',
        amount: '250',
        unit: 'each',
        notes: '',
        active: 'Y',
      },
    })

    expect(
      adapter.toArchiveRequest({
        action: 'reactivate',
        rowId: 'ROLLING_SCAFFOLD',
      })
    ).toEqual({
      category: 'access_fees_scaffolding',
      action: 'reactivate',
      rowId: 'ROLLING_SCAFFOLD',
    })
  })

  it('normalizes number parsing edge cases', () => {
    const adapter = getRatesFlagsDraftAdapter(baseCategory.key)
    const empty = adapter.createEmptyDraft(baseCategory) as ScopeDefaultDraft
    const blank = adapter.updateDraftField(baseCategory, empty, 'typical_height_ft', ' ') as ScopeDefaultDraft
    const currency = adapter.updateDraftField(baseCategory, blank, 'typical_height_ft', '$1,250.50') as ScopeDefaultDraft
    const invalid = adapter.updateDraftField(baseCategory, currency, 'typical_height_ft', 'abc') as ScopeDefaultDraft

    expect(blank.typical_height_ft).toBeNull()
    expect(currency.typical_height_ft).toBe(1250.5)
    expect(invalid.typical_height_ft).toBeNull()
  })
})
