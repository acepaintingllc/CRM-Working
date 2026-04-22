import { readJsonBody, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { serviceErrorResponse, serviceResultResponse } from '@/lib/server/routeResult'
import {
  listEmailTemplates,
  normalizeSaveEmailTemplateInput,
  saveEmailTemplate,
} from '@/lib/emailTemplates/service'

export async function GET() {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  return serviceResultResponse(await listEmailTemplates(session.session.orgId), (templates) => ({
    data: templates,
  }))
}

export async function PUT(request: Request) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response

  const input = normalizeSaveEmailTemplateInput(parsed.value)
  if (!input.ok) return serviceErrorResponse(input)

  return serviceResultResponse(
    await saveEmailTemplate(session.session.orgId, input.data),
    (template) => ({
      data: template,
      notice: 'Email template saved.',
    })
  )
}
