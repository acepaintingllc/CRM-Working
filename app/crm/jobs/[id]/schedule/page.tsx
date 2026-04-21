'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, CalendarCheck, CalendarClock, Mail, Trash2 } from 'lucide-react'
import StageEmailModal, {
  stageEmailActionLabel,
  type StageEmailSentResult,
  type StageEmailStage,
} from '@/app/crm/jobs/_components/StageEmailModal'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  addScheduleRow,
  deleteScheduleRow,
  fetchJobDetail,
  fetchJobSchedules,
  getResponseErrorMessage,
  parseResponseBody,
  type JobScheduleMeta,
  type ScheduleRow,
} from '@/lib/jobs/actions'
import {
  addLocalDateTimeHours,
  next8amLocalDateTimeValue,
  toIsoFromLocalDateTimeValue,
} from '@/lib/jobs/dateHelpers'
import {
  jobsButtonAccentClassName,
  jobsButtonDangerClassName,
  jobsButtonSecondaryClassName,
  jobsCardClassName,
  jobsInputClassName,
  jobsLabelClassName,
  jobsPageShellClassName,
} from '@/lib/jobs/uiClasses'

type CalendarAddResult = {
  scheduleId: string
  eventId?: string | null
  skipped?: boolean
}

const iconSizeSm = 16
const iconSizeMd = 18

function iconLabel(Icon: LucideIcon, label: string, size = iconSizeSm) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export default function JobSchedulePage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addingCalendar, setAddingCalendar] = useState(false)
  const [jobMeta, setJobMeta] = useState<JobScheduleMeta | null>(null)
  const [emailStage, setEmailStage] = useState<StageEmailStage | null>(null)
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [notes, setNotes] = useState('')

  const loadJobMeta = async () => {
    if (!id || typeof id !== 'string') return null
    const detail = await fetchJobDetail(id).catch(() => null)
    const nextMeta = (detail?.job ?? null) as JobScheduleMeta | null
    setJobMeta(nextMeta)
    return nextMeta
  }

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [schedules, detail] = await Promise.all([fetchJobSchedules(id), fetchJobDetail(id)])
        setRows(schedules)
        setJobMeta((detail.job ?? null) as JobScheduleMeta | null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load schedule.')
        setRows([])
      }
      setLoading(false)
    }
    void load()
  }, [id])

  useEffect(() => {
    if (!startLocal) setStartLocal(next8amLocalDateTimeValue())
    if (!endLocal) setEndLocal(addLocalDateTimeHours(startLocal, 8))
  }, [startLocal, endLocal])

  const addSchedule = async () => {
    if (!id || typeof id !== 'string') return
    if (!startLocal || !endLocal) {
      setError('Start and end are required')
      return
    }
    const startIso = toIsoFromLocalDateTimeValue(startLocal)
    const endIso = toIsoFromLocalDateTimeValue(endLocal)
    if (!startIso || !endIso) {
      setError('Invalid date/time')
      return
    }
    const hadNoSchedules = rows.length === 0
    setSaving(true)
    setError(null)
    try {
      const schedule = await addScheduleRow(id, {
        start_at: startIso,
        end_at: endIso,
        notes: notes.trim() || null,
      })
      if (schedule) setRows((prev) => [schedule, ...prev])
      setNotes('')
      if (hadNoSchedules) {
        const refreshedJob = await loadJobMeta()
        if (refreshedJob && !refreshedJob.scheduled_email_sent_at) {
          setEmailStage('scheduled')
        }
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to add schedule block.')
      return
    } finally {
      setSaving(false)
    }
  }

  const deleteSchedule = async (scheduleId: string) => {
    if (!id || typeof id !== 'string') return
    const ok = window.confirm('Delete this scheduled block?')
    if (!ok) return
    try {
      await deleteScheduleRow(id, scheduleId)
      setRows((prev) => prev.filter((row) => row.id !== scheduleId))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete schedule block.')
    }
  }

  const sorted = useMemo(() => [...rows].sort((a, b) => a.start_at.localeCompare(b.start_at)), [rows])

  const addToCalendar = async () => {
    if (!sorted.length || !id || typeof id !== 'string') {
      setError('Add at least one scheduled block first.')
      return
    }
    setAddingCalendar(true)
    setError(null)
    const res = await authedFetch(`/api/jobs/${id}/schedules/add-to-calendar`, { method: 'POST' })
    const payload = await parseResponseBody(res)
    setAddingCalendar(false)
    if (!res.ok) {
      setError(getResponseErrorMessage(res, payload))
      return
    }
    const events = ((payload.json as { events?: CalendarAddResult[] } | null)?.events ?? []) as CalendarAddResult[]
    if (events.length) {
      setRows((prev) =>
        prev.map((row) => {
          const found = events.find((event) => event.scheduleId === row.id)
          if (!found || found.skipped) return row
          return {
            ...row,
            calendar_event_id: found.eventId ?? row.calendar_event_id,
            calendar_added_at: new Date().toISOString(),
          }
        })
      )
    }
  }

  const openScheduledEmail = () => {
    setError(null)
    setEmailStage('scheduled')
  }

  const handleStageEmailSent = (result: StageEmailSentResult) => {
    setError(null)
    if (result.job) {
      const patch = result.job as Partial<JobScheduleMeta>
      setJobMeta((prev) => ({ ...(prev ?? {}), ...patch }))
    }
    setNotice(result.warning ?? 'Email sent')
  }

  return (
    <div className={`${jobsPageShellClassName} max-w-[900px]`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[20px] font-extrabold">Schedule job</div>
          <div className="text-xs text-[var(--crm-muted)]">
            Add one or more scheduled date ranges for this job.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/crm/jobs/${id}`}
            className={`${jobsButtonSecondaryClassName} no-underline`}
          >
            {iconLabel(ArrowLeft, 'Back to job', iconSizeMd)}
          </Link>
        </div>
      </div>

      <div className={jobsCardClassName}>
        <div className="grid gap-2.5">
          <div className="grid gap-2.5 md:grid-cols-2">
            <div>
              <div className={jobsLabelClassName}>Start</div>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(event) => setStartLocal(event.target.value)}
                className={jobsInputClassName}
              />
            </div>
            <div>
              <div className={jobsLabelClassName}>End</div>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(event) => setEndLocal(event.target.value)}
                className={jobsInputClassName}
              />
            </div>
          </div>

          <div>
            <div className={jobsLabelClassName}>Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Crew, materials, access notes, etc."
              className={`${jobsInputClassName} min-h-[90px] resize-y`}
            />
          </div>

          {error && <div className="text-sm text-red-700">{error}</div>}
          {notice && <div className="text-sm text-green-700">{notice}</div>}

          <button
            onClick={() => void addSchedule()}
            disabled={saving}
            className={jobsButtonAccentClassName}
          >
            {saving
              ? iconLabel(CalendarClock, 'Saving...')
              : iconLabel(CalendarClock, 'Add scheduled block')}
          </button>
        </div>
      </div>

      <div className="mt-3.5">
        {loading && <div className="text-[var(--crm-muted)]">Loading schedule...</div>}
        {!loading && sorted.length === 0 && (
          <div className="text-[var(--crm-muted)]">No schedule blocks yet.</div>
        )}
        {!loading && sorted.length > 0 && (
          <div className="grid gap-2">
            {sorted.map((row) => (
              <div
                key={row.id}
                className="flex justify-between gap-3 rounded-xl border border-[var(--crm-border-soft)] bg-[var(--crm-card)] p-3"
              >
                <div>
                  <div className="font-extrabold">
                    {new Date(row.start_at).toLocaleString()} - {new Date(row.end_at).toLocaleString()}
                  </div>
                  {row.notes && (
                    <div className="mt-1 text-[13px] text-[var(--crm-muted)]">{row.notes}</div>
                  )}
                  {row.calendar_event_id && (
                    <div className="mt-1 text-xs font-bold text-green-600">Added to calendar</div>
                  )}
                </div>
                <button
                  onClick={() => void deleteSchedule(row.id)}
                  className={jobsButtonDangerClassName}
                >
                  {iconLabel(Trash2, 'Delete')}
                </button>
              </div>
            ))}
          </div>
        )}
        {!loading && sorted.length > 0 && (
          <div className="mt-2.5">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void addToCalendar()}
                disabled={addingCalendar}
                className={jobsButtonAccentClassName}
              >
                {addingCalendar
                  ? iconLabel(CalendarCheck, 'Adding to calendar...')
                  : iconLabel(CalendarCheck, 'Add scheduled blocks to Google Calendar')}
              </button>
              <button
                onClick={openScheduledEmail}
                className={
                  jobMeta?.scheduled_email_sent_at
                    ? jobsButtonSecondaryClassName
                    : 'inline-flex items-center gap-1.5 rounded-[10px] border border-[#111] bg-[#111] px-3 py-2 text-sm font-extrabold text-white transition hover:opacity-95'
                }
              >
                {iconLabel(
                  Mail,
                  stageEmailActionLabel('scheduled', Boolean(jobMeta?.scheduled_email_sent_at))
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <StageEmailModal
        jobId={typeof id === 'string' ? id : null}
        stage={emailStage}
        open={emailStage != null}
        onClose={() => setEmailStage(null)}
        onSent={handleStageEmailSent}
      />
    </div>
  )
}
