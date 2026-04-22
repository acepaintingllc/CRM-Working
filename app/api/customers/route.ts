import { requireSessionUserOrg, readJsonBody } from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import { serverLog } from '@/lib/server/log'
import { normalizeCreateCustomerInput } from '@/lib/customers/normalizers'
import { createCustomer, listCustomers } from '@/lib/customers/service'

function readPositiveInt(value: string | null, fallback: number) {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.trunc(parsed))
}

export async function GET(request: Request) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const { searchParams } = new URL(request.url)
  const page = readPositiveInt(searchParams.get('page'), 1)
  const pageSize = Math.min(50, readPositiveInt(searchParams.get('pageSize'), 50))
  const search = (searchParams.get('search') ?? '').trim()

  return serviceResultResponse(
    await listCustomers(session.session.orgId, { search, page, pageSize }),
    (customers) => customers
  )
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
    (customer) => ({
      data: customer,
      notice: 'Customer created.',
    })
  )
}
