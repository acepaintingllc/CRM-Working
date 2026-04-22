'use client'

import Link from 'next/link'
import { useNewJobPage } from '@/app/crm/jobs/_hooks/useNewJobPage'
import { JOB_STATUS_OPTIONS, type JobStatus } from '@/lib/jobs/types'
import {
  jobsButtonAccentClassName,
  jobsButtonSecondaryClassName,
  jobsButtonSmallClassName,
  jobsCardClassName,
  jobsInputClassName,
  jobsLabelClassName,
  jobsPageShellClassName,
  jobsPanelClassName,
  jobsTextareaClassName,
} from '@/lib/jobs/uiClasses'

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

  return (
    <div className={`${jobsPageShellClassName} max-w-[900px]`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold">New Job</div>
          <div className="text-xs text-[var(--crm-muted)]">
            Pick a stage, assign a customer, and optionally add estimate/scheduled events to Google Calendar.
          </div>
        </div>
        <Link href="/crm/jobs" className={`${jobsButtonSecondaryClassName} no-underline`}>
          Back
        </Link>
      </div>

      <div className={jobsCardClassName}>
        {loading ? (
          <div className="text-[var(--crm-muted)]">Loading customers...</div>
        ) : (
          <div className="grid gap-3">
            <div>
              <div className={jobsLabelClassName}>Stage</div>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as JobStatus)}
                className={jobsInputClassName}
              >
                {JOB_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className={jobsLabelClassName}>Customer</div>
              <input
                placeholder="Search customer by name / phone / email / address..."
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                className={jobsInputClassName}
              />
              <div className="mt-2.5 grid gap-2">
                {filteredCustomers.length === 0 ? (
                  <div className="text-sm text-[var(--crm-muted)]">No matches.</div>
                ) : (
                  filteredCustomers.map((customer) => {
                    const active = customer.id === customerId
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => setCustomerId(customer.id)}
                        className={`rounded-xl border px-3 py-3 text-left ${
                          active
                            ? 'border-[#111] bg-[#111] text-white'
                            : 'border-gray-200 bg-white text-[#111]'
                        }`}
                      >
                        <div className="font-extrabold">{customer.name}</div>
                        {(customer.phone || customer.email) && (
                          <div
                            className={`mt-1 text-xs ${
                              active ? 'text-white/80' : 'text-gray-500'
                            }`}
                          >
                            {customer.phone ?? ''}
                            {customer.phone && customer.email ? ' - ' : ''}
                            {customer.email ?? ''}
                          </div>
                        )}
                        {customer.address && (
                          <div
                            className={`mt-1 text-xs ${
                              active ? 'text-white/80' : 'text-gray-500'
                            }`}
                          >
                            {customer.address}
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div>
              <div className={jobsLabelClassName}>Job title</div>
              <input
                placeholder="ex: Exterior repaint"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={jobsInputClassName}
              />
            </div>

            <div>
              <div className={jobsLabelClassName}>Notes</div>
              <textarea
                placeholder="Scope, paint colors, prep notes, etc."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={`${jobsTextareaClassName} min-h-[110px]`}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {status === 'estimate_scheduled' ? (
                <div className="md:col-span-2">
                  <div className={jobsLabelClassName}>Quote date/time</div>
                  <input
                    type="datetime-local"
                    value={estimateDateLocal}
                    onChange={(event) => setEstimateDateLocal(event.target.value)}
                    className={jobsInputClassName}
                  />
                  <div className="mt-1.5 text-xs text-[var(--crm-muted)]">
                    Defaults to 8:00 AM. Creates a 1 hour estimate event in Austin&apos;s work if enabled.
                  </div>
                </div>
              ) : status === 'scheduled' ? (
                <div className="md:col-span-2">
                  <div className={jobsLabelClassName}>Scheduled date/time</div>
                  <input
                    type="datetime-local"
                    value={scheduledDateLocal}
                    onChange={(event) => setScheduledDateLocal(event.target.value)}
                    className={jobsInputClassName}
                  />
                  <div className="mt-1.5 text-xs text-[var(--crm-muted)]">
                    Defaults to 8:00 AM. Creates an 8 hour scheduled event in Austin&apos;s work if enabled.
                  </div>
                </div>
              ) : (
                <div className="md:col-span-2 text-sm text-[var(--crm-muted)]">
                  No date/time needed for this stage.
                </div>
              )}
            </div>

            {status === 'estimate_scheduled' ? (
              <>
                <div className={jobsPanelClassName}>
                  <div className="flex items-center justify-between">
                    <div className="font-black">Estimate calendar event</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={addEstimateToCalendar}
                        onChange={(event) => setAddEstimateToCalendar(event.target.checked)}
                      />
                      Add to Google
                    </label>
                  </div>

                  <div className="mt-2.5 grid gap-2.5">
                    <input
                      value={estimateSummary}
                      onChange={(event) => setEstimateSummary(event.target.value)}
                      placeholder="Summary"
                      className={jobsInputClassName}
                    />
                    <input
                      value={estimateLocation}
                      onChange={(event) => setEstimateLocation(event.target.value)}
                      placeholder="Location (auto from customer address)"
                      className={jobsInputClassName}
                    />
                    <div className="flex gap-2.5">
                      <input
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={estimateHours}
                        onChange={(event) => setEstimateHours(Number(event.target.value))}
                        className={`${jobsInputClassName} w-[120px]`}
                      />
                      <div className="self-center text-sm text-[var(--crm-muted)]">hours</div>
                    </div>
                  </div>
                </div>

                <div className={jobsPanelClassName}>
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="font-black">Quote scheduled email</div>
                    <button
                      onClick={() => void openComposer('estimate_scheduled')}
                      className={jobsButtonSmallClassName}
                    >
                      Edit & send
                    </button>
                  </div>
                  <div className="mt-1.5 text-xs text-[var(--crm-muted)]">
                    Uses the estimate date/time above to confirm the appointment.
                  </div>

                  {composeStage === 'estimate_scheduled' && (
                    <div className="mt-3 grid gap-2.5">
                      {composeLoading ? (
                        <div className="text-[var(--crm-muted)]">Loading template...</div>
                      ) : (
                        <>
                          <div className={jobsLabelClassName}>Subject</div>
                          <input
                            value={composeSubject}
                            onChange={(event) => setComposeSubject(event.target.value)}
                            className={jobsInputClassName}
                          />
                          <div className={jobsLabelClassName}>Body</div>
                          <textarea
                            value={composeBody}
                            onChange={(event) => setComposeBody(event.target.value)}
                            className={`${jobsTextareaClassName} min-h-[160px]`}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => void save({ sendEstimateScheduled: true })}
                              disabled={saving || sendingStage === 'estimate_scheduled'}
                              className={jobsButtonAccentClassName}
                            >
                              {sendingStage === 'estimate_scheduled'
                                ? 'Sending...'
                                : 'Create job & send email'}
                            </button>
                            <button
                              onClick={() => setComposeStage(null)}
                              className={jobsButtonSmallClassName}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : status === 'scheduled' ? (
              <div className={jobsPanelClassName}>
                <div className="flex items-center justify-between">
                  <div className="font-black">Scheduled calendar event</div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={addScheduledToCalendar}
                      onChange={(event) => setAddScheduledToCalendar(event.target.checked)}
                    />
                    Add to Google
                  </label>
                </div>

                <div className="mt-2.5 grid gap-2.5">
                  <input
                    value={scheduledSummary}
                    onChange={(event) => setScheduledSummary(event.target.value)}
                    placeholder="Summary"
                    className={jobsInputClassName}
                  />
                  <input
                    value={scheduledLocation}
                    onChange={(event) => setScheduledLocation(event.target.value)}
                    placeholder="Location (auto from customer address)"
                    className={jobsInputClassName}
                  />
                  <div className="flex gap-2.5">
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={scheduledHours}
                      onChange={(event) => setScheduledHours(Number(event.target.value))}
                      className={`${jobsInputClassName} w-[120px]`}
                    />
                    <div className="self-center text-sm text-[var(--crm-muted)]">hours</div>
                  </div>
                </div>
              </div>
            ) : null}

            {error && <div className="text-sm text-red-700">{error}</div>}
            {createdJobId && error && (
              <div className="text-sm text-[var(--crm-muted)]">
                Job created.{' '}
                <Link href={`/crm/jobs/${createdJobId}`} className="font-bold text-[var(--crm-text)]">
                  Open job
                </Link>
              </div>
            )}

            <button
              onClick={() => void save()}
              disabled={saving}
              className={`${jobsButtonAccentClassName} mt-0.5`}
            >
              {saving ? 'Saving...' : 'Create job'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
