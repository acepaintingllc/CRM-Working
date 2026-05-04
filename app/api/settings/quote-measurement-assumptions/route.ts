import { readJsonBody, requireSessionUserOrg } from '@/lib/server/apiRoute'
import {
  loadQuoteMeasurementAssumptions,
  saveQuoteMeasurementAssumptions,
} from '@/lib/server/settings/quoteMeasurementAssumptionsStore'
import {
  logSettingsRouteFailure,
  settingsData,
  settingsError,
  settingsSaved,
} from '@/lib/server/settingsRoute'
import { parseQuoteMeasurementAssumptions } from '@/lib/quotes/measurementAssumptionsForm'

type Unsafe = Record<string, unknown>

function extractPayload(body: Unsafe | null | undefined) {
  return body?.data ?? body?.settings ?? body ?? null
}

export async function GET() {
  const sessionResult = await requireSessionUserOrg()
  if (!sessionResult.ok) return sessionResult.response

  try {
    const data = await loadQuoteMeasurementAssumptions(sessionResult.session.orgId)
    return settingsData(data)
  } catch (error) {
    logSettingsRouteFailure({
      resource: 'quote-measurement-assumptions',
      action: 'load',
      orgId: sessionResult.session.orgId,
      userId: sessionResult.session.userId,
      error,
    })
    return settingsError('Failed to load measurement assumptions.', 500)
  }
}

export async function PUT(request: Request) {
  const sessionResult = await requireSessionUserOrg()
  if (!sessionResult.ok) return sessionResult.response

  const parsed = await readJsonBody<Unsafe>(request, { maxBytes: 16 * 1024 })
  if (!parsed.ok) return parsed.response

  const normalized = parseQuoteMeasurementAssumptions(extractPayload(parsed.value))
  if (!normalized.ok) {
    return settingsError(normalized.error, 400)
  }

  try {
    const data = await saveQuoteMeasurementAssumptions(
      sessionResult.session.orgId,
      normalized.data,
      sessionResult.session.userId
    )
    return settingsSaved(data, 'Measurement assumptions saved.')
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'QuoteMeasurementAssumptionsValidationError'
    ) {
      return settingsError(error.message, 400)
    }

    logSettingsRouteFailure({
      resource: 'quote-measurement-assumptions',
      action: 'save',
      orgId: sessionResult.session.orgId,
      userId: sessionResult.session.userId,
      error,
    })
    return settingsError('Failed to save measurement assumptions.', 500)
  }
}
