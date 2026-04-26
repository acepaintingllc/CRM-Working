export const WALL_ROLLER_SCOPE_PREFIX = 'scope:'

export function normalizeWallRollerTargetId(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (raw.toLowerCase().startsWith(WALL_ROLLER_SCOPE_PREFIX)) {
    return `${WALL_ROLLER_SCOPE_PREFIX}${raw.slice(WALL_ROLLER_SCOPE_PREFIX.length)}`
  }
  return raw.toUpperCase()
}

function isWallRollerScopeTargetId(value: string) {
  return value.toLowerCase().startsWith(WALL_ROLLER_SCOPE_PREFIX)
}

export function wallRollerTargetIdsMatch(left: unknown, right: unknown) {
  const normalizedLeft = normalizeWallRollerTargetId(left)
  const normalizedRight = normalizeWallRollerTargetId(right)
  if (normalizedLeft === normalizedRight) return true
  return (
    isWallRollerScopeTargetId(normalizedLeft) &&
    isWallRollerScopeTargetId(normalizedRight) &&
    normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
  )
}
