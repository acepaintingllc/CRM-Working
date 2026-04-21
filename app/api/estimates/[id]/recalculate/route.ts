import { jsonError } from '@/lib/server/apiRoute'

export async function POST() {
  return jsonError(
    'Legacy estimate recalculation is no longer supported. Estimate v2 uses DB-backed calculations.',
    410
  )
}
