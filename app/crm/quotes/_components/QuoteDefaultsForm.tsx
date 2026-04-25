'use client'

import { CrmField } from '@/app/crm/_components/CrmField'
import type {
  QuoteDefaultsFormFieldVm,
  QuoteDefaultsFormSectionVm,
} from '@/app/crm/quotes/_hooks/quoteDefaultsPageVm'
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
        return (
          <section key={section.key} className="grid gap-4">
            <QuoteDefaultsSectionHeader title={section.title} description={section.description} />
            <div
              className={section.fields.length > 1 ? 'grid gap-4 md:grid-cols-2' : 'max-w-[240px]'}
            >
              {section.fields.map((field) => (
                <QuoteDefaultsField
                  key={field.key}
                  field={field}
                  value={value}
                  onChange={updateField}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function QuoteDefaultsField({
  field,
  value,
  onChange,
}: {
  field: QuoteDefaultsFormFieldVm
  value: QuoteDefaults
  onChange: <K extends keyof QuoteDefaults>(field: K, nextValue: QuoteDefaults[K]) => void
}) {
  if (field.kind === 'product_select') {
    return (
      <CrmField label={field.label} error={field.error}>
        <select
          className="ace-crm-input text-sm"
          value={value[field.key] ?? ''}
          onChange={(event) => onChange(field.key, event.target.value || null)}
        >
          <option value="">-- none --</option>
          {field.options.map((product) => (
            <option key={product.id} value={product.id}>
              {product.label}
            </option>
          ))}
        </select>
      </CrmField>
    )
  }

  return (
    <CrmField label={field.label} error={field.error}>
      <input
        className="ace-crm-input text-sm"
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value[field.key]}
        onChange={(event) => onChange(field.key, Number(event.target.value))}
      />
    </CrmField>
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
