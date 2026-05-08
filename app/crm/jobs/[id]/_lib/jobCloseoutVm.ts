import type { PaintLogRow } from '@/lib/jobs/paintLog'
import type { JobDetail } from '@/types/jobs/api'

export type JobCloseoutReferencePaintLogVm = {
  key: string
  area: string
  product: string
  sheen: string
  color: string
  notes: string | null
}

export type JobCloseoutReferenceVm = {
  notes: string
  hasNotes: boolean
  paintLogs: JobCloseoutReferencePaintLogVm[]
}

export function buildJobCloseoutReferenceVm(params: {
  job: JobDetail | null
  paintLogs: PaintLogRow[]
}): JobCloseoutReferenceVm | null {
  const { job, paintLogs } = params
  if (!job) return null

  const closeoutNotes = job.closeout_notes?.trim() ?? ''
  const shouldShow = job.status === 'completed' || closeoutNotes.length > 0 || paintLogs.length > 0
  if (!shouldShow) return null

  return {
    notes: closeoutNotes || 'No closeout notes yet.',
    hasNotes: closeoutNotes.length > 0,
    paintLogs: paintLogs.map((row, index) => ({
      key: row.id ?? `paint-${index}`,
      area: row.where_used || `Area ${index + 1}`,
      product: row.paint_product || '-',
      sheen: row.sheen || '-',
      color: row.color || '-',
      notes: row.notes?.trim() || null,
    })),
  }
}
