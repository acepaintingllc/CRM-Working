import { isUuid } from '../validation/uuid.ts'

export { isUuid } from '../validation/uuid.ts'

export function parseUuidParam(value: unknown) {
  if (isUuid(value)) {
    return { ok: true as const, value }
  }
  return { ok: false as const }
}

export function getClientIp(request: Request): string {
  const header = request.headers.get('x-forwarded-for')
  if (!header) return ''
  return header.split(',')[0]?.trim() ?? ''
}
