'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowUpRight, Clock3, PlusCircle } from 'lucide-react'
import { formatDue, type NoteRow, type TaskRow } from './_lib'

type DashboardPayload = {
  tasks: {
    overdue: TaskRow[]
    due_today: TaskRow[]
    upcoming: TaskRow[]
  }
  notes: {
    recent: NoteRow[]
    uncategorized: NoteRow[]
  }
}

type SettingsPayload = {
  settings: {
    daily_summary_email_to: string | null
    daily_summary_time_local: string
    timezone: string
    show_upcoming_days: number
    last_daily_summary_attempted_on?: string | null
    last_daily_summary_sent_on?: string | null
  }
}

type ReminderLogRow = {
  id: string
  reminder_type: string
  status: string
  created_at: string
  error_message: string | null
  task_title?: string | null
}

export default function NotesTodayPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsTime, setSettingsTime] = useState('06:00')
  const [settingsTz, setSettingsTz] = useState('America/Chicago')
  const [settingsUpcoming, setSettingsUpcoming] = useState('3')
  const [lastDailyAttemptedOn, setLastDailyAttemptedOn] = useState<string | null>(null)
  const [lastDailySentOn, setLastDailySentOn] = useState<string | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const [logs, setLogs] = useState<ReminderLogRow[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const [dashboardRes, settingsRes, logsRes] = await Promise.all([
        authedFetch('/api/notes/dashboard', { cache: 'no-store' }),
        authedFetch('/api/notes/settings', { cache: 'no-store' }),
        authedFetch('/api/notes/reminder-logs?limit=8', { cache: 'no-store' }),
      ])
      const dashboardPayload = await dashboardRes.json().catch(() => null)
      const settingsPayload = await settingsRes.json().catch(() => null)
      const logsPayload = await logsRes.json().catch(() => null)
      if (!dashboardRes.ok) {
        setError(dashboardPayload?.error ?? 'Unable to load dashboard.')
        setLoading(false)
        return
      }
      setData(dashboardPayload as DashboardPayload)
      if (settingsRes.ok) {
        const typed = settingsPayload as SettingsPayload
        setSettingsEmail(typed.settings.daily_summary_email_to ?? '')
        setSettingsTime(typed.settings.daily_summary_time_local ?? '06:00')
        setSettingsTz(typed.settings.timezone ?? 'America/Chicago')
        setSettingsUpcoming(String(typed.settings.show_upcoming_days ?? 3))
        setLastDailyAttemptedOn(typed.settings.last_daily_summary_attempted_on ?? null)
        setLastDailySentOn(typed.settings.last_daily_summary_sent_on ?? null)
      }
      if (logsRes.ok) {
        setLogs((logsPayload?.logs ?? []) as ReminderLogRow[])
      }
      setLoading(false)
    }
    void load()
  }, [])

  const saveSettings = async () => {
    setSettingsSaving(true)
    setSettingsMsg(null)
    const res = await authedFetch('/api/notes/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daily_summary_email_to: settingsEmail.trim() || null,
        daily_summary_time_local: settingsTime,
        timezone: settingsTz.trim() || 'America/Chicago',
        show_upcoming_days: Number(settingsUpcoming || '3'),
      }),
    })
    const payload = await res.json().catch(() => null)
    setSettingsSaving(false)
    if (!res.ok) {
      setSettingsMsg(payload?.error ?? 'Unable to save settings.')
      return
    }
    setSettingsMsg('Reminder settings saved.')
  }

  return (
    <div className="grid gap-4 pb-16">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Today</h2>
            <p className="text-sm text-gray-600">Overdue and due-today tasks first.</p>
          </div>
          <Link
            href="/crm/notes/quick-add"
            className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-sm font-extrabold text-white"
          >
            <PlusCircle size={16} aria-hidden="true" />
            <span>Quick Add</span>
          </Link>
        </div>
      </section>

      {loading && <div className="text-sm text-gray-500">Loading dashboard...</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && data && (
        <>
          <TaskSection
            title="Overdue"
            icon={<AlertTriangle size={16} aria-hidden="true" />}
            tasks={data.tasks.overdue}
            empty="No overdue tasks."
          />
          <TaskSection
            title="Due Today"
            icon={<Clock3 size={16} aria-hidden="true" />}
            tasks={data.tasks.due_today}
            empty="Nothing due today."
          />
          <TaskSection title="Upcoming" tasks={data.tasks.upcoming} empty="No upcoming tasks." />

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900">Recent Notes</h3>
              <Link href="/crm/notes/notes" className="text-xs font-bold text-gray-700 underline">
                Open Notes
              </Link>
            </div>
            {data.notes.recent.length === 0 ? (
              <div className="text-sm text-gray-500">No notes yet.</div>
            ) : (
              <div className="grid gap-2">
                {data.notes.recent.map((note) => (
                  <Link
                    key={note.id}
                    href={`/crm/notes/notes/${encodeURIComponent(note.id)}`}
                    className="rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-gray-900">{note.title}</div>
                        <div className="line-clamp-2 text-sm text-gray-600">{note.body || 'No content yet.'}</div>
                      </div>
                      <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-extrabold text-gray-900">Reminder Settings</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-gray-800">
                Daily Summary Email
                <input
                  value={settingsEmail}
                  onChange={(event) => setSettingsEmail(event.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2"
                  placeholder="you@company.com"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-gray-800">
                Daily Summary Time
                <input
                  type="time"
                  value={settingsTime}
                  onChange={(event) => setSettingsTime(event.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-gray-800">
                Timezone
                <input
                  value={settingsTz}
                  onChange={(event) => setSettingsTz(event.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-gray-800">
                Upcoming Days
                <input
                  type="number"
                  min={0}
                  max={14}
                  value={settingsUpcoming}
                  onChange={(event) => setSettingsUpcoming(event.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
            </div>
            <button
              onClick={() => void saveSettings()}
              disabled={settingsSaving}
              className="w-full rounded-xl bg-black px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-60 sm:w-fit"
            >
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </button>
            {settingsMsg && <div className="text-sm text-gray-600">{settingsMsg}</div>}
            <div className="text-xs text-gray-500">
              Daily summary last attempted: {lastDailyAttemptedOn ?? 'Never'}
            </div>
            <div className="text-xs text-gray-500">
              Daily summary last sent: {lastDailySentOn ?? 'Never'}
            </div>
          </section>

          <section className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-extrabold text-gray-900">Recent Reminder Logs</h3>
            {logs.length === 0 && (
              <div className="text-sm text-gray-500">
                No reminder logs yet. If this stays empty, the reminder cron job is probably not running.
              </div>
            )}
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                <div className="font-bold text-gray-900">
                  {log.reminder_type.replaceAll('_', ' ')} · {log.status}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(log.created_at).toLocaleString()}
                  {log.task_title ? ` · ${log.task_title}` : ''}
                </div>
                {log.error_message && <div className="mt-1 text-xs text-red-700">{log.error_message}</div>}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

function TaskSection(props: {
  title: string
  tasks: TaskRow[]
  empty: string
  icon?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 inline-flex items-center gap-2 text-base font-extrabold text-gray-900">
        {props.icon}
        <span>{props.title}</span>
      </h3>
      {props.tasks.length === 0 ? (
        <div className="text-sm text-gray-500">{props.empty}</div>
      ) : (
        <div className="grid gap-2">
          {props.tasks.map((task) => (
            <Link
              key={task.id}
              href={`/crm/notes/tasks?focus=${encodeURIComponent(task.id)}`}
              className="rounded-xl border border-gray-200 p-3 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-gray-900">{task.title}</div>
                  {task.description && <div className="line-clamp-2 text-sm text-gray-600">{task.description}</div>}
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>{formatDue(task.due_at, task.is_all_day, task.has_due_time)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
