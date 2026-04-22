'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { crmInputClassName, crmSurfaceMutedClassName } from '@/app/crm/_components/crmStyles'
import type { CustomerOption } from '@/app/crm/jobs/_hooks/useNewJobPage'
import type { JobCreateValues } from '@/lib/jobs/forms'
import { JOB_STATUS_OPTIONS, type JobStatus } from '@/lib/jobs/types'

type JobCreateFormProps = {
  value: JobCreateValues
  customers: CustomerOption[]
  saving?: boolean
  composeLoading?: boolean
  sendingStage?: string | null
  onChange: (next: JobCreateValues) => void
  onSubmit: () => void
  onOpenComposer: () => void
  onSubmitAndSendEstimateScheduled: () => void
}

export function JobCreateForm({
  value,
  customers,
  saving = false,
  composeLoading = false,
  sendingStage = null,
  onChange,
  onSubmit,
  onOpenComposer,
  onSubmitAndSendEstimateScheduled,
}: JobCreateFormProps) {
  const inputClassName = crmInputClassName('text-sm')
  const textareaClassName = crmInputClassName('min-h-[110px] resize-y text-sm')
  const compactButtonClassName = 'min-h-0 px-2.5 py-1.5 text-xs'
  const panelClassName = crmSurfaceMutedClassName('rounded-[var(--crm-ui-radius-sm)] p-3')

  function updateField<K extends keyof JobCreateValues>(field: K, nextValue: JobCreateValues[K]) {
    onChange({ ...value, [field]: nextValue })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <CrmField label="Stage">
        <select
          value={value.status}
          onChange={(event) => updateField('status', event.target.value as JobStatus)}
          className={inputClassName}
        >
          {JOB_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.title}
            </option>
          ))}
        </select>
      </CrmField>

      <CrmField label="Customer">
        <input
          placeholder="Search customer by name / phone / email / address..."
          value={value.customerQuery}
          onChange={(event) => updateField('customerQuery', event.target.value)}
          className={inputClassName}
        />
        <div className="mt-2.5 grid gap-2">
          {customers.length === 0 ? (
            <CrmEmptyState
              compact
              emoji="🔎"
              title="No matching customers"
              description="Try a broader customer search."
            />
          ) : (
            customers.map((customer) => {
              const active = customer.id === value.customerId
              return (
                <CrmButton
                  key={customer.id}
                  type="button"
                  onClick={() => updateField('customerId', customer.id)}
                  tone={active ? 'primary' : 'secondary'}
                  className="justify-start px-3 py-3 text-left"
                >
                  <div className="font-extrabold">{customer.name}</div>
                  {(customer.phone || customer.email) && (
                    <div
                      className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-[color:var(--crm-ui-muted)]'}`}
                    >
                      {customer.phone ?? ''}
                      {customer.phone && customer.email ? ' - ' : ''}
                      {customer.email ?? ''}
                    </div>
                  )}
                  {customer.address ? (
                    <div
                      className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-[color:var(--crm-ui-muted)]'}`}
                    >
                      {customer.address}
                    </div>
                  ) : null}
                </CrmButton>
              )
            })
          )}
        </div>
      </CrmField>

      <CrmField label="Job title">
        <input
          placeholder="ex: Exterior repaint"
          value={value.title}
          onChange={(event) => updateField('title', event.target.value)}
          className={inputClassName}
        />
      </CrmField>

      <CrmField label="Notes">
        <textarea
          placeholder="Scope, paint colors, prep notes, etc."
          value={value.description}
          onChange={(event) => updateField('description', event.target.value)}
          className={textareaClassName}
        />
      </CrmField>

      {value.status === 'estimate_scheduled' ? (
        <CrmField
          label="Quote date/time"
          help="Defaults to 8:00 AM. Creates a 1 hour estimate event in Austin's work if enabled."
        >
          <input
            type="datetime-local"
            value={value.estimateDateLocal}
            onChange={(event) => updateField('estimateDateLocal', event.target.value)}
            className={inputClassName}
          />
        </CrmField>
      ) : value.status === 'scheduled' ? (
        <CrmField
          label="Scheduled date/time"
          help="Defaults to 8:00 AM. Creates an 8 hour scheduled event in Austin's work if enabled."
        >
          <input
            type="datetime-local"
            value={value.scheduledDateLocal}
            onChange={(event) => updateField('scheduledDateLocal', event.target.value)}
            className={inputClassName}
          />
        </CrmField>
      ) : (
        <div className="text-sm text-[color:var(--crm-ui-muted)]">No date/time needed for this stage.</div>
      )}

      {value.status === 'estimate_scheduled' ? (
        <>
          <div className={panelClassName}>
            <div className="flex items-center justify-between">
              <div className="font-black text-[color:var(--crm-ui-text)]">Estimate calendar event</div>
              <label className="flex items-center gap-2 text-sm text-[color:var(--crm-ui-text)]">
                <input
                  type="checkbox"
                  checked={value.addEstimateToCalendar}
                  onChange={(event) => updateField('addEstimateToCalendar', event.target.checked)}
                />
                Add to Google
              </label>
            </div>

            <div className="mt-3 grid gap-3">
              <CrmField label="Summary">
                <input
                  value={value.estimateSummary}
                  onChange={(event) => updateField('estimateSummary', event.target.value)}
                  placeholder="Summary"
                  className={inputClassName}
                />
              </CrmField>
              <CrmField label="Location">
                <input
                  value={value.estimateLocation}
                  onChange={(event) => updateField('estimateLocation', event.target.value)}
                  placeholder="Location (auto from customer address)"
                  className={inputClassName}
                />
              </CrmField>
              <CrmField label="Duration hours">
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={value.estimateHours}
                  onChange={(event) => updateField('estimateHours', Number(event.target.value))}
                  className={crmInputClassName('w-[120px] text-sm')}
                />
              </CrmField>
            </div>
          </div>

          <div className={panelClassName}>
            <div className="flex items-center justify-between gap-2.5">
              <div className="font-black text-[color:var(--crm-ui-text)]">Quote scheduled email</div>
              <CrmButton type="button" onClick={onOpenComposer} className={compactButtonClassName}>
                Edit & send
              </CrmButton>
            </div>
            <div className="mt-1.5 text-xs text-[color:var(--crm-ui-muted)]">
              Uses the estimate date/time above to confirm the appointment.
            </div>

            {value.composeStage === 'estimate_scheduled' ? (
              <div className="mt-3 grid gap-3">
                {composeLoading ? (
                  <div className="text-[color:var(--crm-ui-muted)]">Loading template...</div>
                ) : (
                  <>
                    <CrmField label="Subject">
                      <input
                        value={value.composeSubject}
                        onChange={(event) => updateField('composeSubject', event.target.value)}
                        className={inputClassName}
                      />
                    </CrmField>
                    <CrmField label="Body">
                      <textarea
                        value={value.composeBody}
                        onChange={(event) => updateField('composeBody', event.target.value)}
                        className={crmInputClassName('min-h-[160px] resize-y text-sm')}
                      />
                    </CrmField>
                    <CrmFormActions className="justify-end">
                      <CrmButton
                        type="button"
                        onClick={onSubmitAndSendEstimateScheduled}
                        disabled={saving || sendingStage === 'estimate_scheduled'}
                        tone="primary"
                      >
                        {sendingStage === 'estimate_scheduled'
                          ? 'Sending...'
                          : 'Create job & send email'}
                      </CrmButton>
                      <CrmButton
                        type="button"
                        onClick={() => updateField('composeStage', null)}
                        className={compactButtonClassName}
                      >
                        Cancel
                      </CrmButton>
                    </CrmFormActions>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {value.status === 'scheduled' ? (
        <div className={panelClassName}>
          <div className="flex items-center justify-between">
            <div className="font-black text-[color:var(--crm-ui-text)]">Scheduled calendar event</div>
            <label className="flex items-center gap-2 text-sm text-[color:var(--crm-ui-text)]">
              <input
                type="checkbox"
                checked={value.addScheduledToCalendar}
                onChange={(event) => updateField('addScheduledToCalendar', event.target.checked)}
              />
              Add to Google
            </label>
          </div>

          <div className="mt-3 grid gap-3">
            <CrmField label="Summary">
              <input
                value={value.scheduledSummary}
                onChange={(event) => updateField('scheduledSummary', event.target.value)}
                placeholder="Summary"
                className={inputClassName}
              />
            </CrmField>
            <CrmField label="Location">
              <input
                value={value.scheduledLocation}
                onChange={(event) => updateField('scheduledLocation', event.target.value)}
                placeholder="Location (auto from customer address)"
                className={inputClassName}
              />
            </CrmField>
            <CrmField label="Duration hours">
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={value.scheduledHours}
                onChange={(event) => updateField('scheduledHours', Number(event.target.value))}
                className={crmInputClassName('w-[120px] text-sm')}
              />
            </CrmField>
          </div>
        </div>
      ) : null}

      <CrmFormActions>
        <div className="text-xs text-[color:var(--crm-ui-muted)]">
          Jobs create flow follows the shared CRM detail-first CRUD standard.
        </div>
        <div className="flex flex-wrap gap-2">
          <CrmButton type="submit" disabled={saving} tone="primary">
            {saving ? 'Saving...' : 'Create job'}
          </CrmButton>
        </div>
      </CrmFormActions>
    </form>
  )
}
