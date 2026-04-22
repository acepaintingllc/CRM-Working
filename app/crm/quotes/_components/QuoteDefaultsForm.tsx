'use client'

import { CrmField } from '@/app/crm/_components/CrmField'
import type { QuoteDefaults } from '@/lib/settings/types'

type ProductRow = {
  id: string
  name: string
  family?: string | null
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
  options: ProductRow[]
}

type QuoteDefaultsFormProps = {
  value: QuoteDefaults
  productDefaultFields: readonly ProductDefaultConfig[]
  onChange: (next: QuoteDefaults) => void
}

export function QuoteDefaultsForm({
  value,
  productDefaultFields,
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
          {productDefaultFields.map(({ label, key, options }) => (
            <CrmField key={key} label={label}>
              <select
                className="ace-crm-input text-sm"
                value={value[key] ?? ''}
                onChange={(event) => updateField(key, event.target.value || null)}
              >
                <option value="">-- none --</option>
                {options.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
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
          <CrmField label="Labor rate / hr">
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
