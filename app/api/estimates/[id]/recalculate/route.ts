import { NextResponse } from 'next/server'
import { recalculateEstimateSpreadsheet } from '@/lib/server/estimateSpreadsheet'
import { getSessionUserOrg } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const id = (params as { id?: Unsafe } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid estimate id' }, { status: 400 })
  }

  try {
    const url = new URL(request.url)
    const forceNewSheet =
      url.searchParams.get('new_sheet') === '1' ||
      url.searchParams.get('newSheet') === '1' ||
      url.searchParams.get('force_new_sheet') === '1'

    const latestOutput = await recalculateEstimateSpreadsheet({
      origin: new URL(request.url).origin,
      orgId: session.orgId,
      userId: session.userId,
      estimateId: id,
      forceNewSheet,
    })
    return NextResponse.json({ ok: true, latest_output_json: latestOutput })
  } catch (error) {
    const missingInputs =
      typeof error === 'object' && error != null && 'missing_inputs' in error
        ? (error as { missing_inputs?: unknown }).missing_inputs
        : null
    if (Array.isArray(missingInputs) && missingInputs.length > 0) {
      return NextResponse.json(
        { error: 'Missing required estimate inputs', missing_inputs: missingInputs },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Recalculate failed'
    const status = message.toLowerCase().includes('schema version mismatch') ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
