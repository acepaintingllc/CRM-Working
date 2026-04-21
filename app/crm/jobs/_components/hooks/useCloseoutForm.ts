'use client'

import type { EmailSendStatus } from '@/lib/email/types'
import {
  fetchCloseoutData,
  saveCloseout,
  sendStageEmail,
  uploadPhoto,
  type JobDetail,
  type JobPhoto,
} from '@/lib/jobs/actions'
import { applyTemplate, buildJobEmailTemplateVars } from '@/lib/jobs/emailTemplate'
import {
  createDefaultPaintLogRow,
  type PaintLogRow,
} from '@/lib/jobs/paintLog'
import { useEffect, useMemo, useState } from 'react'

type EstimateCatalogPayload = {
  catalogs?: {
    paint_products?: Array<{ id?: string | null; label?: string | null }>
    color_codes?: Array<{ id?: string | null; label?: string | null }>
  }
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

function hasPaintRowValue(row: PaintLogRow) {
  return Boolean(
    row.where_used.trim() ||
      row.paint_product.trim() ||
      row.sheen.trim() ||
      row.color.trim() ||
      row.notes.trim()
  )
}

type UseCloseoutFormArgs = {
  jobId: string | null
  open: boolean
  loadCatalogs: (linkedEstimateId: string) => Promise<EstimateCatalogPayload | null>
  onSaved?: (result: { job?: Partial<JobDetail> | null; notice?: string | null }) => void
}

export function useCloseoutForm({
  jobId,
  open,
  loadCatalogs,
  onSaved,
}: UseCloseoutFormArgs) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [job, setJob] = useState<JobDetail | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [closeoutNotes, setCloseoutNotes] = useState('')
  const [paintRows, setPaintRows] = useState<PaintLogRow[]>([createDefaultPaintLogRow()])
  const [afterPhotos, setAfterPhotos] = useState<JobPhoto[]>([])

  const [paintOptions, setPaintOptions] = useState<string[]>([])
  const [colorOptions, setColorOptions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [emailNotice, setEmailNotice] = useState<string | null>(null)
  const [photoNotice, setPhotoNotice] = useState<string | null>(null)
  const [templateMissing, setTemplateMissing] = useState(false)
  const [emailSkipped, setEmailSkipped] = useState(false)

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
      setPaintRows([createDefaultPaintLogRow()])
      setAfterPhotos([])
      setPaintOptions([])
      setColorOptions([])
      setJob(null)
      setSubject('')
      setBody('')
      setCloseoutNotes('')

      try {
        const closeoutData = await fetchCloseoutData(jobId)
        if (cancelled) return

        const loadedJob = closeoutData.job
        setJob(loadedJob)
        setCloseoutNotes(loadedJob.closeout_notes ?? '')

        const template = closeoutData.template
        if (!template) {
          setTemplateMissing(true)
        }

        const vars = buildJobEmailTemplateVars({
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
        })

        setSubject(template ? applyTemplate(template.subject ?? '', vars) : '')
        setBody(template ? applyTemplate(template.body ?? '', vars) : '')

        const rows = closeoutData.paintLogs
        setPaintRows(rows.length > 0 ? rows : [createDefaultPaintLogRow()])

        const photoRows = closeoutData.afterPhotos
        setAfterPhotos(photoRows)

        const nextPaintOptions = new Set<string>()
        const nextColorOptions = new Set<string>()
        for (const row of rows) {
          if (row.paint_product?.trim()) nextPaintOptions.add(row.paint_product.trim())
          if (row.color?.trim()) nextColorOptions.add(row.color.trim())
        }

        const linkedEstimateId =
          loadedJob.linked_estimate_id && typeof loadedJob.linked_estimate_id === 'string'
            ? loadedJob.linked_estimate_id
            : null

        if (linkedEstimateId) {
          const catalogsPayload = await loadCatalogs(linkedEstimateId)
          if (catalogsPayload?.catalogs) {
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
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load completion checklist.'
          )
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [jobId, loadCatalogs, open])

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

  const addRow = () => {
    setPaintRows((prev) => [...prev, createDefaultPaintLogRow()])
  }

  const sendReviewEmail = async () => {
    if (!jobId || !canSendEmail || sendingEmail) return

    setSendingEmail(true)
    setError(null)
    setEmailNotice(null)
    setEmailSkipped(false)

    try {
      const result = await sendStageEmail(jobId, {
        stage: 'completed',
        subject,
        body,
      })

      if (result.job) {
        setJob((prev) => (prev ? { ...prev, ...(result.job as Partial<JobDetail>) } : prev))
        onSaved?.({
          job: result.job,
          notice: result.warning ?? null,
        })
      }

      const status = (result.status as EmailSendStatus | undefined) ?? 'sent'
      const replayed = Boolean(result.replayed)
      if (replayed || status === 'replayed') {
        setEmailNotice(
          result.warning ?? 'This send request was already processed. No duplicate email was sent.'
        )
        return
      }

      setEmailNotice(result.warning ?? 'Review email sent.')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send review email.')
    } finally {
      setSendingEmail(false)
    }
  }

  const skipEmail = () => {
    setEmailSkipped(true)
    setEmailNotice('Review email skipped for now.')
  }

  const uploadCloseoutPhoto = async (file: File) => {
    if (!jobId) return false

    setUploadingPhoto(true)
    setPhotoNotice(null)
    setError(null)

    const localId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    try {
      const result = await uploadPhoto(jobId, {
        file,
        clientLocalId: `closeout-${localId}`,
        capturedAt: new Date().toISOString(),
      })

      if (result.photo) {
        setAfterPhotos((prev) => [result.photo as JobPhoto, ...prev])
      }
      setPhotoNotice('Photo added.')
      setUploadingPhoto(false)
      return true
    } catch (uploadError) {
      setUploadingPhoto(false)
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload photo.')
      return false
    }
  }

  const saveAndClose = async () => {
    if (!jobId || saving) return false

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

    try {
      const result = await saveCloseout(jobId, {
        rows: rowsToSave,
        closeout_notes: closeoutNotes.trim() || null,
      })
      setPaintRows(result.paintLogs.length > 0 ? result.paintLogs : [createDefaultPaintLogRow()])
      onSaved?.({
        job: result.job,
        notice: 'Closeout saved.',
      })
      setSaving(false)
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save closeout.')
      setSaving(false)
      return false
    }
  }

  return {
    job,
    loading,
    saving,
    sendingEmail,
    uploadingPhoto,
    subject,
    setSubject,
    body,
    setBody,
    closeoutNotes,
    setCloseoutNotes,
    paintRows,
    updateRow,
    removeRow,
    addRow,
    afterPhotos,
    paintOptions,
    colorOptions,
    error,
    emailNotice,
    photoNotice,
    templateMissing,
    emailSkipped,
    canSendEmail,
    sendReviewEmail,
    skipEmail,
    uploadCloseoutPhoto,
    saveAndClose,
    defaultWhereUsedOptions,
    defaultSheenOptions,
  }
}
