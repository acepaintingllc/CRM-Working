'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useEffect, useState } from 'react'

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

export default function NotesSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsTime, setSettingsTime] = useState('06:00')
  const [settingsTz, setSettingsTz] = useState('America/Chicago')
  const [settingsUpcoming, setSettingsUpcoming] = useState('3')
  const [lastDailyAttemptedOn, setLastDailyAttemptedOn] = useState<string | null>(null)
  const [lastDailySentOn, setLastDailySentOn] = useState<string | null>(null)
  const [logs, setLogs] = useState<ReminderLogRow[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const [settingsRes, logsRes] = await Promise.all([
        authedFetch('/api/notes/settings', { cache: 'no-store' }),
        authedFetch('/api/notes/reminder-logs?limit=12', { cache: 'no-store' }),
      ])
      const settingsPayload = await settingsRes.json().catch(() => null)
      const logsPayload = await logsRes.json().catch(() => null)
      if (!settingsRes.ok) {
        setError(settingsPayload?.error ?? 'Unable to load settings.')
        setLoading(false)
        return
      }
      const typed = settingsPayload as SettingsPayload
      setSettingsEmail(typed.settings.daily_summary_email_to ?? '')
      setSettingsTime(typed.settings.daily_summary_time_local ?? '06:00')
      setSettingsTz(typed.settings.timezone ?? 'America/Chicago')
      setSettingsUpcoming(String(typed.settings.show_upcoming_days ?? 3))
      setLastDailyAttemptedOn(typed.settings.last_daily_summary_attempted_on ?? null)
      setLastDailySentOn(typed.settings.last_daily_summary_sent_on ?? null)
      if (logsRes.ok) {
        setLogs((logsPayload?.logs ?? []) as ReminderLogRow[])
      }
      setLoading(false)
    }

    void load()
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
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
    setSaving(false)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to save settings.')
      return
    }
    setMessage('Reminder settings saved.')
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
        <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">Settings</div>
        <h2 className="mt-2 text-2xl font-extrabold text-white">Reminder preferences</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Daily summary routing and reminder visibility moved out of the dashboard so Today can stay focused.
        </p>
      </section>

      {loading && <div className="text-sm text-neutral-400">Loading settings...</div>}
      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div>}

      {!loading && (
        <>
          <section className="grid gap-4 rounded-[28px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
            <div className="grid gap-1">
              <h3 className="text-base font-extrabold text-white">Daily summary</h3>
              <p className="text-sm text-neutral-400">Configure where the digest goes and how far ahead Upcoming should look.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Daily Summary Email
                <input
                  value={settingsEmail}
                  onChange={(event) => setSettingsEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Daily Summary Time
                <input
                  type="time"
                  value={settingsTime}
                  onChange={(event) => setSettingsTime(event.target.value)}
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Timezone
                <input
                  value={settingsTz}
                  onChange={(event) => setSettingsTz(event.target.value)}
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Upcoming Days
                <input
                  type="number"
                  min={0}
                  max={14}
                  value={settingsUpcoming}
                  onChange={(event) => setSettingsUpcoming(event.target.value)}
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={saving}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              <div className="text-xs text-neutral-500">
                Last attempted: {lastDailyAttemptedOn ?? 'Never'} | Last sent: {lastDailySentOn ?? 'Never'}
              </div>
            </div>
          </section>

          <section className="grid gap-3 rounded-[28px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
            <div className="grid gap-1">
              <h3 className="text-base font-extrabold text-white">Reminder activity</h3>
              <p className="text-sm text-neutral-400">Recent reminder deliveries and failures.</p>
            </div>
            {logs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/70 p-4 text-sm text-neutral-500">
                No reminder logs yet. If this stays empty, the reminder job may not be running.
              </div>
            ) : (
              <div className="grid gap-2">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-sm">
                    <div className="font-bold text-white">
                      {log.reminder_type.replaceAll('_', ' ')} · {log.status}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {new Date(log.created_at).toLocaleString()}
                      {log.task_title ? ` · ${log.task_title}` : ''}
                    </div>
                    {log.error_message && <div className="mt-2 text-xs text-red-300">{log.error_message}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
