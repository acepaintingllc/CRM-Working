import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { readNamedRangeValues } from '@/lib/server/googleSheets'

function flattenOptions(values: string[][]) {
  return values
    .flat()
    .map((v) => v.trim())
    .filter(Boolean)
}

function isMissingNamedRangeError(message: string) {
  return (message ?? '').toLowerCase().includes('unable to parse range')
}

export async function GET(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const templateId = process.env.GOOGLE_SHEETS_ESTIMATE_TEMPLATE_ID
  if (!templateId) {
    return NextResponse.json(
      { error: 'Missing env var: GOOGLE_SHEETS_ESTIMATE_TEMPLATE_ID' },
      { status: 500 }
    )
  }

  const { orgId, userId } = session
  const origin = new URL(request.url).origin

  const readOptions = async (range: string) => {
    const res = await readNamedRangeValues({
      origin,
      orgId,
      userId,
      spreadsheetId: templateId,
      range,
    })
    if ('error' in res) {
      const msg = String(res.error ?? '')
      if (isMissingNamedRangeError(msg)) {
        return [] as string[]
      }
      throw new Error(msg || 'Failed to load estimate options')
    }
    return flattenOptions(res.values)
  }

  try {
    const [
      wallPaintOptions,
      wallRollerNapOptions,
      ceilingPaintOptions,
      ceilingRollerCoverOptions,
      ceilingTypeOptions,
      ceilingObstructionOptions,
      trimItemOptions,
      trimPaintOptions,
    ] = await Promise.all([
      readOptions('wall_paint_options'),
      readOptions('wall_roller_nap_options'),
      readOptions('ceiling_paint_options'),
      readOptions('ceiling_roller_cover_options'),
      readOptions('ceiling_type_options'),
      readOptions('ceiling_obstruction_options'),
      readOptions('trim_item_options'),
      readOptions('trim_paint_options'),
    ])

    return NextResponse.json({
      wallPaintOptions,
      wallRollerNapOptions,
      ceilingPaintOptions,
      ceilingRollerCoverOptions,
      ceilingTypeOptions,
      ceilingObstructionOptions,
      trimItemOptions,
      trimPaintOptions,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load estimate options'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
