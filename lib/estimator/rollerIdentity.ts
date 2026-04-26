import { asText } from './parsing.ts'

export function normalizeWallRollerTargetId(value: unknown) {
  const raw = asText(value)
  if (raw.toLowerCase().startsWith('scope:')) return raw.toLowerCase()
  return raw.toUpperCase()
}

export function wallRollerTargetIdsMatch(left: unknown, right: unknown) {
  return normalizeWallRollerTargetId(left) === normalizeWallRollerTargetId(right)
}
