import type { NotesSettingsRow } from './types.ts'
import { parseHHMM, resolveTimeZone } from './time.ts'

type NotesSettingsDefaultsInput = {
  settings: NotesSettingsRow | null
  orgDefaults: {
    name: string
    timezone: string | null
    businessEmail: string | null
  }
  fallbackUserId?: string | null
}

export function buildNotesSettingsDefaults(params: NotesSettingsDefaultsInput) {
  const timezone = resolveTimeZone(params.settings?.timezone ?? params.orgDefaults.timezone)
  const showUpcomingDays =
    params.settings?.show_upcoming_days != null
      ? Math.max(0, Math.min(14, params.settings.show_upcoming_days))
      : 3
  const parsedTime = parseHHMM(params.settings?.daily_summary_time_local ?? null)
  const dailySummaryTimeLocal = parsedTime
    ? `${String(parsedTime.hour).padStart(2, '0')}:${String(parsedTime.minute).padStart(2, '0')}`
    : '06:00'

  return {
    orgName: params.orgDefaults.name,
    timezone,
    showUpcomingDays,
    dailySummaryTimeLocal,
    dailySummaryEmailTo:
      params.settings?.daily_summary_email_to ?? params.orgDefaults.businessEmail ?? null,
    senderUserId: params.settings?.sender_user_id ?? params.fallbackUserId ?? null,
  }
}
