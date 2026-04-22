import {
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import {
  serviceErrorResponse,
  serviceResultResponse,
} from '@/lib/server/routeResult'
import { normalizeUpdateCustomerInput } from '@/lib/customers/normalizers'
import {
  deleteCustomer,
  getCustomerDetail,
  updateCustomer,
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

  return serviceResultResponse(await getCustomerDetail(session.session.orgId, customerId.value), (customer) => ({
    data: customer,
  }))
}

export async function DELETE(
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
    await deleteCustomer(session.session.orgId, customerId.value, {
      isProduction: process.env.NODE_ENV === 'production',
    }),
    () => ({
      data: true,
      notice: 'Customer deleted.',
    })
  )
}

export async function PATCH(
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

  const input = normalizeUpdateCustomerInput(parsed.value)
  if (!input.ok) return serviceErrorResponse(input)

  return serviceResultResponse(
    await updateCustomer(session.session.orgId, customerId.value, input.data),
    (customer) => ({
      data: customer,
      notice: 'Customer updated.',
    })
  )
}
