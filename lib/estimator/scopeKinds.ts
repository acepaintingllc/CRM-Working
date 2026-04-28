export const SCOPE_KINDS = ['walls', 'ceilings', 'trim', 'doors'] as const

export type ScopeKind = (typeof SCOPE_KINDS)[number]

export const SCOPE_KIND_LABELS: Record<ScopeKind, string> = {
  walls: 'Walls',
  ceilings: 'Ceilings',
  trim: 'Trim',
  doors: 'Doors',
}

export const SCOPE_KIND_ORDER = SCOPE_KINDS.reduce<Record<ScopeKind, number>>(
  (acc, kind, index) => {
    acc[kind] = index
    return acc
  },
  {
    walls: 0,
    ceilings: 1,
    trim: 2,
    doors: 3,
  }
)
