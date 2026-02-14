'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type JobDetail = {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  customer_email: string | null
  customer_phone: string | null
  title: string
  description: string | null
  status: string
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  scheduled_end_date: string | null
  completed_at: string | null
  created_at?: string | null
}

type EmailTemplate = {
  stage: string
  subject: string | null
  body: string | null
}

export default function JobDetailPage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const searchParams = useSearchParams()

  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [estimateFile, setEstimateFile] = useState<{
    id: string
    name: string
    webViewLink: string | null
  } | null>(null)
  const [manualFile, setManualFile] = useState<File | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [composeStage, setComposeStage] = useState<string | null>(null)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeLoading, setComposeLoading] = useState(false)
  const [sendingStage, setSendingStage] = useState<string | null>(null)
  const [creatingEstimateSheet, setCreatingEstimateSheet] = useState(false)

  useEffect(() => {
    if (typeof id !== 'string' || !id) {
      setJob(null)
      setLoading(false)
      setError('Missing job id in URL.')
      setNotice(null)
      return
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      setNotice(null)
      const res = await fetch(`/api/jobs/${id}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        setJob(null)
        setLoading(false)
        return
      }
      setJob(payload?.job ?? null)
      setEstimateFile(null)
      const fileRes = await fetch(`/api/jobs/${id}/estimate-file`, { cache: 'no-store' })
      const filePayload = await fileRes.json().catch(() => null)
      if (fileRes.ok && filePayload?.file) {
        setEstimateFile({
          id: filePayload.file.id,
          name: filePayload.file.name,
          webViewLink: filePayload.file.webViewLink ?? null,
        })
      }
      setLoading(false)
    }

    void load()
  }, [id])

  useEffect(() => {
    const stage = searchParams.get('compose')
    if (stage) {
      void openComposer(stage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const copy = async (label: string, value: string | null | undefined) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const el = document.createElement('textarea')
      el.value = value
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setNotice(`${label} copied`)
    window.setTimeout(() => setNotice(null), 1200)
  }

  const patchJob = async (patch: Record<string, unknown>) => {
    if (!id || typeof id !== 'string') return
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    setJob((prev) => (prev ? { ...prev, ...payload.job } : prev))
  }

  const nowIso = () => new Date().toISOString()

  const createEstimateSheet = async () => {
    if (!id || typeof id !== 'string') return
    setCreatingEstimateSheet(true)
    setError(null)
    setNotice(null)

    const res = await fetch(`/api/jobs/${id}/estimate-sheet`, { method: 'POST' })
    const payload = await res.json().catch(() => null)
    setCreatingEstimateSheet(false)

    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }

    const url = payload?.sheet?.webViewLink ?? payload?.sheet?.editUrl ?? null
    if (typeof url === 'string' && url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    setNotice('Estimate sheet created')
    window.setTimeout(() => setNotice(null), 2000)
  }

  const deleteJob = async () => {
    if (!id || typeof id !== 'string') return
    const ok = window.confirm('Delete this job? This cannot be undone.')
    if (!ok) return
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    const payload = await res.json().catch(() => null)
    setDeleting(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    router.push('/crm/jobs')
  }

  const openComposer = async (stage: string) => {
    setComposeStage(stage)
    setComposeLoading(true)
    setError(null)
    const res = await fetch('/api/email-templates', { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    setComposeLoading(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    const templates = (payload?.templates ?? []) as EmailTemplate[]
    const row = templates.find((t) => t.stage === stage)
    const subject = applyTemplate(row?.subject ?? '')
    const body = applyTemplate(row?.body ?? '')
    setComposeSubject(subject)
    setComposeBody(body)
  }

  const sendComposed = async () => {
    if (!composeStage) return
    if (!id || typeof id !== 'string') return
    setSendingStage(composeStage)
    setError(null)

    if (composeStage === 'estimate_sent') {
      const form = new FormData()
      form.set('subject', composeSubject)
      form.set('body', composeBody)
      if (manualFile) form.set('file', manualFile)
      const res = await fetch(`/api/jobs/${id}/send-estimate`, { method: 'POST', body: form })
      const payload = await res.json().catch(() => null)
      setSendingStage(null)
      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        return
      }
      setNotice('Estimate email sent')
      return
    }

    const res = await fetch(`/api/jobs/${id}/send-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: composeStage, subject: composeSubject, body: composeBody }),
    })
    const payload = await res.json().catch(() => null)
    setSendingStage(null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    if (composeStage === 'scheduled') {
      setJob((prev) => (prev ? { ...prev, status: 'scheduled' } : prev))
    }
    setNotice('Email sent')
  }

  const applyTemplate = (value: string) => {
    const vars: Record<string, string> = {
      customerName: job?.customer_name ?? '',
      customerEmail: job?.customer_email ?? '',
      customerPhone: job?.customer_phone ?? '',
      customerAddress: job?.customer_address ?? '',
      jobTitle: job?.title ?? '',
      estimateDate: job?.estimate_date ? formatDate(job?.estimate_date) : '',
      scheduledDate: job?.scheduled_date ? formatDate(job?.scheduled_date) : '',
      scheduledBlocks:
        job?.scheduled_date && job?.scheduled_end_date
          ? `${formatDate(job.scheduled_date)} - ${formatDate(job.scheduled_end_date)}`
          : '',
      estimateFileName: manualFile?.name ?? estimateFile?.name ?? '',
      estimateFileLink: estimateFile?.webViewLink ?? '',
      reviewLink: process.env.NEXT_PUBLIC_REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
      customer_name: job?.customer_name ?? '',
      customer_email: job?.customer_email ?? '',
      customer_phone: job?.customer_phone ?? '',
      customer_address: job?.customer_address ?? '',
      job_title: job?.title ?? '',
      estimate_date: job?.estimate_date ? formatDate(job?.estimate_date) : '',
      scheduled_date: job?.scheduled_date ? formatDate(job?.scheduled_date) : '',
      scheduled_blocks:
        job?.scheduled_date && job?.scheduled_end_date
          ? `${formatDate(job.scheduled_date)} - ${formatDate(job.scheduled_end_date)}`
          : '',
      estimate_file_name: manualFile?.name ?? estimateFile?.name ?? '',
      estimate_file_link: estimateFile?.webViewLink ?? '',
      review_link: process.env.NEXT_PUBLIC_REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
    }
    return Object.entries(vars).reduce(
      (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val ?? ''),
      value
    )
  }

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '-'
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  const formatRange = (start?: string | null, end?: string | null) => {
    if (!start && !end) return '-'
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`
    if (start) return `${formatDate(start)} -`
    return `- ${formatDate(end)}`
  }

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const toLocalInputValue = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
      d.getHours()
    )}:${pad2(d.getMinutes())}`

  const next8amLocalValue = () => {
    const now = new Date()
    const next = new Date(now)
    if (now.getHours() >= 8) next.setDate(next.getDate() + 1)
    next.setHours(8, 0, 0, 0)
    return toLocalInputValue(next)
  }

  const formatStatus = (value: string | null | undefined) => {
    const s = (value ?? '').replaceAll('_', ' ').trim()
    if (!s) return '-'
    return s.replace(/\b\w/g, (m) => m.toUpperCase())
  }

  const renderRow = (
    label: string,
    value: string | null | undefined,
    actions?: React.ReactNode
  ) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#6b7280', letterSpacing: 0.6, fontWeight: 800 }}>
        {label}
      </div>
      <div className="crm-row-body" style={{ marginTop: 2 }}>
        <div style={{ fontSize: 16, fontWeight: 600, flex: '1 1 auto' }}>{value ?? '-'}</div>
        {actions}
      </div>
    </div>
  )

  const canSendScheduledEmail = Boolean(job?.scheduled_date || job?.scheduled_end_date)

  return (
    <div className="crm-page" style={{ maxWidth: 900, margin: '0 auto', paddingTop: 12 }}>
      <div
        className="crm-topbar"
        style={{
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Job details</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Full job overview and schedule.</p>
        </div>
        <button
          onClick={() => router.back()}
          style={{
            border: '1px solid #d1d5db',
            borderRadius: 10,
            background: 'white',
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>

      <div className="crm-card" style={{ borderRadius: 12, padding: 20 }}>
        {loading && <div style={{ color: '#6b7280' }}>Loading job...</div>}
        {!loading && error && (
          <div style={{ marginTop: 10, background: '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: 12, color: '#991b1b' }}>
            {error}
          </div>
        )}
        {!loading && notice && (
          <div style={{ marginTop: 10, background: '#fff', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12, color: '#166534' }}>
            {notice}
          </div>
        )}
        {!loading && !error && !job && <div style={{ color: '#6b7280' }}>Job not found.</div>}

        {!loading && job && (
          <>
            <div className="crm-actions" style={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.2 }}>{job.title}</div>
              <div style={statusPill}>{formatStatus(job.status)}</div>
            </div>
            <div className="crm-actions" style={{ marginTop: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase' }}>
                Job stage
              </div>
              <select
                value={job.status}
                onChange={(e) => void patchJob({ status: e.target.value })}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: 10,
                  padding: '6px 10px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'white',
                }}
              >
                <option value="estimate_scheduled">Estimate scheduled</option>
                <option value="estimate_sent">Estimate sent</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div className="crm-actions" style={{ marginTop: 10 }}>
              <button
                onClick={() => void deleteJob()}
                style={{ ...smallButton, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete job'}
              </button>
            </div>
            {renderRow('Customer', job.customer_name ?? job.customer_id)}
            {renderRow(
              'Address',
              job.customer_address,
              job.customer_address ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customer_address)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...actionButton,
                    display: 'inline-flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                  }}
                >
                  Google Maps
                </a>
              ) : null
            )}
            {renderRow(
              'Email',
              job.customer_email,
              job.customer_email ? (
                <button onClick={() => void copy('Email', job.customer_email)} style={actionButton}>
                  Copy
                </button>
              ) : null
            )}
            {renderRow(
              'Phone',
              job.customer_phone,
              job.customer_phone ? (
                <button onClick={() => void copy('Phone', job.customer_phone)} style={actionButton}>
                  Copy
                </button>
              ) : null
            )}
            {renderRow('Notes', job.description)}
            {renderRow(
              'Estimate date',
              formatDate(job.estimate_date),
              <input
                type="datetime-local"
                defaultValue={
                  job.estimate_date
                    ? toLocalInputValue(new Date(job.estimate_date))
                    : next8amLocalValue()
                }
                onChange={(e) => {
                  if (!e.target.value) return
                  const iso = new Date(e.target.value).toISOString()
                  void patchJob({ estimate_date: iso })
                }}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '4px 6px',
                  fontSize: 12,
                }}
              />
            )}
            {renderRow('Estimate sent', formatDate(job.estimate_sent_at))}
            {estimateFile &&
              renderRow(
                'Estimate PDF',
                estimateFile.name,
                estimateFile.webViewLink ? (
                  <a
                    href={estimateFile.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      ...actionButton,
                      display: 'inline-flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    Open
                  </a>
                ) : null
              )}
            {renderRow('Scheduled job date range', formatRange(job.scheduled_date, job.scheduled_end_date))}
            {renderRow('Completed at', formatDate(job.completed_at))}
            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              <div className="crm-actions" style={{ gap: 8, alignItems: 'center' }}>
              {job.status === 'estimate_scheduled' && (
                <>
                  <Link
                    href={`/crm/jobs/${id}/simple-estimate`}
                    style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                  >
                    Build simple estimate
                  </Link>
                  <button
                    onClick={() => void createEstimateSheet()}
                    disabled={creatingEstimateSheet}
                    style={smallButton}
                  >
                    {creatingEstimateSheet ? 'Creating estimate sheet...' : 'Create estimate sheet'}
                  </button>
                  <button
                    onClick={() => void openComposer('estimate_scheduled')}
                    style={smallButton}
                  >
                    Edit & send estimate scheduled
                  </button>
                </>
              )}
                {job.status !== 'scheduled' && (
                  <>
                    <button onClick={() => void openComposer('estimate_sent')} style={smallButton}>
                      Edit & send estimate
                    </button>
                    <label style={{ ...smallButton, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="file"
                        accept="application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          setManualFile(file)
                        }}
                      />
                      Upload estimate PDF
                    </label>
                    {manualFile && (
                      <>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{manualFile.name}</div>
                        <button onClick={() => setManualFile(null)} style={{ ...smallButton, background: '#fff' }}>
                          Clear upload
                        </button>
                      </>
                    )}
                  </>
                )}
                {job.status !== 'estimate_scheduled' && (
                  <Link
                    href={`/crm/jobs/${id}/schedule`}
                    style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                  >
                    Schedule job
                  </Link>
                )}
                {canSendScheduledEmail && (
                  <button
                    onClick={() => void openComposer('scheduled')}
                    style={smallButton}
                  >
                    Edit & send scheduled email
                  </button>
                )}
              {job.status === 'estimate_scheduled' && (
                <>
                  <button
                    onClick={() => void patchJob({ estimate_sent_at: nowIso() })}
                    style={smallButton}
                  >
                    Mark estimate sent
                  </button>
                </>
              )}
              {job.status === 'estimate_sent' && (
                <>
                  <button
                    onClick={() => void openComposer('follow_up')}
                    style={smallButton}
                  >
                    Edit & send follow up
                  </button>
                  <button
                    onClick={() => void patchJob({ status: 'lost' })}
                    style={{ ...smallButton, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}
                  >
                    Mark lost
                  </button>
                </>
              )}
              {job.status === 'scheduled' && (
                <>
                  <button
                    onClick={() => void patchJob({ completed_at: nowIso() })}
                    style={smallButton}
                  >
                    Mark completed
                  </button>
                </>
              )}
              {job.status === 'completed' && (
                <button
                  onClick={() => void openComposer('completed')}
                  style={smallButton}
                >
                  Edit & send completed
                </button>
              )}
              </div>
            {composeStage && (
              <div style={{ marginTop: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Email editor</div>
                {composeLoading ? (
                  <div style={{ color: '#6b7280' }}>Loading template...</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
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
                    {composeStage === 'estimate_sent' && (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Attachment: {manualFile?.name ?? estimateFile?.name ?? 'Not found'}
                      </div>
                    )}
                    {composeStage === 'follow_up' && (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Attachment: {estimateFile?.name ?? 'Latest estimate from Drive'}
                      </div>
                    )}
                    <div className="crm-actions" style={{ gap: 8 }}>
                      <button
                        onClick={() => void sendComposed()}
                        disabled={sendingStage === composeStage}
                        style={{ ...smallButton, background: '#111', color: 'white', border: '1px solid #111' }}
                      >
                        {sendingStage === composeStage ? 'Sending...' : 'Send email'}
                      </button>
                      <button
                        onClick={() => setComposeStage(null)}
                        style={smallButton}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </>
        )}
      </div>

      <Link
        href="/crm/jobs"
        style={{
          display: 'inline-flex',
          marginTop: 16,
          padding: '10px 14px',
          borderRadius: 10,
          background: '#111',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 700,
        }}
      >
        Back to jobs
      </Link>
    </div>
  )
}

const actionButton: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 10,
  background: 'white',
  padding: '6px 10px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
}

const smallButton: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: 'white',
  color: '#111',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 10,
  fontSize: 14,
  width: '100%',
}

const statusPill: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  background: '#f3f4f6',
  color: '#111',
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0.3,
}
