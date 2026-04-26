import { describe, expect, it } from 'vitest'
import {
  getRatesFlagsDraftAdapter,
  ratesFlagsEditableCategoryKeys,
} from '@/lib/quotes/ratesFlagsDraftAdapters'
import {
  buildClientRatesFlagsMutationRequests,
  getRatesFlagsParityCategoryKeys,
} from '@/lib/quotes/__tests__/ratesFlagsParityHelpers'
import {
  ratesFlagsEditableCategoryKeys as sharedRatesFlagsEditableCategoryKeys,
  type RatesFlagsEditableCategory,
  type HeightFactorDraft,
  type ScopeDefaultDraft,
  type SupplyRateDraft,
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
  it('keeps adapter coverage locked to the shared editable category contract', () => {
    expect(ratesFlagsEditableCategoryKeys).toEqual(sharedRatesFlagsEditableCategoryKeys)

    for (const categoryKey of sharedRatesFlagsEditableCategoryKeys) {
      const adapter = getRatesFlagsDraftAdapter(categoryKey)

      expect(adapter.key, categoryKey).toBe(categoryKey)
      expect(adapter.createEmptyDraft, categoryKey).toEqual(expect.any(Function))
      expect(adapter.rowToDraft, categoryKey).toEqual(expect.any(Function))
      expect(adapter.updateDraftField, categoryKey).toEqual(expect.any(Function))
      expect(adapter.validateDraft, categoryKey).toEqual(expect.any(Function))
      expect(adapter.toMutationRequest, categoryKey).toEqual(expect.any(Function))
      expect(adapter.toArchiveRequest, categoryKey).toEqual(expect.any(Function))
      expect(adapter.formatDraftValue, categoryKey).toEqual(expect.any(Function))
      expect(adapter.withDuplicateId, categoryKey).toEqual(expect.any(Function))
    }
  })

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

  it('round-trips crew_multiplier on supply rate drafts', () => {
    const category = {
      ...baseCategory,
      key: 'supply_rates_per_color',
      tab: 'rates',
      group: 'supply_rates',
      fields: [
        { key: 'supply_group', label: 'Supply Group', type: 'select', readOnly: true, options: ['per_color'], writeDefault: 'per_color' },
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'display_name', label: 'Name', type: 'text', required: true },
        { key: 'scope', label: 'Scope', type: 'text' },
        { key: 'unit', label: 'Unit', type: 'text' },
        { key: 'cost_per', label: 'Cost Per', type: 'number' },
        { key: 'crew_multiplier', label: 'Crew Multiplier', type: 'select', options: ['Y', 'N'], writeDefault: 'N' },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
    } as RatesFlagsEditableCategory<'supply_rates_per_color'>
    const adapter = getRatesFlagsDraftAdapter(category.key)
    const draft = adapter.rowToDraft(category, {
      id: 'BRUSH_TRIM',
      display_name: 'Brush',
      supply_group: 'per_color',
      scope: 'Trim',
      unit: 'each',
      cost_per: '5',
      crew_multiplier: 'Y',
      size_in: '',
      price_each: '',
      notes: '',
      active: true,
    })

    expect(adapter.formatDraftValue(category, draft, 'crew_multiplier')).toBe('Y')
    expect(adapter.toMutationRequest({
      action: 'update',
      category,
      draft,
      draftActive: true,
      originalId: 'BRUSH_TRIM',
    }).values.crew_multiplier).toBe('Y')
  })

  it('keeps invalid optional numeric input in the draft until validation reports it', () => {
    const adapter = getRatesFlagsDraftAdapter(baseCategory.key)
    const empty = {
      ...adapter.createEmptyDraft(baseCategory),
      id: 'ROOM_A',
      display_name: 'Room A',
    } as ScopeDefaultDraft
    const invalid = adapter.updateDraftField(
      baseCategory,
      empty,
      'typical_height_ft',
      'abc'
    ) as ScopeDefaultDraft

    expect(invalid.typical_height_ft).toBe('abc')
    expect(adapter.formatDraftValue(baseCategory, invalid, 'typical_height_ft')).toBe('abc')
    expect(adapter.validateDraft(baseCategory, invalid)).toEqual({
      ok: false,
      error: 'Typical Height must be a valid number.',
      fieldKey: 'typical_height_ft',
    })
  })

  it('keeps invalid required numeric input in the draft instead of treating it as blank', () => {
    const category = {
      ...baseCategory,
      fields: [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'display_name', label: 'Display Name', type: 'text', required: true },
        { key: 'typical_height_ft', label: 'Typical Height', type: 'number', required: true },
      ],
    } as RatesFlagsEditableCategory<'scope_defaults'>
    const adapter = getRatesFlagsDraftAdapter(category.key)
    const draft = adapter.updateDraftField(
      category,
      {
        ...adapter.createEmptyDraft(category),
        id: 'ROOM_A',
        display_name: 'Room A',
      },
      'typical_height_ft',
      'abc'
    ) as ScopeDefaultDraft

    expect(draft.typical_height_ft).toBe('abc')
    expect(adapter.validateDraft(category, draft)).toEqual({
      ok: false,
      error: 'Typical Height must be a valid number.',
      fieldKey: 'typical_height_ft',
    })

    const blank = adapter.updateDraftField(category, draft, 'typical_height_ft', ' ') as ScopeDefaultDraft
    expect(blank.typical_height_ft).toBeNull()
    expect(adapter.validateDraft(category, blank)).toEqual({
      ok: false,
      error: 'Typical Height is required.',
      fieldKey: 'typical_height_ft',
    })
  })

  it('keeps invalid Y/N and select input distinguishable from blank input', () => {
    const adapter = getRatesFlagsDraftAdapter(baseCategory.key)
    const empty = {
      ...adapter.createEmptyDraft(baseCategory),
      id: 'ROOM_A',
      display_name: 'Room A',
    } as ScopeDefaultDraft
    const invalidYn = adapter.updateDraftField(
      baseCategory,
      empty,
      'include_walls',
      'maybe'
    ) as ScopeDefaultDraft
    const invalidSelect = adapter.updateDraftField(
      baseCategory,
      empty,
      'default_wall_mode',
      'TRIANGLE'
    ) as ScopeDefaultDraft

    expect(invalidYn.include_walls).toBe('maybe')
    expect(adapter.formatDraftValue(baseCategory, invalidYn, 'include_walls')).toBe('maybe')
    expect(adapter.validateDraft(baseCategory, invalidYn)).toEqual({
      ok: false,
      error: 'Include Walls must be Y or N.',
      fieldKey: 'include_walls',
    })

    expect(invalidSelect.default_wall_mode).toBe('TRIANGLE')
    expect(adapter.validateDraft(baseCategory, invalidSelect)).toEqual({
      ok: false,
      error: 'Wall Mode must be one of: RECT, SEG.',
      fieldKey: 'default_wall_mode',
    })

    const blankSelect = adapter.updateDraftField(
      baseCategory,
      invalidSelect,
      'default_wall_mode',
      ''
    ) as ScopeDefaultDraft
    expect(blankSelect.default_wall_mode).toBe('')
    expect(adapter.validateDraft(baseCategory, blankSelect)).toEqual({ ok: true })
  })

  it('validates read-only literal fields when a loaded draft contains an invalid value', () => {
    const adapter = getRatesFlagsDraftAdapter(baseCategory.key)
    const draft = {
      ...adapter.createEmptyDraft(baseCategory),
      id: 'ROOM_A',
      display_name: 'Room A',
      system_group: 'other',
    } as ScopeDefaultDraft & { system_group: string }

    expect(adapter.validateDraft(baseCategory, draft)).toEqual({
      ok: false,
      error: "System Group must be 'template'.",
      fieldKey: 'system_group',
    })
  })

  it('rejects category-specific negative numeric values', () => {
    const category = {
      ...baseCategory,
      key: 'access_fees_ladders',
      tab: 'rates',
      group: 'access_fees',
      fields: [
        { key: 'access_group', label: 'Access Group', type: 'select', readOnly: true, options: ['ladders'], writeDefault: 'ladders' },
        { key: 'id', label: 'Fee ID', type: 'text', required: true },
        { key: 'display_name', label: 'Name', type: 'text', required: true },
        { key: 'amount', label: 'Amount', type: 'number', required: true },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
    } as RatesFlagsEditableCategory<'access_fees_ladders'>
    const adapter = getRatesFlagsDraftAdapter(category.key)

    expect(
      adapter.validateDraft(category, {
        ...adapter.createEmptyDraft(category),
        id: 'LADDER',
        display_name: 'Ladder',
        amount: -1,
      })
    ).toEqual({
      ok: false,
      error: 'Amount must not be negative.',
      fieldKey: 'amount',
    })
  })

  it('rejects height factors where min height is greater than max height', () => {
    const category = {
      ...baseCategory,
      key: 'height_factors',
      tab: 'flags',
      group: 'height_factors',
      fields: [
        { key: 'id', label: 'Height Band ID', type: 'text', required: true },
        { key: 'display_name', label: 'Display Name', type: 'text', required: true },
        { key: 'min_height_ft', label: 'Min Height (ft)', type: 'number' },
        { key: 'max_height_ft', label: 'Max Height (ft)', type: 'number' },
        { key: 'primary_value', label: 'Labor Multiplier', type: 'number', required: true },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
    } as RatesFlagsEditableCategory<'height_factors'>
    const adapter = getRatesFlagsDraftAdapter(category.key)

    expect(
      adapter.validateDraft(category, {
        id: 'H_TALL',
        display_name: 'Tall',
        min_height_ft: 14,
        max_height_ft: 10,
        primary_value: 1.25,
        notes: '',
      } satisfies HeightFactorDraft)
    ).toEqual({
      ok: false,
      error: 'Min Height (ft) must be less than or equal to Max Height (ft).',
      fieldKey: 'max_height_ft',
    })
  })

  it('keeps active controlled by draftActive instead of draft input', () => {
    const category = {
      ...baseCategory,
      fields: baseCategory.fields.filter((field) => field.key !== 'system_group'),
    }
    const adapter = getRatesFlagsDraftAdapter(category.key)
    const draft = {
      ...adapter.createEmptyDraft(category),
      id: 'ROOM_A',
      display_name: 'Room A',
      active: false,
    } as ScopeDefaultDraft & { active: boolean }
    const draftWithArbitraryActiveInput = {
      ...draft,
      active: true,
    } as ScopeDefaultDraft & { active: boolean }

    const create = adapter.toMutationRequest({
      action: 'create',
      category,
      draft,
      draftActive: true,
    })
    const update = adapter.toMutationRequest({
      action: 'update',
      category,
      draft: draftWithArbitraryActiveInput,
      draftActive: false,
      originalId: 'ROOM_A',
    })

    expect(create.values.active).toBe('Y')
    expect(update.values.active).toBe('N')
  })

  it('builds category-specific mutation requests from drafts', () => {
    const category: RatesFlagsEditableCategory<'scope_defaults'> = {
      ...baseCategory,
      fields: [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'display_name', label: 'Display Name', type: 'text', required: true },
        { key: 'default_wall_mode', label: 'Wall Mode', type: 'select', options: ['RECT', 'SEG'] },
        { key: 'top_cut_in_factor', label: 'Top Cut-In Factor', type: 'number' },
        { key: 'bot_cut_in_factor', label: 'Bottom Cut-In Factor', type: 'number' },
        { key: 'typical_height_ft', label: 'Typical Height', type: 'number' },
        { key: 'include_walls', label: 'Include Walls', type: 'select', options: ['Y', 'N'] },
        { key: 'include_ceilings', label: 'Include Ceilings', type: 'select', options: ['Y', 'N'] },
        { key: 'include_trim', label: 'Include Trim', type: 'select', options: ['Y', 'N'] },
        { key: 'include_doors', label: 'Include Doors', type: 'select', options: ['Y', 'N'] },
        { key: 'include_drywall', label: 'Include Drywall', type: 'select', options: ['Y', 'N'] },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
    }
    const adapter = getRatesFlagsDraftAdapter(category.key)
    const request = adapter.toMutationRequest({
      action: 'update',
      category,
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
        {
          key: 'access_group',
          label: 'Access Group',
          type: 'select',
          readOnly: true,
          options: ['scaffolding'],
          writeDefault: 'scaffolding',
        },
        { key: 'fee_type', label: 'Fee Type', type: 'select', options: ['Labor', 'Other'] },
        { key: 'amount', label: 'Amount', type: 'number', required: true },
        { key: 'unit', label: 'Unit', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
    } as RatesFlagsEditableCategory<'access_fees_scaffolding'>
    const adapter = getRatesFlagsDraftAdapter(category.key)
    const accessRequest = adapter.toMutationRequest({
      action: 'create',
      category,
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

  it('normalizes number parsing edge cases without hiding invalid input', () => {
    const adapter = getRatesFlagsDraftAdapter(baseCategory.key)
    const empty = adapter.createEmptyDraft(baseCategory) as ScopeDefaultDraft
    const blank = adapter.updateDraftField(baseCategory, empty, 'typical_height_ft', ' ') as ScopeDefaultDraft
    const currency = adapter.updateDraftField(baseCategory, blank, 'typical_height_ft', '$1,250.50') as ScopeDefaultDraft
    const invalid = adapter.updateDraftField(baseCategory, currency, 'typical_height_ft', 'abc') as ScopeDefaultDraft

    expect(blank.typical_height_ft).toBeNull()
    expect(currency.typical_height_ft).toBe(1250.5)
    expect(invalid.typical_height_ft).toBe('abc')
  })
})
