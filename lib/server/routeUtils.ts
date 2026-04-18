const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidRegex.test(value)
}

export function parseUuidParam(value: unknown) {
  if (isUuid(value)) {
    return { ok: true as const, value }
  }
  return { ok: false as const }
}

