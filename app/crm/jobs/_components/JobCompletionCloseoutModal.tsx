'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import type { EmailSendStatus } from '@/lib/email/types'
import { Mail, Plus, Send, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type JobCloseoutDetails = {
  id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  title: string
  estimate_date: string | null
  scheduled_date: string | null
  scheduled_end_date: string | null
  completed_at: string | null
  completed_email_sent_at?: string | null
  linked_estimate_id?: string | null
  closeout_notes?: string | null
}

type EmailTemplate = {
  stage: string
  subject: string | null
  body: string | null
}

export type PaintLogRow = {
  id?: string
  sort_order?: number
  where_used: string
  paint_product: string
  sheen: string
  color: string
  notes: string
}

type PhotoRow = {
  id: string
  url: string
  caption: string | null
  captured_at: string | null
  uploaded_at: string | null
  created_at: string | null
}

type EstimateCatalogPayload = {
  catalogs?: {
    paint_products?: Array<{ id?: string | null; label?: string | null }>
    color_codes?: Array<{ id?: string | null; label?: string | null }>
  }
}

type CloseoutSavedResult = {
  job?: Partial<JobCloseoutDetails> | null
  notice?: string | null
}

type JobCompletionCloseoutModalProps = {
  jobId: string | null
  open: boolean
  onClose: () => void
  onSaved?: (result: CloseoutSavedResult) => void
}

function defaultPaintRow(): PaintLogRow {
  return {
    where_used: '',
    paint_product: '',
    sheen: '',
    color: '',
    notes: '',
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatRange(start: string | null | undefined, end: string | null | undefined) {
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`
  if (start) return formatDate(start)
  if (end) return formatDate(end)
  return ''
}

function withAliases(vars: Record<string, string | null | undefined>) {
  return {
    ...vars,
    customer_name: vars.customerName,
    customer_email: vars.customerEmail,
    customer_phone: vars.customerPhone,
    customer_address: vars.customerAddress,
    job_title: vars.jobTitle,
    estimate_date: vars.estimateDate,
    scheduled_date: vars.scheduledDate,
    scheduled_blocks: vars.scheduledBlocks,
    estimate_file_name: vars.estimateFileName,
    estimate_file_link: vars.estimateFileLink,
    review_link: vars.reviewLink,
  }
}

function applyTemplate(template: string, vars: Record<string, string | null | undefined>) {
  let output = template
  for (const [key, value] of Object.entries(vars)) {
    output = output.replaceAll(`{{${key}}}`, value ?? '')
  }
  return output
}

function createIdempotencyKey(jobId: string) {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `stage:completed:job:${jobId}:${suffix}`
}

function hasPaintRowValue(row: PaintLogRow) {
  return Boolean(
    row.where_used.trim() ||
      row.paint_product.trim() ||
      row.sheen.trim() ||
      row.color.trim() ||
      row.notes.trim()
  )
}

const defaultWhereUsedOptions = [
  'Walls',
  'Ceilings',
  'Trim',
  'Doors',
  'Door Frames',
  'Cabinets',
  'Exterior Siding',
  'Exterior Trim',
  'Fence',
]

const defaultSheenOptions = ['Flat', 'Matte', 'Eggshell', 'Satin', 'Semi-Gloss', 'Gloss']

export default function JobCompletionCloseoutModal({
  jobId,
  open,
  onClose,
  onSaved,
}: JobCompletionCloseoutModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [job, setJob] = useState<JobCloseoutDetails | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [closeoutNotes, setCloseoutNotes] = useState('')
  const [paintRows, setPaintRows] = useState<PaintLogRow[]>([defaultPaintRow()])
  const [afterPhotos, setAfterPhotos] = useState<PhotoRow[]>([])

  const [paintOptions, setPaintOptions] = useState<string[]>([])
  const [colorOptions, setColorOptions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [emailNotice, setEmailNotice] = useState<string | null>(null)
  const [photoNotice, setPhotoNotice] = useState<string | null>(null)
  const [templateMissing, setTemplateMissing] = useState(false)
  const [emailSkipped, setEmailSkipped] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const emailSendLockRef = useRef(false)

  const canSendEmail = useMemo(() => {
    if (!job) return false
    if (!job.customer_email) return false
    if (templateMissing) return false
    if (sendingEmail || loading) return false
    return true
  }, [job, templateMissing, sendingEmail, loading])

  useEffect(() => {
    if (!open || !jobId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setSaving(false)
      setSendingEmail(false)
      setUploadingPhoto(false)
      setError(null)
      setEmailNotice(null)
      setPhotoNotice(null)
      setTemplateMissing(false)
      setEmailSkipped(false)
      setPaintRows([defaultPaintRow()])
      setAfterPhotos([])
      setPaintOptions([])
      setColorOptions([])
      setJob(null)
      setSubject('')
      setBody('')
      setCloseoutNotes('')

      try {
        const [templatesRes, jobRes, paintLogsRes, photosRes, estimateOptionsRes] = await Promise.all([
          authedFetch('/api/email-templates', { cache: 'no-store' }),
          authedFetch(`/api/jobs/${jobId}`, { cache: 'no-store' }),
          authedFetch(`/api/jobs/${jobId}/paint-logs`, { cache: 'no-store' }),
          authedFetch(`/api/jobs/${jobId}/site-photos`, { cache: 'no-store' }),
          authedFetch('/api/estimate-options', { cache: 'no-store' }),
        ])

        const templatesPayload = await templatesRes.json().catch(() => null)
        const jobPayload = await jobRes.json().catch(() => null)
        const paintLogsPayload = await paintLogsRes.json().catch(() => null)
        const photosPayload = await photosRes.json().catch(() => null)
        const estimateOptionsPayload = await estimateOptionsRes.json().catch(() => null)

        if (cancelled) return

        if (!jobRes.ok) {
          setError(jobPayload?.error ?? jobRes.statusText)
          setLoading(false)
          return
        }

        const loadedJob = (jobPayload?.job ?? null) as JobCloseoutDetails | null
        if (!loadedJob) {
          setError('Job not found.')
          setLoading(false)
          return
        }
        setJob(loadedJob)
        setCloseoutNotes(loadedJob.closeout_notes ?? '')

        const template = ((templatesPayload?.templates ?? []) as EmailTemplate[]).find(
          (row) => row.stage === 'completed'
        )
        if (!template) {
          setTemplateMissing(true)
        }

        const vars = withAliases({
          customerName: loadedJob.customer_name ?? '',
          customerEmail: loadedJob.customer_email ?? '',
          customerPhone: loadedJob.customer_phone ?? '',
          customerAddress: loadedJob.customer_address ?? '',
          jobTitle: loadedJob.title ?? '',
          estimateDate: formatDate(loadedJob.estimate_date),
          scheduledDate: formatDate(loadedJob.scheduled_date),
          scheduledBlocks: formatRange(loadedJob.scheduled_date, loadedJob.scheduled_end_date),
          estimateFileName: '',
          estimateFileLink: '',
          reviewLink: process.env.NEXT_PUBLIC_REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
        })

        setSubject(template ? applyTemplate(template.subject ?? '', vars) : '')
        setBody(template ? applyTemplate(template.body ?? '', vars) : '')

        const rows = Array.isArray(paintLogsPayload?.rows)
          ? (paintLogsPayload.rows as PaintLogRow[]).map((row) => ({
              id: row.id,
              sort_order: row.sort_order,
              where_used: row.where_used ?? '',
              paint_product: row.paint_product ?? '',
              sheen: row.sheen ?? '',
              color: row.color ?? '',
              notes: row.notes ?? '',
            }))
          : []
        setPaintRows(rows.length > 0 ? rows : [defaultPaintRow()])

        const photoRows = Array.isArray(photosPayload?.photos) ? (photosPayload.photos as PhotoRow[]) : []
        setAfterPhotos(photoRows)

        const basePaintOptions = [
          ...((estimateOptionsPayload?.wallPaintOptions ?? []) as string[]),
          ...((estimateOptionsPayload?.ceilingPaintOptions ?? []) as string[]),
          ...((estimateOptionsPayload?.trimPaintOptions ?? []) as string[]),
        ].filter(Boolean)

        const nextPaintOptions = new Set(basePaintOptions)
        const nextColorOptions = new Set<string>()

        const linkedEstimateId =
          loadedJob.linked_estimate_id && typeof loadedJob.linked_estimate_id === 'string'
            ? loadedJob.linked_estimate_id
            : null

        if (linkedEstimateId) {
          const catalogsRes = await authedFetch(`/api/estimates/${linkedEstimateId}/catalogs`, {
            cache: 'no-store',
          })
          const catalogsPayload = (await catalogsRes.json().catch(() => null)) as EstimateCatalogPayload | null
          if (catalogsRes.ok && catalogsPayload?.catalogs) {
            for (const product of catalogsPayload.catalogs.paint_products ?? []) {
              const label = (product?.label ?? '').trim()
              const id = (product?.id ?? '').trim()
              if (label) nextPaintOptions.add(label)
              if (id) nextPaintOptions.add(id)
              if (label && id) nextPaintOptions.add(`${id} - ${label}`)
            }
            for (const color of catalogsPayload.catalogs.color_codes ?? []) {
              const label = (color?.label ?? '').trim()
              const id = (color?.id ?? '').trim()
              if (id && label) nextColorOptions.add(`${id} - ${label}`)
              if (id) nextColorOptions.add(id)
              if (label) nextColorOptions.add(label)
            }
          }
        }

        setPaintOptions(Array.from(nextPaintOptions).sort((a, b) => a.localeCompare(b)))
        setColorOptions(Array.from(nextColorOptions).sort((a, b) => a.localeCompare(b)))
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('Failed to load completion checklist.')
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, jobId])

  if (!open || !jobId) return null

  const updateRow = (index: number, patch: Partial<PaintLogRow>) => {
    setPaintRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    )
  }

  const removeRow = (index: number) => {
    setPaintRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  const sendReviewEmail = async () => {
    if (!jobId || !canSendEmail || emailSendLockRef.current) return

    emailSendLockRef.current = true
    setSendingEmail(true)
    setError(null)
    setEmailNotice(null)
    setEmailSkipped(false)

    try {
      const res = await authedFetch(`/api/jobs/${jobId}/send-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'completed',
          subject,
          body,
          idempotency_key: createIdempotencyKey(jobId),
        }),
      })
      const payload = await res.json().catch(() => null)
      setSendingEmail(false)

      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        return
      }

      if (payload?.job) {
        setJob((prev) => (prev ? { ...prev, ...(payload.job as Partial<JobCloseoutDetails>) } : prev))
        onSaved?.({
          job: (payload.job ?? null) as Partial<JobCloseoutDetails> | null,
          notice: payload?.warning ?? null,
        })
      }

      const status = (payload?.status as EmailSendStatus | undefined) ?? 'sent'
      const replayed = Boolean(payload?.replayed)
      if (replayed || status === 'replayed') {
        setEmailNotice(
          (payload?.warning as string | null | undefined) ??
            'This send request was already processed. No duplicate email was sent.'
        )
        return
      }

      setEmailNotice((payload?.warning as string | null | undefined) ?? 'Review email sent.')
    } finally {
      emailSendLockRef.current = false
      setSendingEmail(false)
    }
  }

  const handleSkipEmail = () => {
    setEmailSkipped(true)
    setEmailNotice('Review email skipped for now.')
  }

  const handlePhotoPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file || !jobId) return

    setUploadingPhoto(true)
    setPhotoNotice(null)
    setError(null)

    const form = new FormData()
    form.append('file', file)
    const localId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    form.append('client_local_id', `closeout-${localId}`)
    form.append('captured_at', new Date().toISOString())

    const res = await authedFetch(`/api/jobs/${jobId}/site-photos`, {
      method: 'POST',
      body: form,
    })
    const payload = await res.json().catch(() => null)
    setUploadingPhoto(false)

    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }

    if (payload?.photo) {
      setAfterPhotos((prev) => [payload.photo as PhotoRow, ...prev])
    }
    setPhotoNotice('Photo added.')
    event.target.value = ''
  }

  const saveAndClose = async () => {
    if (!jobId || saving) return

    setSaving(true)
    setError(null)

    const rowsToSave = paintRows
      .filter(hasPaintRowValue)
      .map((row) => ({
        where_used: row.where_used.trim(),
        paint_product: row.paint_product.trim(),
        sheen: row.sheen.trim(),
        color: row.color.trim(),
        notes: row.notes.trim(),
      }))

    const [paintRes, notesRes] = await Promise.all([
      authedFetch(`/api/jobs/${jobId}/paint-logs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsToSave }),
      }),
      authedFetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closeout_notes: closeoutNotes.trim() || null }),
      }),
    ])

    const paintPayload = await paintRes.json().catch(() => null)
    const notesPayload = await notesRes.json().catch(() => null)

    if (!paintRes.ok) {
      setError(paintPayload?.error ?? paintRes.statusText)
      setSaving(false)
      return
    }
    if (!notesRes.ok) {
      setError(notesPayload?.error ?? notesRes.statusText)
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved?.({
      job: (notesPayload?.job ?? null) as Partial<JobCloseoutDetails> | null,
      notice: 'Closeout saved.',
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-closeout-title"
        className="w-full max-w-5xl rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
              Job closeout
            </div>
            <h2 id="job-closeout-title" className="mt-1 text-xl font-extrabold text-gray-900">
              Completed checklist
            </h2>
            <div className="mt-1 text-sm text-gray-600">
              {job?.title ?? 'Loading job...'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
            aria-label="Close closeout modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <section className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 text-sm font-extrabold text-gray-900">Review email</div>
            <div className="text-xs text-gray-600">
              {job?.customer_email ? `To: ${job.customer_email}` : 'Customer email missing'}
            </div>
            {templateMissing && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                Missing completed/review email template.
              </div>
            )}
            {loading ? (
              <div className="mt-3 text-sm text-gray-600">Loading composer...</div>
            ) : (
              <div className="mt-3 grid gap-2">
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 focus:ring-2"
                />
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Body"
                  className="min-h-[120px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 focus:ring-2"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void sendReviewEmail()}
                    disabled={!canSendEmail}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${
                      canSendEmail
                        ? 'border border-black bg-black text-white'
                        : 'cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Send size={14} />
                    <span>{sendingEmail ? 'Sending...' : 'Send review email'}</span>
                  </button>
                  <button
                    onClick={handleSkipEmail}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900"
                  >
                    <Mail size={14} />
                    <span>Skip for now</span>
                  </button>
                  {job?.completed_email_sent_at && (
                    <span className="text-xs text-green-700">
                      Sent: {formatDate(job.completed_email_sent_at)}
                    </span>
                  )}
                </div>
                {(emailNotice || emailSkipped) && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-800">
                    {emailNotice}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-gray-900">Paint log</div>
              <button
                onClick={() => setPaintRows((prev) => [...prev, defaultPaintRow()])}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-900"
              >
                <Plus size={14} />
                <span>Add row</span>
              </button>
            </div>

            <datalist id={`closeout-where-${jobId}`}>
              {defaultWhereUsedOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <datalist id={`closeout-product-${jobId}`}>
              {paintOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <datalist id={`closeout-sheen-${jobId}`}>
              {defaultSheenOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <datalist id={`closeout-color-${jobId}`}>
              {colorOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <div className="grid gap-2">
              {paintRows.map((row, index) => (
                <div key={row.id ?? `row-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-extrabold text-gray-600 uppercase">Row {index + 1}</div>
                    {index > 0 && (
                      <button
                        onClick={() => removeRow(index)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700"
                      >
                        <Trash2 size={12} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={row.where_used}
                      onChange={(event) => updateRow(index, { where_used: event.target.value })}
                      list={`closeout-where-${jobId}`}
                      placeholder="Where used"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                    <input
                      value={row.paint_product}
                      onChange={(event) => updateRow(index, { paint_product: event.target.value })}
                      list={`closeout-product-${jobId}`}
                      placeholder="Paint product"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                    <input
                      value={row.sheen}
                      onChange={(event) => updateRow(index, { sheen: event.target.value })}
                      list={`closeout-sheen-${jobId}`}
                      placeholder="Sheen"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                    <input
                      value={row.color}
                      onChange={(event) => updateRow(index, { color: event.target.value })}
                      list={`closeout-color-${jobId}`}
                      placeholder="Color"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                    <textarea
                      value={row.notes}
                      onChange={(event) => updateRow(index, { notes: event.target.value })}
                      placeholder="Notes"
                      className="min-h-[70px] w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 md:col-span-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 text-sm font-extrabold text-gray-900">Optional photo</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handlePhotoPick(event)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900"
              >
                <Upload size={14} />
                <span>{uploadingPhoto ? 'Uploading...' : 'Add photo'}</span>
              </button>
              {photoNotice && <span className="text-xs text-green-700">{photoNotice}</span>}
            </div>
            {afterPhotos.length > 0 && (
              <div className="mt-2 grid gap-1 text-xs">
                {afterPhotos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-700 underline"
                  >
                    After photo · {formatDate(photo.captured_at ?? photo.created_at ?? photo.uploaded_at)}
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-2 text-sm font-extrabold text-gray-900">Closeout notes</div>
            <textarea
              value={closeoutNotes}
              onChange={(event) => setCloseoutNotes(event.target.value)}
              placeholder="Internal closeout notes..."
              className="min-h-[120px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={() => void saveAndClose()}
            disabled={saving || loading}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ${
              saving || loading
                ? 'cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-400'
                : 'border border-black bg-black text-white'
            }`}
          >
            {saving ? 'Saving...' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
