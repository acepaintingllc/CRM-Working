'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import {
  loadQuoteMeasurementAssumptions,
  saveQuoteMeasurementAssumptions,
} from '@/lib/quotes/client'
import { emptyQuoteMeasurementAssumptions } from '@/lib/quotes/measurementAssumptionsForm'
import type { QuoteMeasurementAssumptions } from '@/lib/settings/types'

function toNumberInput(value: number) {
  return Number.isFinite(value) ? String(value) : ''
}

function parseNumberInput(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type FieldKey = keyof QuoteMeasurementAssumptions

const fields: Array<{
  key: FieldKey
  label: string
  help: string
}> = [
  {
    key: 'standard_door_deduction_sf',
    label: 'Door deduct (sf)',
    help: 'Wall square footage deducted for each standard door opening.',
  },
  {
    key: 'standard_window_deduction_sf',
    label: 'Window deduct (sf)',
    help: 'Wall square footage deducted for each standard window opening.',
  },
  {
    key: 'baseboard_opening_deduction_lf',
    label: 'Baseboard opening deduct (lf)',
    help: 'Linear feet deducted from baseboard runs for each standard opening.',
  },
]

export function QuoteMeasurementAssumptionsSection() {
  const resource = useEditableResource<QuoteMeasurementAssumptions>({
    initialData: emptyQuoteMeasurementAssumptions,
    load: loadQuoteMeasurementAssumptions,
    save: saveQuoteMeasurementAssumptions,
    getErrorMessage: (error) =>
      error instanceof Error ? error.message : 'Failed to load measurement assumptions.',
  })

  function updateField(key: FieldKey, value: string) {
    resource.setData((current) => ({
      ...current,
      [key]: parseNumberInput(value),
    }))
  }

  return (
    <CrmResourceState
      loading={resource.loading}
      error={resource.error}
      hasData={resource.hasLoaded}
      loadingTitle="Loading assumptions"
      loadingDescription="Loading measurement assumptions..."
      errorTitle="Measurement assumptions unavailable"
      onRetry={() => void resource.reload()}
    >
      <CrmSectionCard
        title="Measurement Deductions"
        description="Org-level defaults used when wall and trim measurements deduct standard openings."
        actions={
          <div className="flex flex-wrap gap-2">
            <CrmButton
              type="button"
              tone="primary"
              disabled={resource.saving || !resource.dirty}
              onClick={() => void resource.saveChanges()}
            >
              {resource.saving ? 'Saving...' : 'Save assumptions'}
            </CrmButton>
            <CrmButton type="button" disabled={resource.saving} onClick={() => void resource.reload()}>
              Reset
            </CrmButton>
          </div>
        }
      >
        <div className="grid gap-4">
          {resource.notice ? (
            <CrmNotice tone="success" compact>
              {resource.notice}
            </CrmNotice>
          ) : null}
          <div className="grid gap-4 md:grid-cols-3">
            {fields.map((field) => (
              <CrmField key={field.key} label={field.label} help={field.help}>
                <input
                  aria-label={field.label}
                  className="ace-crm-input text-sm"
                  type="number"
                  min="0"
                  step="0.01"
                  value={toNumberInput(resource.data[field.key])}
                  disabled={resource.saving}
                  onChange={(event) => updateField(field.key, event.target.value)}
                />
              </CrmField>
            ))}
          </div>
        </div>
      </CrmSectionCard>
    </CrmResourceState>
  )
}
