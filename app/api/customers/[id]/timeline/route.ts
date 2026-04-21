import {
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { normalizeCreateCustomerTimelineNoteInput } from '@/lib/customers/normalizers'
import {
  serviceErrorResponse,
  serviceResultResponse,
} from '@/lib/server/routeResult'
import {
  createCustomerTimelineNote,
  listCustomerTimeline,
} from '@/lib/customers/service'

export async function GET(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const params = await resolveParams(context)
  const id = (params as { id?: string } | null | undefined)?.id
  const customerId = readUuidParam(id, 'customer id')
  if (!customerId.ok) return customerId.response

  return serviceResultResponse(
    await listCustomerTimeline(session.session.orgId, customerId.value),
    (events) => ({ events })
  )
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const params = await resolveParams(context)
  const id = (params as { id?: string } | null | undefined)?.id
  const customerId = readUuidParam(id, 'customer id')
  if (!customerId.ok) return customerId.response

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response
  const input = normalizeCreateCustomerTimelineNoteInput(parsed.value)
  if (!input.ok) return serviceErrorResponse(input)

  return serviceResultResponse(
    await createCustomerTimelineNote(
      session.session.orgId,
      session.session.userId,
      customerId.value,
      input.data
    ),
    (event) => ({ ok: true, event })
  )
}
