'use client'

import { CrmField } from '@/app/crm/_components/CrmField'
import type { QuoteDefaults } from '@/lib/settings/types'

type ProductRow = {
  id: string
  name: string
  family?: string | null
  status?: string | null
  missing?: boolean
}

type ProductDefaultField =
  keyof Pick<
    QuoteDefaults,
    | 'walls_paint_id'
    | 'walls_primer_id'
    | 'ceiling_paint_id'
    | 'ceiling_primer_id'
    | 'trim_paint_id'
    | 'trim_primer_id'
  >

type ProductDefaultConfig = {
  label: string
  key: ProductDefaultField
  expectedFamily: string
  options: ProductRow[]
}

type QuoteDefaultsFormProps = {
  value: QuoteDefaults
  productDefaultFields: readonly ProductDefaultConfig[]
  productDefaultErrors?: Partial<Record<keyof QuoteDefaults, string>>
  onChange: (next: QuoteDefaults) => void
}

export function QuoteDefaultsForm({
  value,
  productDefaultFields,
  productDefaultErrors = {},
  onChange,
}: QuoteDefaultsFormProps) {
  function updateField<K extends keyof QuoteDefaults>(field: K, nextValue: QuoteDefaults[K]) {
    onChange({ ...value, [field]: nextValue })
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <div>
          <h3 className="text-base font-black text-[color:var(--crm-ui-text)]">Paint and primer</h3>
          <p className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">
            Shared starter selections for new quote job settings.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {productDefaultFields.map(({ label, key, expectedFamily, options }) => (
            <CrmField key={key} label={label} error={productDefaultErrors[key]}>
              <select
                className="ace-crm-input text-sm"
                value={value[key] ?? ''}
                onChange={(event) => updateField(key, event.target.value || null)}
              >
                <option value="">-- none --</option>
                {options.map((product) => (
                  <option key={product.id} value={product.id}>
                    {formatProductOptionLabel(product, expectedFamily)}
                  </option>
                ))}
              </select>
            </CrmField>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <h3 className="text-base font-black text-[color:var(--crm-ui-text)]">Labor rate</h3>
          <p className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">
            Org-level labor rate used when a specific quote has not saved its own override.
          </p>
        </div>
        <div className="max-w-[240px]">
          <CrmField label="Labor rate / hr" error={productDefaultErrors.override_labor_rate}>
            <input
              className="ace-crm-input text-sm"
              type="number"
              min={0}
              step={1}
              value={value.override_labor_rate}
              onChange={(event) => updateField('override_labor_rate', Number(event.target.value))}
            />
          </CrmField>
        </div>
      </section>
    </div>
  )
}

function formatProductOptionLabel(product: ProductRow, expectedFamily: string) {
  if (product.missing) return product.name

  const tags = [
    product.status && !isActiveStatus(product.status) ? product.status : null,
    product.family && !matchesExpectedFamily(product.family, expectedFamily) ? product.family : null,
  ].filter(Boolean)

  return tags.length > 0 ? `${product.name} (${tags.join(', ')})` : product.name
}

function matchesExpectedFamily(value: string, expectedFamily: string) {
  return value.trim().toLowerCase() === expectedFamily.toLowerCase()
}

function isActiveStatus(value: string) {
  return value.trim().toLowerCase() === 'active'
}
