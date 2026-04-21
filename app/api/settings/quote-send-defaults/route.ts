import { readJsonBody, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { loadQuoteSendDefaults, saveQuoteSendDefaults } from '@/lib/server/settings/quoteSendDefaultsStore'
import { logSettingsRouteFailure, settingsData, settingsError, settingsSaved } from '@/lib/server/settingsRoute'
import {
  parseQuoteSendDefaults,
} from '@/lib/settings/quoteSendDefaults'

type Unsafe = Record<string, unknown>

function extractPayload(body: Unsafe | null | undefined) {
  return body?.data ?? body?.settings ?? body ?? null
}

export async function GET() {
  const sessionResult = await requireSessionUserOrg()
  if (!sessionResult.ok) return sessionResult.response

  try {
    const data = await loadQuoteSendDefaults(sessionResult.session.orgId)
    return settingsData(data)
  } catch (error) {
    logSettingsRouteFailure({
      resource: 'quote-send-defaults',
      action: 'load',
      orgId: sessionResult.session.orgId,
      userId: sessionResult.session.userId,
      error,
    })
    return settingsError('Failed to load quote send defaults.', 500)
  }
}

export async function PUT(request: Request) {
  const sessionResult = await requireSessionUserOrg()
  if (!sessionResult.ok) return sessionResult.response

  const parsed = await readJsonBody<Unsafe>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response

  const normalized = parseQuoteSendDefaults(extractPayload(parsed.value))
  if (!normalized.ok) {
    return settingsError(normalized.error, 400)
  }

  try {
    const data = await saveQuoteSendDefaults(sessionResult.session.orgId, normalized.data)
    return settingsSaved(data, 'Quote send defaults saved.')
  } catch (error) {
    logSettingsRouteFailure({
      resource: 'quote-send-defaults',
      action: 'save',
      orgId: sessionResult.session.orgId,
      userId: sessionResult.session.userId,
      error,
    })
    return settingsError('Failed to save quote send defaults.', 500)
  }
}
