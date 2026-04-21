import { readJsonBody, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { loadCompanyProfileSettings, saveCompanyProfileSettings } from '@/lib/server/settings/companyProfileStore'
import { logSettingsRouteFailure, settingsData, settingsError, settingsSaved } from '@/lib/server/settingsRoute'
import { parseCompanyProfileSettings } from '@/lib/settings/companyProfile'

type Unsafe = Record<string, unknown>

function extractPayload(body: Unsafe | null | undefined) {
  return body?.data ?? body?.profile ?? body ?? null
}

export async function GET() {
  const sessionResult = await requireSessionUserOrg()
  if (!sessionResult.ok) return sessionResult.response

  try {
    const data = await loadCompanyProfileSettings(sessionResult.session.orgId)
    return settingsData(data)
  } catch (error) {
    logSettingsRouteFailure({
      resource: 'company-profile',
      action: 'load',
      orgId: sessionResult.session.orgId,
      userId: sessionResult.session.userId,
      error,
    })
    return settingsError('Failed to load company profile.', 500)
  }
}

export async function PUT(request: Request) {
  const sessionResult = await requireSessionUserOrg()
  if (!sessionResult.ok) return sessionResult.response

  const parsed = await readJsonBody<Unsafe>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response

  const normalized = parseCompanyProfileSettings(extractPayload(parsed.value))
  if (!normalized.ok) {
    return settingsError(normalized.error, 400)
  }

  try {
    const data = await saveCompanyProfileSettings(sessionResult.session.orgId, normalized.data)
    return settingsSaved(data, 'Company profile saved.')
  } catch (error) {
    logSettingsRouteFailure({
      resource: 'company-profile',
      action: 'save',
      orgId: sessionResult.session.orgId,
      userId: sessionResult.session.userId,
      error,
    })
    return settingsError('Failed to save company profile.', 500)
  }
}
