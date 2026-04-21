import { requireSessionUserOrg, readJsonBody } from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import { serverLog } from '@/lib/server/log'
import { normalizeCreateCustomerInput } from '@/lib/customers/normalizers'
import { createCustomer, listCustomers } from '@/lib/customers/service'

export async function GET() {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  return serviceResultResponse(await listCustomers(session.session.orgId), (customers) => ({ customers }))
}

export async function POST(request: Request) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response

  const input = normalizeCreateCustomerInput(parsed.value, {
    onUnsupportedFields: (fields) => {
      serverLog.warn('Ignoring unsupported customer fields in POST /api/customers', fields)
    },
  })

  return serviceResultResponse(
    input.ok ? await createCustomer(session.session.orgId, input.data) : input,
    (customer) => ({ ok: true, customer })
  )
}
