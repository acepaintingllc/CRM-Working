import { describe, expect, it } from 'vitest'
import {
  draftToQuoteProductPayload,
  normalizeQuoteProductDraft,
  quoteProductRowToDraft,
  validateQuoteProductDraft,
} from '@/lib/quotes/productsForm'

describe('productsForm', () => {
  it('maps a row into the explicit draft contract', () => {
    expect(
      quoteProductRowToDraft({
        id: 'product-1',
        name: 'Super Paint',
        family: 'Paint',
        base: 'A',
        subtype: 'Interior',
        cost_per_unit: 30,
        coverage_sqft_per_gal_per_coat: 350,
        efficiency_pct: 90,
        default_coats: 2,
        default_sheen: 'Eggshell',
        default_scopes: ['Walls'],
        notes: 'Ready to go',
        status: 'Active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      })
    ).toEqual({
      name: 'Super Paint',
      family: 'Paint',
      base: 'A',
      subtype: 'Interior',
      cost_per_unit: '30',
      coverage_sqft_per_gal_per_coat: '350',
      efficiency_pct: '90',
      default_coats: '2',
      default_sheen: 'Eggshell',
      default_scopes: ['Walls'],
      notes: 'Ready to go',
      status: 'Active',
    })
  })

  it('normalizes blanks and scope arrays before validation', () => {
    expect(
      normalizeQuoteProductDraft({
        name: '  Super Paint  ',
        family: ' Paint ',
        cost_per_unit: ' ',
        default_scopes: [' Walls ', 'Walls', '', ' Trim '],
        notes: '  ',
      })
    ).toMatchObject({
      name: 'Super Paint',
      family: 'Paint',
      cost_per_unit: '',
      default_scopes: ['Walls', 'Trim'],
      notes: '',
    })
  })

  it('treats blank numeric input as null in the save payload', () => {
    const result = draftToQuoteProductPayload({
      name: 'Super Paint',
      family: 'Paint',
      cost_per_unit: ' ',
      coverage_sqft_per_gal_per_coat: '',
      efficiency_pct: '',
      default_coats: '',
      default_sheen: 'Eggshell',
      default_scopes: ['Walls'],
      status: 'Active',
    })

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        cost_per_unit: null,
        coverage_sqft_per_gal_per_coat: null,
        efficiency_pct: null,
        default_coats: null,
        default_scopes: ['Walls'],
      }),
    })
  })

  it('rejects invalid numeric values and missing required fields', () => {
    const result = validateQuoteProductDraft({
      name: ' ',
      family: '',
      cost_per_unit: 'abc',
      default_sheen: 'Glossy',
      status: 'Paused',
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('Expected invalid quote product draft.')
    }

    expect(result.validation.fields.name).toBe('Product name is required.')
    expect(result.validation.fields.family).toBe('Choose a valid product family.')
    expect(result.validation.fields.cost_per_unit).toBe('Enter a valid number.')
    expect(result.validation.fields.default_sheen).toBe('Choose a valid sheen.')
    expect(result.validation.fields.status).toBe('Choose a valid status.')
  })

  it('rejects invalid scopes and out-of-range numeric business rules', () => {
    const result = validateQuoteProductDraft({
      name: 'Super Paint',
      family: 'Paint',
      efficiency_pct: '120',
      default_coats: '-1',
      default_scopes: ['Walls', 'Unknown'],
      default_sheen: 'Eggshell',
      status: 'Active',
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('Expected invalid quote product draft.')
    }

    expect(result.validation.fields.efficiency_pct).toBe('Efficiency must be 100 or less.')
    expect(result.validation.fields.default_coats).toBe('Default coats cannot be negative.')
    expect(result.validation.fields.default_scopes).toBe('Choose only valid default scopes.')
  })

  it('builds a normalized payload for valid saves', () => {
    const result = validateQuoteProductDraft({
      name: '  Super Paint  ',
      family: 'Paint',
      base: ' A ',
      subtype: ' Interior ',
      cost_per_unit: '42.5',
      coverage_sqft_per_gal_per_coat: '350',
      efficiency_pct: '90',
      default_coats: '2',
      default_sheen: 'Eggshell',
      default_scopes: ['Walls', 'Trim', 'Walls'],
      notes: '  High hide  ',
      status: 'Inactive',
    })

    expect(result).toEqual({
      ok: true,
      draft: {
        name: 'Super Paint',
        family: 'Paint',
        base: 'A',
        subtype: 'Interior',
        cost_per_unit: '42.5',
        coverage_sqft_per_gal_per_coat: '350',
        efficiency_pct: '90',
        default_coats: '2',
        default_sheen: 'Eggshell',
        default_scopes: ['Walls', 'Trim'],
        notes: 'High hide',
        status: 'Inactive',
      },
      payload: {
        name: 'Super Paint',
        family: 'Paint',
        base: 'A',
        subtype: 'Interior',
        cost_per_unit: 42.5,
        coverage_sqft_per_gal_per_coat: 350,
        efficiency_pct: 90,
        default_coats: 2,
        default_sheen: 'Eggshell',
        default_scopes: ['Walls', 'Trim'],
        notes: 'High hide',
        status: 'Inactive',
      },
      validation: {
        ok: true,
        summary: null,
        fields: {},
      },
    })
  })
})
