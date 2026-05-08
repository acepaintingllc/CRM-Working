'use client'

import type { EmailSendStatus } from '@/lib/email/types'
import { resolveJobCloseoutCatalogEstimateId } from '@/lib/jobs/client'
import {
  fetchCloseoutData,
  saveCloseout,
  sendStageEmail,
} from '@/lib/jobs/actions'
import type { JobDetail } from '@/types/jobs/api'
import {
  applyTemplate,
  buildJobEmailTemplateVars,
  formatJobTemplateDate,
  formatJobTemplateRange,
} from '@/lib/jobs/emailTemplate'
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
  loadCatalogs: (estimateId: string) => Promise<EstimateCatalogPayload | null>
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

  const [job, setJob] = useState<JobDetail | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [closeoutNotes, setCloseoutNotes] = useState('')
  const [paintRows, setPaintRows] = useState<PaintLogRow[]>([createDefaultPaintLogRow()])

  const [paintOptions, setPaintOptions] = useState<string[]>([])
  const [colorOptions, setColorOptions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [emailNotice, setEmailNotice] = useState<string | null>(null)
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
      setError(null)
      setEmailNotice(null)
      setTemplateMissing(false)
      setEmailSkipped(false)
      setPaintRows([createDefaultPaintLogRow()])
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

        const vars = buildJobEmailTemplateVars(
          {
            customerName: loadedJob.customer_name ?? '',
            customerEmail: loadedJob.customer_email ?? '',
            customerPhone: loadedJob.customer_phone ?? '',
            customerAddress: loadedJob.customer_address ?? '',
            jobTitle: loadedJob.title ?? '',
            estimateDate: formatJobTemplateDate(loadedJob.estimate_date),
            scheduledDate: formatJobTemplateDate(loadedJob.scheduled_date),
            scheduledBlocks: formatJobTemplateRange(
              loadedJob.scheduled_date,
              loadedJob.scheduled_end_date
            ),
            estimateFileName: '',
            estimateFileLink: '',
          },
          {
            reviewLink: process.env.NEXT_PUBLIC_REVIEW_LINK,
          }
        )

        setSubject(template ? applyTemplate(template.subject ?? '', vars) : '')
        setBody(template ? applyTemplate(template.body ?? '', vars) : '')

        const rows = closeoutData.paintLogs
        setPaintRows(rows.length > 0 ? rows : [createDefaultPaintLogRow()])

        const nextPaintOptions = new Set<string>()
        const nextColorOptions = new Set<string>()
        for (const row of rows) {
          if (row.paint_product?.trim()) nextPaintOptions.add(row.paint_product.trim())
          if (row.color?.trim()) nextColorOptions.add(row.color.trim())
        }

        const catalogEstimateId = resolveJobCloseoutCatalogEstimateId(loadedJob)

        // Without an accepted estimate source, keep only options already present
        // in saved paint logs. Quote navigation ids are not catalog source data.
        if (catalogEstimateId) {
          const catalogsPayload = await loadCatalogs(catalogEstimateId)
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
          notice: result.notice ?? result.warning ?? null,
        })
      }

      const status = (result.status as EmailSendStatus | undefined) ?? 'sent'
      const replayed = Boolean(result.replayed)
      if (replayed || status === 'replayed') {
        setEmailNotice(
          result.notice ??
            result.warning ??
            'This send request was already processed. No duplicate email was sent.'
        )
        return
      }

      setEmailNotice(result.notice ?? result.warning ?? 'Review email sent.')
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
    paintOptions,
    colorOptions,
    error,
    emailNotice,
    templateMissing,
    emailSkipped,
    canSendEmail,
    sendReviewEmail,
    skipEmail,
    saveAndClose,
    defaultWhereUsedOptions,
    defaultSheenOptions,
  }
}
