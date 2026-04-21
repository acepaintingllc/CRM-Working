import { jsonError } from '@/lib/server/apiRoute'

export async function GET() {
  return jsonError(
    'Legacy engine color lists are no longer supported. Estimate v2 uses DB-backed catalogs and calculations.',
    410
  )
}
