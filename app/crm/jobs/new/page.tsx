'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type JobStatus =
  | 'estimate_scheduled'
  | 'estimate_sent'
  | 'follow_up'
  | 'scheduled'
  | 'completed'
  | 'lost'

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
  const d = new Date(startIso)
  return new Date(d.getTime() + hours * 60 * 60 * 1000).toISOString()
}

function next8amLocalDateTimeValue() {
  const now = new Date()
  const d = new Date(now)
  d.setHours(8, 0, 0, 0)
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1)
  }
  // Format for <input type="datetime-local">: YYYY-MM-DDTHH:mm
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toIsoFromDateTimeLocal(v: string) {
  // datetime-local returns local time with no TZ; convert to Date then ISO.
  const dt = new Date(v)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString()
}

function createSendIdempotencyKey(stage: string, jobId: string) {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `stage:${stage}:job:${jobId}:${suffix}`
}

export default function NewJobPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  )

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q) return customers.slice(0, 2)
    const matches = customers.filter((c) => {
      const hay = `${c.name} ${c.email ?? ''} ${c.phone ?? ''} ${c.address ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
    return matches.slice(0, 20)
  }, [customers, customerQuery])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)

  const [status, setStatus] = useState<JobStatus>('estimate_scheduled')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // Scheduling inputs (calendar popup)
  const [estimateDateLocal, setEstimateDateLocal] = useState('')
  const [scheduledDateLocal, setScheduledDateLocal] = useState('')

  // Google Calendar event previews (editable)
  const [addEstimateToCalendar, setAddEstimateToCalendar] = useState(true)
  const [estimateSummary, setEstimateSummary] = useState('')
  const [estimateLocation, setEstimateLocation] = useState('')
  const [estimateHours, setEstimateHours] = useState(1)

  const [addScheduledToCalendar, setAddScheduledToCalendar] = useState(true)
  const [scheduledSummary, setScheduledSummary] = useState('')
  const [scheduledLocation, setScheduledLocation] = useState('')
  const [scheduledHours, setScheduledHours] = useState(8)

  const [composeStage, setComposeStage] = useState<string | null>(null)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeLoading, setComposeLoading] = useState(false)
  const [sendingStage, setSendingStage] = useState<string | null>(null)

  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true)
      setError(null)

      const res = await authedFetch('/api/customers', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        setCustomers([])
        setLoading(false)
        return
      }

      setCustomers(payload?.customers ?? [])
      setLoading(false)
    }

    void loadCustomers()
  }, [])

  useEffect(() => {
    if (!preselectedCustomerId || customerId) return
    const match = customers.find((c) => c.id === preselectedCustomerId)
    if (match) {
      setCustomerId(match.id)
      setCustomerQuery('')
    }
  }, [customerId, customers, preselectedCustomerId])

  // Auto-fill calendar event fields when customer/title change.
  useEffect(() => {
    const cName = selectedCustomer?.name ?? 'Customer'
    const loc = selectedCustomer?.address ?? ''

    setEstimateSummary(`Estimate: ${cName}`)
    setScheduledSummary(`Job - ${cName}`)
    setEstimateLocation(loc)
    setScheduledLocation(loc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id, title])

  // Default the visible datetime picker to 8:00 AM (next occurrence).
  useEffect(() => {
    if (status === 'estimate_scheduled' && !estimateDateLocal) {
      setEstimateDateLocal(next8amLocalDateTimeValue())
    }
    if (status === 'scheduled' && !scheduledDateLocal) {
      setScheduledDateLocal(next8amLocalDateTimeValue())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

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
    const res = await authedFetch('/api/google-calendar/create-event', {
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
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(payload?.error ?? res.statusText)
    }
    return payload?.event ?? null
  }

  const buildTemplateVars = (estimateIso: string | null, scheduledIso: string | null) => ({
    customerName: selectedCustomer?.name ?? '',
    customerEmail: selectedCustomer?.email ?? '',
    customerPhone: selectedCustomer?.phone ?? '',
    customerAddress: selectedCustomer?.address ?? '',
    jobTitle: title.trim() || '',
    estimateDate: estimateIso ? new Date(estimateIso).toLocaleString() : '',
    scheduledDate: scheduledIso ? new Date(scheduledIso).toLocaleString() : '',
    scheduledBlocks: scheduledIso ? new Date(scheduledIso).toLocaleString() : '',
    estimateFileName: '',
    estimateFileLink: '',
    reviewLink: process.env.NEXT_PUBLIC_REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
    customer_name: selectedCustomer?.name ?? '',
    customer_email: selectedCustomer?.email ?? '',
    customer_phone: selectedCustomer?.phone ?? '',
    customer_address: selectedCustomer?.address ?? '',
    job_title: title.trim() || '',
    estimate_date: estimateIso ? new Date(estimateIso).toLocaleString() : '',
    scheduled_date: scheduledIso ? new Date(scheduledIso).toLocaleString() : '',
    scheduled_blocks: scheduledIso ? new Date(scheduledIso).toLocaleString() : '',
    estimate_file_name: '',
    estimate_file_link: '',
    review_link: process.env.NEXT_PUBLIC_REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
  })

  const applyTemplate = (value: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val ?? ''), value)

  const openComposer = async (stage: string) => {
    setComposeStage(stage)
    setComposeLoading(true)
    setError(null)
    const res = await authedFetch('/api/email-templates', { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    setComposeLoading(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    const templates = (payload?.templates ?? []) as EmailTemplate[]
    const row = templates.find((t) => t.stage === stage)
    const estimateIso = estimateDateLocal ? toIsoFromDateTimeLocal(estimateDateLocal) : null
    const scheduledIso = scheduledDateLocal ? toIsoFromDateTimeLocal(scheduledDateLocal) : null
    const vars = buildTemplateVars(estimateIso, scheduledIso)
    setComposeSubject(applyTemplate(row?.subject ?? '', vars))
    setComposeBody(applyTemplate(row?.body ?? '', vars))
  }

  const sendStageEmail = async (jobId: string, stage: string, subject?: string, body?: string) => {
    const idempotencyKey = createSendIdempotencyKey(stage, jobId)
    const res = await authedFetch(`/api/jobs/${jobId}/send-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, subject, body, idempotency_key: idempotencyKey }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(payload?.error ?? res.statusText)
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
      setError('Estimate scheduled email requires the "Estimate scheduled" stage.')
      return
    }

    const estimateIso = estimateDateLocal ? toIsoFromDateTimeLocal(estimateDateLocal) : null
    if (estimateDateLocal && !estimateIso) {
      setError('Estimate date/time is invalid')
      return
    }

    if (options?.sendEstimateScheduled && !estimateIso) {
      setError('Add an estimate date/time before sending the email.')
      return
    }

    const scheduledIso = scheduledDateLocal ? toIsoFromDateTimeLocal(scheduledDateLocal) : null
    if (scheduledDateLocal && !scheduledIso) {
      setError('Scheduled date/time is invalid')
      return
    }

    setSaving(true)
    try {
      // 1) Create job in DB
      const res = await authedFetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          title: title.trim(),
          description: description.trim() || null,
          status,
          // Only include date fields that make sense for the selected stage.
          estimate_date: status === 'estimate_scheduled' ? estimateIso : null,
          scheduled_date: status === 'scheduled' ? scheduledIso : null,
        }),
      })
      const text = await res.text()
      let payload: { error?: string; details?: string; hint?: string; code?: string; job?: { id?: string } } | null = null
      try {
        payload = text ? JSON.parse(text) : null
      } catch {
        payload = null
      }
      if (!res.ok) {
        const message = payload?.error ?? res.statusText
        const details = payload?.details ? `\n${payload.details}` : ''
        const hint = payload?.hint ? `\n${payload.hint}` : ''
        const code = payload?.code ? `\n(code ${payload.code})` : ''
        throw new Error(`${message}${details}${hint}${code}`)
      }
      const createdId = payload?.job?.id ?? null
      setCreatedJobId(createdId)

      if (options?.sendEstimateScheduled) {
        if (!createdId) {
          throw new Error('Job created without an id; unable to send email.')
        }
        if (!selectedCustomer?.email) {
          throw new Error('Customer email is missing.')
        }
        setSendingStage('estimate_scheduled')
        await sendStageEmail(createdId, 'estimate_scheduled', composeSubject, composeBody)
        setSendingStage(null)
      }

      // 2) Optionally create calendar events (best-effort, but block on errors so you see them)
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create job')
      setSaving(false)
      setSendingStage(null)
      return
    }

    setSaving(false)
  }

  return (
    <div className="crm-page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="crm-topbar" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>New Job</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Pick a stage, assign a customer, and optionally add estimate/scheduled events to Google Calendar.
          </div>
        </div>
        <Link href="/crm/jobs" style={{ ...actionButton, textDecoration: 'none' }}>
          Back
        </Link>
      </div>

      <div className="crm-card" style={{ borderRadius: 12, padding: 14 }}>
        {loading ? (
          <div style={{ color: '#6b7280' }}>Loading customers...</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={label}>Stage</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)} style={inputStyle}>
                <option value="estimate_scheduled">Estimate scheduled</option>
                <option value="estimate_sent">Estimate sent</option>
                <option value="follow_up">Follow up</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <div>
              <div style={label}>Customer</div>
              <input
                placeholder="Search customer by name / phone / email / address..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {filteredCustomers.length === 0 ? (
                  <div style={{ color: '#6b7280', fontSize: 13 }}>No matches.</div>
                ) : (
                  filteredCustomers.map((c) => {
                    const active = c.id === customerId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCustomerId(c.id)}
                        style={{
                          textAlign: 'left',
                          padding: 12,
                          borderRadius: 12,
                          border: active ? '1px solid #111' : '1px solid #e5e7eb',
                          background: active ? '#111' : 'white',
                          color: active ? 'white' : '#111',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{c.name}</div>
                        {(c.phone || c.email) && (
                          <div style={{ marginTop: 4, fontSize: 12, color: active ? 'rgba(255,255,255,0.8)' : '#6b7280' }}>
                            {c.phone ?? ''}{c.phone && c.email ? ' - ' : ''}{c.email ?? ''}
                          </div>
                        )}
                        {c.address && (
                          <div style={{ marginTop: 4, fontSize: 12, color: active ? 'rgba(255,255,255,0.8)' : '#6b7280' }}>
                            {c.address}
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div>
              <div style={label}>Job title</div>
              <input
                placeholder="ex: Exterior repaint"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={label}>Notes</div>
              <textarea
                placeholder="Scope, paint colors, prep notes, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...inputStyle, height: 110, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {status === 'estimate_scheduled' ? (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={label}>Estimate date/time</div>
                  <input
                    type="datetime-local"
                    value={estimateDateLocal}
                    onChange={(e) => setEstimateDateLocal(e.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                    Defaults to 8:00 AM. Creates a 1 hour estimate event in Austin&apos;s work if enabled.
                  </div>
                </div>
              ) : status === 'scheduled' ? (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={label}>Scheduled date/time</div>
                  <input
                    type="datetime-local"
                    value={scheduledDateLocal}
                    onChange={(e) => setScheduledDateLocal(e.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                    Defaults to 8:00 AM. Creates an 8 hour scheduled event in Austin&apos;s work if enabled.
                  </div>
                </div>
              ) : (
                <div style={{ gridColumn: '1 / -1', color: '#6b7280', fontSize: 13 }}>
                  No date/time needed for this stage.
                </div>
              )}
            </div>

            {status === 'estimate_scheduled' ? (
              <>
                <div style={panel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 900 }}>Estimate calendar event</div>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={addEstimateToCalendar}
                        onChange={(e) => setAddEstimateToCalendar(e.target.checked)}
                      />
                      Add to Google
                    </label>
                  </div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    <input
                      value={estimateSummary}
                      onChange={(e) => setEstimateSummary(e.target.value)}
                      placeholder="Summary"
                      style={inputStyle}
                    />
                    <input
                      value={estimateLocation}
                      onChange={(e) => setEstimateLocation(e.target.value)}
                      placeholder="Location (auto from customer address)"
                      style={inputStyle}
                    />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={estimateHours}
                        onChange={(e) => setEstimateHours(Number(e.target.value))}
                        style={{ ...inputStyle, width: 120 }}
                      />
                      <div style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>hours</div>
                    </div>
                  </div>
                </div>

                <div style={panel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>Estimate scheduled email</div>
                    <button onClick={() => void openComposer('estimate_scheduled')} style={smallButton}>
                      Edit & send
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                    Uses the estimate date/time above to confirm the appointment.
                  </div>

                  {composeStage === 'estimate_scheduled' && (
                    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                      {composeLoading ? (
                        <div style={{ color: '#6b7280' }}>Loading template...</div>
                      ) : (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase' }}>
                            Subject
                          </div>
                          <input
                            value={composeSubject}
                            onChange={(e) => setComposeSubject(e.target.value)}
                            style={{ ...inputStyle, padding: '10px' }}
                          />
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase' }}>
                            Body
                          </div>
                          <textarea
                            value={composeBody}
                            onChange={(e) => setComposeBody(e.target.value)}
                            style={{ ...inputStyle, height: 160, resize: 'vertical', padding: '10px' }}
                          />
                          <div className="crm-actions" style={{ gap: 8, alignItems: 'center' }}>
                            <button
                              onClick={() => void save({ sendEstimateScheduled: true })}
                              disabled={saving || sendingStage === 'estimate_scheduled'}
                              style={{ ...smallButton, background: '#111', color: 'white', border: '1px solid #111' }}
                            >
                              {sendingStage === 'estimate_scheduled' ? 'Sending...' : 'Create job & send email'}
                            </button>
                            <button onClick={() => setComposeStage(null)} style={smallButton}>
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
              <div style={panel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 900 }}>Scheduled calendar event</div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={addScheduledToCalendar}
                      onChange={(e) => setAddScheduledToCalendar(e.target.checked)}
                    />
                    Add to Google
                  </label>
                </div>

                <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                  <input
                    value={scheduledSummary}
                    onChange={(e) => setScheduledSummary(e.target.value)}
                    placeholder="Summary"
                    style={inputStyle}
                  />
                  <input
                    value={scheduledLocation}
                    onChange={(e) => setScheduledLocation(e.target.value)}
                    placeholder="Location (auto from customer address)"
                    style={inputStyle}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={scheduledHours}
                      onChange={(e) => setScheduledHours(Number(e.target.value))}
                      style={{ ...inputStyle, width: 120 }}
                    />
                    <div style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>hours</div>
                  </div>
                </div>
              </div>
            ) : null}

            {error && <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>}
            {createdJobId && error && (
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                Job created.{' '}
                <Link href={`/crm/jobs/${createdJobId}`} style={{ color: '#111', fontWeight: 700 }}>
                  Open job
                </Link>
              </div>
            )}

            <button
              onClick={() => void save()}
              disabled={saving}
              style={{
                marginTop: 2,
                padding: '12px',
                borderRadius: 10,
                background: '#111',
                color: 'white',
                border: 'none',
                fontWeight: 800,
                cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Create job'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: 14,
  width: '100%',
}

const actionButton: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: 'white',
  color: '#111',
  fontWeight: 800,
  fontSize: 14,
}

const smallButton: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: 'white',
  color: '#111',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
}

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#6b7280',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const panel: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 12,
}
