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

    expect(vm.form.productDefaultFields[0]?.options).toEqual([
      { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
    ])
    expect(vm.form.productDefaultFields[1]?.options).toEqual([
      { id: 'primer-1', name: 'Primer', family: 'Primer', status: 'Active' },
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
      expect.objectContaining({ id: 'inactive-paint', status: 'Inactive' })
    )
    expect(vm.form.productDefaultFields[1]?.options[0]).toEqual(
      expect.objectContaining({ id: 'paint-1', family: 'Paint' })
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
})
