'use client'

import Link from 'next/link'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName, crmSurfaceMutedClassName } from '@/app/crm/_components/crmStyles'
import { useNewJobPage } from '@/app/crm/jobs/_hooks/useNewJobPage'
import { JOB_STATUS_OPTIONS, type JobStatus } from '@/lib/jobs/types'

export default function NewJobPage() {
  const {
    customerQuery,
    setCustomerQuery,
    customerId,
    setCustomerId,
    loading,
    error,
    saving,
    createdJobId,
    status,
    setStatus,
    title,
    setTitle,
    description,
    setDescription,
    estimateDateLocal,
    setEstimateDateLocal,
    scheduledDateLocal,
    setScheduledDateLocal,
    addEstimateToCalendar,
    setAddEstimateToCalendar,
    estimateSummary,
    setEstimateSummary,
    estimateLocation,
    setEstimateLocation,
    estimateHours,
    setEstimateHours,
    addScheduledToCalendar,
    setAddScheduledToCalendar,
    scheduledSummary,
    setScheduledSummary,
    scheduledLocation,
    setScheduledLocation,
    scheduledHours,
    setScheduledHours,
    composeStage,
    setComposeStage,
    composeSubject,
    setComposeSubject,
    composeBody,
    setComposeBody,
    composeLoading,
    sendingStage,
    filteredCustomers,
    openComposer,
    save,
  } = useNewJobPage()

  const inputClassName = crmInputClassName('text-sm')
  const textareaClassName = crmInputClassName('min-h-[110px] resize-y text-sm')
  const compactButtonClassName = 'min-h-0 px-2.5 py-1.5 text-xs'
  const panelClassName = crmSurfaceMutedClassName('rounded-[var(--crm-ui-radius-sm)] p-3')

  return (
    <CrmPageShell className="max-w-[900px]">
      <CrmPageHeader
        eyebrow="Pipeline workflow"
        emoji="🛠️"
        title="New job"
        description="Pick a stage, assign a customer, and optionally add estimate or scheduled events to Google Calendar."
        backHref="/crm/jobs"
        backLabel="Back to jobs"
      />

      <CrmSectionCard
        title="Job setup"
        description="Shared CRM fields and surfaces now define the create-job flow."
      >
        {loading ? (
          <div className="text-[color:var(--crm-ui-muted)]">Loading customers...</div>
        ) : (
          <div className="grid gap-4">
            <CrmField label="Stage">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as JobStatus)}
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
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                className={inputClassName}
              />
              <div className="mt-2.5 grid gap-2">
                {filteredCustomers.length === 0 ? (
                  <CrmEmptyState
                    compact
                    emoji="🔎"
                    title="No matching customers"
                    description="Try a broader customer search."
                  />
                ) : (
                  filteredCustomers.map((customer) => {
                    const active = customer.id === customerId
                    return (
                      <CrmButton
                        key={customer.id}
                        type="button"
                        onClick={() => setCustomerId(customer.id)}
                        tone={active ? 'primary' : 'secondary'}
                        className="justify-start px-3 py-3 text-left"
                      >
                        <div className="font-extrabold">{customer.name}</div>
                        {(customer.phone || customer.email) && (
                          <div className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-[color:var(--crm-ui-muted)]'}`}>
                            {customer.phone ?? ''}
                            {customer.phone && customer.email ? ' - ' : ''}
                            {customer.email ?? ''}
                          </div>
                        )}
                        {customer.address ? (
                          <div className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-[color:var(--crm-ui-muted)]'}`}>
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
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClassName}
              />
            </CrmField>

            <CrmField label="Notes">
              <textarea
                placeholder="Scope, paint colors, prep notes, etc."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={textareaClassName}
              />
            </CrmField>

            {status === 'estimate_scheduled' ? (
              <CrmField
                label="Quote date/time"
                help="Defaults to 8:00 AM. Creates a 1 hour estimate event in Austin's work if enabled."
              >
                <input
                  type="datetime-local"
                  value={estimateDateLocal}
                  onChange={(event) => setEstimateDateLocal(event.target.value)}
                  className={inputClassName}
                />
              </CrmField>
            ) : status === 'scheduled' ? (
              <CrmField
                label="Scheduled date/time"
                help="Defaults to 8:00 AM. Creates an 8 hour scheduled event in Austin's work if enabled."
              >
                <input
                  type="datetime-local"
                  value={scheduledDateLocal}
                  onChange={(event) => setScheduledDateLocal(event.target.value)}
                  className={inputClassName}
                />
              </CrmField>
            ) : (
              <div className="text-sm text-[color:var(--crm-ui-muted)]">No date/time needed for this stage.</div>
            )}

            {status === 'estimate_scheduled' ? (
              <>
                <div className={panelClassName}>
                  <div className="flex items-center justify-between">
                    <div className="font-black text-[color:var(--crm-ui-text)]">Estimate calendar event</div>
                    <label className="flex items-center gap-2 text-sm text-[color:var(--crm-ui-text)]">
                      <input
                        type="checkbox"
                        checked={addEstimateToCalendar}
                        onChange={(event) => setAddEstimateToCalendar(event.target.checked)}
                      />
                      Add to Google
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <CrmField label="Summary">
                      <input
                        value={estimateSummary}
                        onChange={(event) => setEstimateSummary(event.target.value)}
                        placeholder="Summary"
                        className={inputClassName}
                      />
                    </CrmField>
                    <CrmField label="Location">
                      <input
                        value={estimateLocation}
                        onChange={(event) => setEstimateLocation(event.target.value)}
                        placeholder="Location (auto from customer address)"
                        className={inputClassName}
                      />
                    </CrmField>
                    <CrmField label="Duration hours">
                      <input
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={estimateHours}
                        onChange={(event) => setEstimateHours(Number(event.target.value))}
                        className={crmInputClassName('w-[120px] text-sm')}
                      />
                    </CrmField>
                  </div>
                </div>

                <div className={panelClassName}>
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="font-black text-[color:var(--crm-ui-text)]">Quote scheduled email</div>
                    <CrmButton
                      type="button"
                      onClick={() => void openComposer('estimate_scheduled')}
                      className={compactButtonClassName}
                    >
                      Edit & send
                    </CrmButton>
                  </div>
                  <div className="mt-1.5 text-xs text-[color:var(--crm-ui-muted)]">
                    Uses the estimate date/time above to confirm the appointment.
                  </div>

                  {composeStage === 'estimate_scheduled' ? (
                    <div className="mt-3 grid gap-3">
                      {composeLoading ? (
                        <div className="text-[color:var(--crm-ui-muted)]">Loading template...</div>
                      ) : (
                        <>
                          <CrmField label="Subject">
                            <input
                              value={composeSubject}
                              onChange={(event) => setComposeSubject(event.target.value)}
                              className={inputClassName}
                            />
                          </CrmField>
                          <CrmField label="Body">
                            <textarea
                              value={composeBody}
                              onChange={(event) => setComposeBody(event.target.value)}
                              className={crmInputClassName('min-h-[160px] resize-y text-sm')}
                            />
                          </CrmField>
                          <CrmFormActions className="justify-end">
                            <CrmButton
                              onClick={() => void save({ sendEstimateScheduled: true })}
                              disabled={saving || sendingStage === 'estimate_scheduled'}
                              tone="primary"
                            >
                              {sendingStage === 'estimate_scheduled'
                                ? 'Sending...'
                                : 'Create job & send email'}
                            </CrmButton>
                            <CrmButton
                              onClick={() => setComposeStage(null)}
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

            {status === 'scheduled' ? (
              <div className={panelClassName}>
                <div className="flex items-center justify-between">
                  <div className="font-black text-[color:var(--crm-ui-text)]">Scheduled calendar event</div>
                  <label className="flex items-center gap-2 text-sm text-[color:var(--crm-ui-text)]">
                    <input
                      type="checkbox"
                      checked={addScheduledToCalendar}
                      onChange={(event) => setAddScheduledToCalendar(event.target.checked)}
                    />
                    Add to Google
                  </label>
                </div>

                <div className="mt-3 grid gap-3">
                  <CrmField label="Summary">
                    <input
                      value={scheduledSummary}
                      onChange={(event) => setScheduledSummary(event.target.value)}
                      placeholder="Summary"
                      className={inputClassName}
                    />
                  </CrmField>
                  <CrmField label="Location">
                    <input
                      value={scheduledLocation}
                      onChange={(event) => setScheduledLocation(event.target.value)}
                      placeholder="Location (auto from customer address)"
                      className={inputClassName}
                    />
                  </CrmField>
                  <CrmField label="Duration hours">
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={scheduledHours}
                      onChange={(event) => setScheduledHours(Number(event.target.value))}
                      className={crmInputClassName('w-[120px] text-sm')}
                    />
                  </CrmField>
                </div>
              </div>
            ) : null}

            {error ? <CrmNotice tone="error" compact>{error}</CrmNotice> : null}
            {createdJobId && error ? (
              <div className="text-sm text-[color:var(--crm-ui-muted)]">
                Job created.{' '}
                <Link href={`/crm/jobs/${createdJobId}`} className="font-bold text-[color:var(--crm-ui-text)]">
                  Open job
                </Link>
              </div>
            ) : null}

            <CrmButton onClick={() => void save()} disabled={saving} tone="primary" className="mt-0.5">
              {saving ? 'Saving...' : 'Create job'}
            </CrmButton>
          </div>
        )}
      </CrmSectionCard>
    </CrmPageShell>
  )
}
