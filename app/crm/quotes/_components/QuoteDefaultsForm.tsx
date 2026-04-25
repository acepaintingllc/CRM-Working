'use client'

import { CrmField } from '@/app/crm/_components/CrmField'
import type { QuoteDefaultsFormSectionVm } from '@/app/crm/quotes/_hooks/quoteDefaultsPageVm'
import type { QuoteDefaults } from '@/lib/settings/types'

type QuoteDefaultsFormProps = {
  value: QuoteDefaults
  sections: readonly QuoteDefaultsFormSectionVm[]
  onChange: (next: QuoteDefaults) => void
}

export function QuoteDefaultsForm({
  value,
  sections,
  onChange,
}: QuoteDefaultsFormProps) {
  function updateField<K extends keyof QuoteDefaults>(field: K, nextValue: QuoteDefaults[K]) {
    onChange({ ...value, [field]: nextValue })
  }

  return (
    <div className="grid gap-6">
      {sections.map((section) => {
        if (section.kind === 'product_defaults') {
          return (
            <section key={section.key} className="grid gap-4">
              <QuoteDefaultsSectionHeader title={section.title} description={section.description} />
              <div className="grid gap-4 md:grid-cols-2">
                {section.productDefaultFields.map(({ label, key, error, options }) => (
                  <CrmField key={key} label={label} error={error}>
                    <select
                      className="ace-crm-input text-sm"
                      value={value[key] ?? ''}
                      onChange={(event) => updateField(key, event.target.value || null)}
                    >
                      <option value="">-- none --</option>
                      {options.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.label}
                        </option>
                      ))}
                    </select>
                  </CrmField>
                ))}
              </div>
            </section>
          )
        }

        return (
          <section key={section.key} className="grid gap-4">
            <QuoteDefaultsSectionHeader title={section.title} description={section.description} />
            <div className="max-w-[240px]">
              <CrmField label={section.laborRateField.label} error={section.laborRateField.error}>
                <input
                  className="ace-crm-input text-sm"
                  type="number"
                  min={0}
                  step={1}
                  value={value.override_labor_rate}
                  onChange={(event) =>
                    updateField(section.laborRateField.key, Number(event.target.value))
                  }
                />
              </CrmField>
            </div>
          </section>
        )
      })}
    </div>
  )
}

function QuoteDefaultsSectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h3 className="text-base font-black text-[color:var(--crm-ui-text)]">{title}</h3>
      <p className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">{description}</p>
    </div>
  )
}
