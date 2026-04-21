'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { getResponseErrorMessage, parseResponseBody } from '@/lib/jobs/actions'
import {
  next8amLocalDateTimeValue,
  toIsoFromLocalDateTimeValue,
} from '@/lib/jobs/dateHelpers'
import { applyTemplate, buildJobEmailTemplateVars } from '@/lib/jobs/emailTemplate'
import { makeIdempotencyKey } from '@/lib/jobs/idempotency'
import { JOB_STATUS_OPTIONS, type JobStatus, type StageEmailStage } from '@/lib/jobs/types'
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

type CustomerOption = {
  id: string
  name: string
  address: string | null
  email: string | null
  phone: string | null
}

type EmailTemplate = {
  stage: string
  subject: string | null
  body: string | null
}

function addHours(startIso: string, hours: number) {
  const date = new Date(startIso)
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString()
}

export default function NewJobPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<JobStatus>('estimate_scheduled')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [estimateDateLocal, setEstimateDateLocal] = useState('')
  const [scheduledDateLocal, setScheduledDateLocal] = useState('')
  const [addEstimateToCalendar, setAddEstimateToCalendar] = useState(true)
  const [estimateSummary, setEstimateSummary] = useState('')
  const [estimateLocation, setEstimateLocation] = useState('')
  const [estimateHours, setEstimateHours] = useState(1)
  const [addScheduledToCalendar, setAddScheduledToCalendar] = useState(true)
  const [scheduledSummary, setScheduledSummary] = useState('')
  const [scheduledLocation, setScheduledLocation] = useState('')
  const [scheduledHours, setScheduledHours] = useState(8)
  const [composeStage, setComposeStage] = useState<StageEmailStage | null>(null)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeLoading, setComposeLoading] = useState(false)
  const [sendingStage, setSendingStage] = useState<string | null>(null)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customers, customerId]
  )

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase()
    if (!query) return customers.slice(0, 2)
    return customers
      .filter((customer) => {
        const haystack =
          `${customer.name} ${customer.email ?? ''} ${customer.phone ?? ''} ${customer.address ?? ''}`.toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 20)
  }, [customers, customerQuery])

  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true)
      setError(null)
      const response = await authedFetch('/api/customers', { cache: 'no-store' })
      const payload = await parseResponseBody(response)
      if (!response.ok) {
        setError(getResponseErrorMessage(response, payload))
        setCustomers([])
        setLoading(false)
        return
      }
      setCustomers(((payload.json as { customers?: CustomerOption[] } | null)?.customers ?? []) as CustomerOption[])
      setLoading(false)
    }

    void loadCustomers()
  }, [])

  useEffect(() => {
    if (!preselectedCustomerId || customerId) return
    const match = customers.find((customer) => customer.id === preselectedCustomerId)
    if (match) {
      setCustomerId(match.id)
      setCustomerQuery('')
    }
  }, [customerId, customers, preselectedCustomerId])

  useEffect(() => {
    const customerName = selectedCustomer?.name ?? 'Customer'
    const location = selectedCustomer?.address ?? ''
    setEstimateSummary(`Estimate: ${customerName}`)
    setScheduledSummary(`Job - ${customerName}`)
    setEstimateLocation(location)
    setScheduledLocation(location)
  }, [selectedCustomer?.id, title, selectedCustomer?.name, selectedCustomer?.address])

  useEffect(() => {
    if (status === 'estimate_scheduled' && !estimateDateLocal) {
      setEstimateDateLocal(next8amLocalDateTimeValue())
    }
    if (status === 'scheduled' && !scheduledDateLocal) {
      setScheduledDateLocal(next8amLocalDateTimeValue())
    }
  }, [status, estimateDateLocal, scheduledDateLocal])

  useEffect(() => {
    if (status !== 'estimate_scheduled' && composeStage === 'estimate_scheduled') {
      setComposeStage(null)
    }
  }, [composeStage, status])

  const createCalendarEvent = async (args: {
    summary: string
    location?: string | null
    description?: string | null
    startIso: string
    endIso: string
  }) => {
    const response = await authedFetch('/api/google-calendar/create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendar_name: "Austin's work",
        summary: args.summary,
        location: args.location ?? undefined,
        description: args.description ?? undefined,
        start: args.startIso,
        end: args.endIso,
      }),
    })
    const payload = await parseResponseBody(response)
    if (!response.ok) {
      throw new Error(getResponseErrorMessage(response, payload))
    }
    return (payload.json as { event?: unknown } | null)?.event ?? null
  }

  const openComposer = async (stage: StageEmailStage) => {
    setComposeStage(stage)
    setComposeLoading(true)
    setError(null)
    const response = await authedFetch('/api/email-templates', { cache: 'no-store' })
    const payload = await parseResponseBody(response)
    setComposeLoading(false)
    if (!response.ok) {
      setError(getResponseErrorMessage(response, payload))
      return
    }
    const templates = (((payload.json as { templates?: EmailTemplate[] } | null)?.templates ?? []) as EmailTemplate[])
    const row = templates.find((template) => template.stage === stage)
    const estimateIso = estimateDateLocal ? toIsoFromLocalDateTimeValue(estimateDateLocal) : null
    const scheduledIso = scheduledDateLocal ? toIsoFromLocalDateTimeValue(scheduledDateLocal) : null
    const vars = buildJobEmailTemplateVars({
      customerName: selectedCustomer?.name ?? '',
      customerEmail: selectedCustomer?.email ?? '',
      customerPhone: selectedCustomer?.phone ?? '',
      customerAddress: selectedCustomer?.address ?? '',
      jobTitle: title.trim(),
      estimateDate: estimateIso ? new Date(estimateIso).toLocaleString() : '',
      scheduledDate: scheduledIso ? new Date(scheduledIso).toLocaleString() : '',
      scheduledBlocks: scheduledIso ? new Date(scheduledIso).toLocaleString() : '',
      estimateFileName: '',
      estimateFileLink: '',
    })
    setComposeSubject(applyTemplate(row?.subject ?? '', vars))
    setComposeBody(applyTemplate(row?.body ?? '', vars))
  }

  const sendStageEmail = async (
    jobId: string,
    stage: StageEmailStage,
    subject?: string,
    body?: string
  ) => {
    const response = await authedFetch(`/api/jobs/${jobId}/send-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage,
        subject,
        body,
        idempotency_key: makeIdempotencyKey(stage, jobId),
      }),
    })
    const payload = await parseResponseBody(response)
    if (!response.ok) {
      throw new Error(getResponseErrorMessage(response, payload))
    }
  }

  const save = async (options?: { sendEstimateScheduled?: boolean }) => {
    setError(null)
    setCreatedJobId(null)

    if (!customerId) {
      setError('Select a customer')
      return
    }
    if (!title.trim()) {
      setError('Job title is required')
      return
    }
    if (options?.sendEstimateScheduled && status !== 'estimate_scheduled') {
      setError('Quote scheduled email requires the "Quote scheduled" stage.')
      return
    }

    const estimateIso = estimateDateLocal ? toIsoFromLocalDateTimeValue(estimateDateLocal) : null
    if (estimateDateLocal && !estimateIso) {
      setError('Quote date/time is invalid')
      return
    }
    if (options?.sendEstimateScheduled && !estimateIso) {
      setError('Add a quote date/time before sending the email.')
      return
    }

    const scheduledIso = scheduledDateLocal ? toIsoFromLocalDateTimeValue(scheduledDateLocal) : null
    if (scheduledDateLocal && !scheduledIso) {
      setError('Scheduled date/time is invalid')
      return
    }

    setSaving(true)
    try {
      const response = await authedFetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          title: title.trim(),
          description: description.trim() || null,
          status,
          estimate_date: status === 'estimate_scheduled' ? estimateIso : null,
          scheduled_date: status === 'scheduled' ? scheduledIso : null,
        }),
      })
      const payload = await parseResponseBody(response)
      if (!response.ok) {
        const parsed = (payload.json as {
          details?: string
          hint?: string
          code?: string
        } | null) ?? null
        const message = getResponseErrorMessage(response, payload)
        const details = parsed?.details ? `\n${parsed.details}` : ''
        const hint = parsed?.hint ? `\n${parsed.hint}` : ''
        const code = parsed?.code ? `\n(code ${parsed.code})` : ''
        throw new Error(`${message}${details}${hint}${code}`)
      }

      const createdId =
        ((payload.json as { job?: { id?: string } } | null)?.job?.id ?? null) as string | null
      setCreatedJobId(createdId)

      if (options?.sendEstimateScheduled) {
        if (!createdId) throw new Error('Job created without an id; unable to send email.')
        if (!selectedCustomer?.email) throw new Error('Customer email is missing.')
        setSendingStage('estimate_scheduled')
        await sendStageEmail(createdId, 'estimate_scheduled', composeSubject, composeBody)
        setSendingStage(null)
      }

      if (status === 'estimate_scheduled' && addEstimateToCalendar && estimateIso) {
        await createCalendarEvent({
          summary: estimateSummary || `Estimate: ${selectedCustomer?.name ?? 'Customer'}`,
          location: estimateLocation || selectedCustomer?.address,
          description: description.trim() || selectedCustomer?.address || null,
          startIso: estimateIso,
          endIso: addHours(estimateIso, Math.max(0.25, estimateHours)),
        })
      }

      if (status === 'scheduled' && addScheduledToCalendar && scheduledIso) {
        await createCalendarEvent({
          summary: scheduledSummary || `Job - ${selectedCustomer?.name ?? 'Customer'}`,
          location: scheduledLocation || selectedCustomer?.address,
          description: description.trim() || selectedCustomer?.address || null,
          startIso: scheduledIso,
          endIso: addHours(scheduledIso, Math.max(0.25, scheduledHours)),
        })
      }

      router.push('/crm/jobs')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to create job')
      setSaving(false)
      setSendingStage(null)
      return
    }

    setSaving(false)
  }

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
