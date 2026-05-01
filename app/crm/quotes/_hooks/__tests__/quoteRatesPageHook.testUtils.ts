import type { ProductionRateRow, RatesFlagsPayload } from '@/types/estimator/ratesFlags'

type RatesPayloadRow = RatesFlagsPayload['categories'][number]['rows'][number]

export function getObjectValue(value: object | null, key: string) {
  if (!value) return undefined
  const propertyValue: unknown = Reflect.get(value, key)
  return propertyValue
}

export function buildWallRateRow(overrides: Partial<ProductionRateRow>): ProductionRateRow {
  return {
    id: 'wall-rate-1',
    production_scope: 'walls',
    scope_id: 'scope-1',
    display_name: 'Standard walls',
    surface_type: 'paint',
    condition: 'normal',
    prep_sqft_per_hr: '100',
    sqft_per_hr: '150',
    primer_sqft_per_hr: '100',
    notes: '',
    active: true,
    ...overrides,
  }
}

export function buildRatesPayload(params?: {
  rows?: RatesPayloadRow[]
  templateVersion?: number
}): RatesFlagsPayload {
  return {
    source: 'db',
    seeded: true,
    template_version: params?.templateVersion ?? 2,
    categories: [
      {
        key: 'production_rates_walls',
        tab: 'rates',
        group: 'production_rates',
        label: 'Wall Production',
        table_title: 'Wall Production',
        description: 'Wall rates',
        columns: [
          { key: 'display_name', label: 'Name' },
          { key: 'active', label: 'Status' },
        ],
        fields: [
          { key: 'id', label: 'ID', type: 'text', required: true },
          {
            key: 'production_scope',
            label: 'Production Scope',
            type: 'select',
            readOnly: true,
            options: ['walls'],
            writeDefault: 'walls',
          },
          { key: 'display_name', label: 'Display Name', type: 'text', required: true },
          { key: 'sqft_per_hr', label: 'Sq Ft / Hr', type: 'number' },
        ],
        rows: params?.rows ?? [buildWallRateRow({})],
      },
    ],
  }
}

export function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}
