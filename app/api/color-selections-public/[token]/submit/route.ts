import { jsonError, resolveParams } from '@/lib/server/apiRoute'
import { serviceResultMutationResponse } from '@/lib/server/routeResult'
import { submitPublicJobColorSelections } from '@/lib/server/job-operations/colorSelections'

type RouteContext = {
  params: { token?: string } | Promise<{ token?: string }>
}

async function readToken(context: RouteContext) {
  const params = await resolveParams(context)
  const token = typeof params?.token === 'string' ? params.token.trim() : ''
  return token || null
}

export async function POST(_request: Request, context: RouteContext) {
  const token = await readToken(context)
  if (!token) return jsonError('Missing color selection token.', 400)

  return serviceResultMutationResponse(
    await submitPublicJobColorSelections(token),
    'Color selections submitted.'
  )
}
