import { isUuid } from '../validation/uuid.ts'

export { isUuid } from '../validation/uuid.ts'

export function parseUuidParam(value: unknown) {
  if (isUuid(value)) {
    return { ok: true as const, value }
  }
  return { ok: false as const }
}
