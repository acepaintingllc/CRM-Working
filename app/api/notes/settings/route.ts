import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'
import { getNotesSettingsWithDefaults, upsertNotesSettings } from '@/lib/notes/settings'
import { asOptionalTrimmedText, asRecord, isUuid, resolveOrgSenderUserId } from '@/lib/notes/server'
import { parseHHMM, resolveTimeZone } from '@/lib/notes/time'

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId, userId } = session
  try {
    const { settings, defaults } = await getNotesSettingsWithDefaults({
      orgId,
      fallbackUserId: userId,
    })

    const ensuredSettings =
      settings ??
      (await upsertNotesSettings({
        orgId,
        senderUserId: defaults.senderUserId,
        dailySummaryEmailTo: defaults.dailySummaryEmailTo,
        dailySummaryTimeLocal: defaults.dailySummaryTimeLocal,
        timezone: defaults.timezone,
        showUpcomingDays: defaults.showUpcomingDays,
      }))

    return NextResponse.json({
      settings: {
        org_id: orgId,
        sender_user_id: defaults.senderUserId,
        daily_summary_email_to: defaults.dailySummaryEmailTo,
        daily_summary_time_local: defaults.dailySummaryTimeLocal,
        timezone: defaults.timezone,
        show_upcoming_days: defaults.showUpcomingDays,
        last_daily_summary_attempted_on: ensuredSettings.last_daily_summary_attempted_on ?? null,
        last_daily_summary_sent_on: ensuredSettings.last_daily_summary_sent_on ?? null,
      },
      defaults: {
        org_name: defaults.orgName,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load settings.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId, userId } = session
  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 32 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = asRecord(parsed.value)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const dailySummaryTimeLocal = asOptionalTrimmedText(body.daily_summary_time_local)
  if (!dailySummaryTimeLocal || !parseHHMM(dailySummaryTimeLocal)) {
    return NextResponse.json({ error: 'daily_summary_time_local must be HH:MM (24-hour).' }, { status: 400 })
  }

  const showUpcomingDaysRaw = body.show_upcoming_days
  const showUpcomingDays =
    typeof showUpcomingDaysRaw === 'number'
      ? Math.trunc(showUpcomingDaysRaw)
      : typeof showUpcomingDaysRaw === 'string' && /^-?\d+$/.test(showUpcomingDaysRaw)
      ? Number(showUpcomingDaysRaw)
      : null
  if (showUpcomingDays == null || showUpcomingDays < 0 || showUpcomingDays > 14) {
    return NextResponse.json({ error: 'show_upcoming_days must be between 0 and 14.' }, { status: 400 })
  }

  const timezone = resolveTimeZone(asOptionalTrimmedText(body.timezone))
  const dailySummaryEmailTo = asOptionalTrimmedText(body.daily_summary_email_to)

  let senderUserId = asOptionalTrimmedText(body.sender_user_id)
  if (senderUserId && !isUuid(senderUserId)) {
    return NextResponse.json({ error: 'sender_user_id must be a UUID.' }, { status: 400 })
  }
  if (!senderUserId) {
    senderUserId = userId
  }
  if (!senderUserId) {
    senderUserId = await resolveOrgSenderUserId(orgId)
  }

  try {
    const row = await upsertNotesSettings({
      orgId,
      senderUserId,
      dailySummaryEmailTo,
      dailySummaryTimeLocal,
      timezone,
      showUpcomingDays,
    })
    return NextResponse.json({ ok: true, settings: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save settings.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
