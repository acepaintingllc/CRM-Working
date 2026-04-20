import { NextResponse } from 'next/server'
import { jsonError, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { seedRatesFlagsFromTemplateSpreadsheet } from '@/lib/server/estimateRatesFlags'

export async function POST(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  try {
    const result = await seedRatesFlagsFromTemplateSpreadsheet({
      origin: new URL(request.url).origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
    })

    if (!result.ok) return jsonError(result.error, result.status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed importing template constants.'
    return jsonError(message, 400)
  }
}
