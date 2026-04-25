import { describe, expect, it } from 'vitest'
import { buildQuoteDefaultsFormState, emptyQuoteDefaults } from '@/lib/quotes/defaultsForm'
import { buildQuoteDefaultsPageVm } from '../quoteDefaultsPageVm'
import type { QuoteDefaultsResource } from '../quoteDefaultsPageController'

type QuoteDefaultsVmResource = Parameters<typeof buildQuoteDefaultsPageVm>[0]
type QuoteDefaultsVmResourceOverride = Partial<Omit<QuoteDefaultsVmResource, 'data'>> & {
  data?: Partial<QuoteDefaultsResource>
}

function buildResource(overrides: QuoteDefaultsVmResourceOverride = {}): QuoteDefaultsVmResource {
  const dataOverrides = overrides.data ?? {}
  const settings = dataOverrides.settings ?? emptyQuoteDefaults
  const products = dataOverrides.products ?? []
  const data: QuoteDefaultsResource = {
    ...dataOverrides,
    settings,
    products,
    form: buildQuoteDefaultsFormState(settings, { products }),
  }

  return {
    loading: false,
    saving: false,
    error: null,
    notice: null,
    dirty: false,
    hasLoaded: true,
    ...overrides,
    data,
  }
}

describe('buildQuoteDefaultsPageVm', () => {
  it('shows active matching products as default field options', () => {
    const vm = buildQuoteDefaultsPageVm(
      buildResource({
        data: {
          settings: emptyQuoteDefaults,
          products: [
            { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
            { id: 'primer-1', name: 'Primer', family: 'Primer', status: 'Active' },
            { id: 'inactive-paint', name: 'Old Paint', family: 'Paint', status: 'Inactive' },
          ],
        },
      })
    )

    expect(vm.form.sections[0]).toMatchObject({
      key: 'product_defaults',
      kind: 'product_defaults',
    })
    expect(vm.form.sections[0]).toMatchObject({
      productDefaultFields: expect.arrayContaining([
        expect.objectContaining({
          key: 'walls_paint_id',
          options: [expect.objectContaining({ id: 'paint-1', label: 'Paint' })],
        }),
      ]),
    })
    expect(vm.form.productDefaultFields[1]?.options).toEqual([
      expect.objectContaining({ id: 'primer-1', label: 'Primer' }),
    ])
  })

  it('keeps inactive and wrong-family saved selections visible while surfacing field errors', () => {
    const vm = buildQuoteDefaultsPageVm(
      buildResource({
        data: {
          settings: {
            ...emptyQuoteDefaults,
            walls_paint_id: 'inactive-paint',
            walls_primer_id: 'paint-1',
          },
          products: [
            { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
            { id: 'inactive-paint', name: 'Old Paint', family: 'Paint', status: 'Inactive' },
          ],
        },
        dirty: true,
      })
    )

    expect(vm.form.productDefaultFields[0]?.options[0]).toEqual(
      expect.objectContaining({
        id: 'inactive-paint',
        status: 'Inactive',
        label: 'Old Paint (Inactive)',
      })
    )
    expect(vm.form.productDefaultFields[1]?.options[0]).toEqual(
      expect.objectContaining({ id: 'paint-1', family: 'Paint', label: 'Paint (Paint)' })
    )
    expect(vm.form.productDefaultErrors.walls_paint_id).toMatch(/inactive/i)
    expect(vm.form.productDefaultErrors.walls_primer_id).toMatch(/must use a primer product/)
    expect(vm.form.canSave).toBe(false)
  })

  it('renders missing saved selections as missing options', () => {
    const vm = buildQuoteDefaultsPageVm(
      buildResource({
        data: {
          settings: {
            ...emptyQuoteDefaults,
            walls_paint_id: 'deleted-paint',
          },
          products: [{ id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' }],
        },
        dirty: true,
      })
    )

    expect(vm.form.productDefaultFields[0]?.options[0]).toEqual({
      id: 'deleted-paint',
      name: 'Missing product (deleted-paint)',
      family: null,
      status: 'Missing',
      missing: true,
      label: 'Missing product (deleted-paint)',
    })
    expect(vm.form.productDefaultErrors.walls_paint_id).toMatch(/no longer exists/)
    expect(vm.form.canSave).toBe(false)
  })

  it('derives save availability and feedback from resource state', () => {
    const clean = buildQuoteDefaultsPageVm(buildResource({ dirty: false }))
    const dirty = buildQuoteDefaultsPageVm(buildResource({ dirty: true }))
    const saving = buildQuoteDefaultsPageVm(buildResource({ dirty: true, saving: true }))

    expect(clean.form.canSave).toBe(false)
    expect(dirty.form.canSave).toBe(true)
    expect(saving.form.canSave).toBe(false)
    expect(saving.feedback.saving).toBe(true)
  })

  it('keeps labor defaults in their own section with field errors', () => {
    const vm = buildQuoteDefaultsPageVm(
      buildResource({
        data: {
          settings: {
            ...emptyQuoteDefaults,
            override_labor_rate: 10001,
          },
        },
        dirty: true,
      })
    )

    expect(vm.form.sections[1]).toEqual({
      key: 'labor_rate',
      kind: 'labor_rate',
      title: 'Labor rate',
      description: 'Org-level labor rate used when a specific quote has not saved its own override.',
      laborRateField: {
        label: 'Labor rate / hr',
        key: 'override_labor_rate',
        error: 'Labor rate must be between 0 and 10000.',
      },
    })
    expect(vm.form.canSave).toBe(false)
  })
})
