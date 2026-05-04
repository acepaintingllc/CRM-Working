'use client'

import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, CalendarClock, Mail, Trash2 } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import StageEmailModal, {
  stageEmailActionLabel,
  type StageEmailSentResult,
  type StageEmailStage,
} from '@/app/crm/jobs/_components/StageEmailModal'
import {
  addScheduleRow,
  addSchedulesToCalendar,
  deleteScheduleRow,
  fetchJobSchedules,
} from '@/lib/jobs/client'
import type { JobDetail, JobScheduleMeta, ScheduleRow } from '@/types/jobs/api'
import { fetchJobDetail } from '@/lib/jobs/actions'
import {
  addLocalDateTimeHours,
  next8amLocalDateTimeValue,
  toIsoFromLocalDateTimeValue,
} from '@/lib/jobs/dateHelpers'

const iconSizeSm = 16

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
    const nextMeta = (detail?.job ?? null) as (JobDetail & JobScheduleMeta) | null
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
        setJobMeta((detail.job ?? null) as (JobDetail & JobScheduleMeta) | null)
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
        await loadJobMeta()
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
    try {
      const events = await addSchedulesToCalendar(id)
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
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Failed to add schedules to calendar.')
    } finally {
      setAddingCalendar(false)
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
    <CrmPageShell className="max-w-[900px]">
      <CrmPageHeader
        eyebrow="Pipeline workflow"
        emoji="📅"
        title="Schedule job"
        description="Add one or more scheduled date ranges for this job."
        backHref={`/crm/jobs/${id}`}
        backLabel="Back to job"
      />

      <CrmSectionCard title="Schedule blocks">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <CrmField label="Start">
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(event) => setStartLocal(event.target.value)}
                className={crmInputClassName('text-sm')}
              />
            </CrmField>
            <CrmField label="End">
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(event) => setEndLocal(event.target.value)}
                className={crmInputClassName('text-sm')}
              />
            </CrmField>
          </div>

          <CrmField label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Crew, materials, access notes, etc."
              className={crmInputClassName('min-h-[90px] resize-y text-sm')}
            />
          </CrmField>

          {error ? <CrmNotice tone="error" compact>{error}</CrmNotice> : null}
          {notice ? <CrmNotice tone="success" compact>{notice}</CrmNotice> : null}

          <CrmButton type="button" onClick={() => void addSchedule()} disabled={saving} tone="primary">
            {saving ? iconLabel(CalendarClock, 'Saving...') : iconLabel(CalendarClock, 'Add scheduled block')}
          </CrmButton>
        </div>
      </CrmSectionCard>

      <div className="mt-3.5">
        {loading ? <div className="text-[color:var(--crm-ui-muted)]">Loading schedule...</div> : null}
        {!loading && sorted.length === 0 ? (
          <CrmEmptyState
            emoji="📭"
            title="No schedule blocks yet"
            description="Add the first scheduled block to begin job scheduling and calendar sync."
          />
        ) : null}
        {!loading && sorted.length > 0 ? (
          <div className="grid gap-2">
            {sorted.map((row) => (
              <div
                key={row.id}
                className="ace-crm-surface flex justify-between gap-3 rounded-[var(--crm-ui-radius-sm)] p-3"
              >
                <div>
                  <div className="font-extrabold text-[color:var(--crm-ui-text)]">
                    {new Date(row.start_at).toLocaleString()} - {new Date(row.end_at).toLocaleString()}
                  </div>
                  {row.notes ? (
                    <div className="mt-1 text-[13px] text-[color:var(--crm-ui-muted)]">{row.notes}</div>
                  ) : null}
                  {row.calendar_event_id ? (
                    <div className="mt-1 text-xs font-bold text-green-600">Added to calendar</div>
                  ) : null}
                </div>
                <CrmButton onClick={() => void deleteSchedule(row.id)} tone="danger">
                  {iconLabel(Trash2, 'Delete')}
                </CrmButton>
              </div>
            ))}
          </div>
        ) : null}
        {!loading && sorted.length > 0 ? (
          <div className="mt-2.5">
            <div className="flex flex-wrap gap-2">
              <CrmButton type="button" onClick={() => void addToCalendar()} disabled={addingCalendar} tone="primary">
                {addingCalendar
                  ? iconLabel(CalendarCheck, 'Adding to calendar...')
                  : iconLabel(CalendarCheck, 'Add scheduled blocks to Google Calendar')}
              </CrmButton>
              <CrmButton
                type="button"
                onClick={openScheduledEmail}
                tone={jobMeta?.scheduled_email_sent_at ? 'secondary' : 'primary'}
              >
                {iconLabel(Mail, stageEmailActionLabel('scheduled', Boolean(jobMeta?.scheduled_email_sent_at)))}
              </CrmButton>
            </div>
          </div>
        ) : null}
      </div>

      <StageEmailModal
        jobId={typeof id === 'string' ? id : null}
        stage={emailStage}
        open={emailStage != null}
        onClose={() => setEmailStage(null)}
        onSent={handleStageEmailSent}
      />
    </CrmPageShell>
  )
}
