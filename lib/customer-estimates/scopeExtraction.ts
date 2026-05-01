import type { CustomerEstimateSectionKey } from './types.ts'
import {
  cleanCustomerFacingText,
  humanizeRoomCode,
  labelOrFallback,
  textJoin,
} from './buildShared.ts'
import {
  type NormalizedJobSettings,
  type NormalizedDoorScopeRow,
  type NormalizedDrywallScopeRow,
  type NormalizedOtherRow,
  type NormalizedPaintCatalogRow,
  type NormalizedPaintScopeRow,
  type NormalizedRoomRow,
  type NormalizedTrimCatalogRow,
  type NormalizedTrimItemRow,
  type NormalizedTrimScopeRow,
  jobSettingsPaintProductId,
  paintNameMap,
  resolvePaintProductLabel,
  roomNameMap,
} from './inputNormalization.ts'
import { prepFragments } from './textGeneration.ts'

export type ScopeBucket = {
  texts: string[]
  price: number
  rooms: string[]
  paintProducts: string[]
  subjectLabels: string[]
  notes: string[]
  coats: number[]
  primeModes: Array<'SPOT' | 'FULL'>
}

export type ScopeBuckets = Record<CustomerEstimateSectionKey, ScopeBucket>
type ClassifiedTrimRow = NormalizedTrimItemRow & {
  category: string
  label: string
}

export function trimCategory(labelOrCategory: string, family?: string | null) {
  const familyRaw = String(family ?? '').trim().toLowerCase()
  if (familyRaw.includes('door')) {
    if (familyRaw.includes('casing')) return 'door_casing'
    return 'door'
  }
  if (
    familyRaw.includes('baseboard') ||
    familyRaw.includes('base board') ||
    familyRaw.includes('trim')
  ) {
    return 'baseboard'
  }
  const raw = String(labelOrCategory ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (!raw) return ''
  if (raw.includes('window') && raw.includes('casing')) return 'window_casing'
  if (raw.includes('door') && raw.includes('casing')) return 'door_casing'
  if (raw.includes('baseboard')) return 'baseboard'
  if (raw.includes('crown')) return 'crown'
  if (raw.includes('trim')) return 'baseboard'
  if (raw.includes('door')) return 'door'
  if (raw.includes('cabinet')) return 'cabinet'
  return raw
}

export function createScopeBuckets(): ScopeBuckets {
  return {
    walls: {
      texts: [],
      price: 0,
      rooms: [],
      paintProducts: [],
      subjectLabels: [],
      notes: [],
      coats: [],
      primeModes: [],
    },
    ceilings: {
      texts: [],
      price: 0,
      rooms: [],
      paintProducts: [],
      subjectLabels: [],
      notes: [],
      coats: [],
      primeModes: [],
    },
    trim: {
      texts: [],
      price: 0,
      rooms: [],
      paintProducts: [],
      subjectLabels: [],
      notes: [],
      coats: [],
      primeModes: [],
    },
    doors: {
      texts: [],
      price: 0,
      rooms: [],
      paintProducts: [],
      subjectLabels: [],
      notes: [],
      coats: [],
      primeModes: [],
    },
    drywall: {
      texts: [],
      price: 0,
      rooms: [],
      paintProducts: [],
      subjectLabels: [],
      notes: [],
      coats: [],
      primeModes: [],
    },
    cabinets: {
      texts: [],
      price: 0,
      rooms: [],
      paintProducts: [],
      subjectLabels: [],
      notes: [],
      coats: [],
      primeModes: [],
    },
    other: {
      texts: [],
      price: 0,
      rooms: [],
      paintProducts: [],
      subjectLabels: [],
      notes: [],
      coats: [],
      primeModes: [],
    },
  }
}

function addToBucket(
  bucket: ScopeBucket,
  params: {
    room?: string
    paintProduct?: string
    subjectLabel?: string
    note?: string
    coat?: number | null
    primeMode?: 'SPOT' | 'FULL' | null
  }
) {
  return {
    ...bucket,
    rooms: params.room ? [...bucket.rooms, params.room] : bucket.rooms,
    paintProducts: params.paintProduct ? [...bucket.paintProducts, params.paintProduct] : bucket.paintProducts,
    subjectLabels: params.subjectLabel ? [...bucket.subjectLabels, params.subjectLabel] : bucket.subjectLabels,
    notes: params.note ? [...bucket.notes, params.note] : bucket.notes,
    coats: params.coat != null ? [...bucket.coats, params.coat] : bucket.coats,
    primeModes:
      params.primeMode === 'SPOT' || params.primeMode === 'FULL'
        ? [...bucket.primeModes, params.primeMode]
        : bucket.primeModes,
  }
}

function appendScopeBucket(
  sectionBuckets: ScopeBuckets,
  scope: CustomerEstimateSectionKey,
  price: number,
  params: Parameters<typeof addToBucket>[1]
) {
  const nextBucket = addToBucket(sectionBuckets[scope], params)
  sectionBuckets[scope] = { ...nextBucket, price: sectionBuckets[scope].price + price }
}

function applyPaintScopeRows(params: {
  sectionBuckets: ScopeBuckets
  scope: 'walls' | 'ceilings'
  rows: NormalizedPaintScopeRow[]
  roomLabels: Map<string, string>
  paintLabels: Map<string, string>
  defaultPaintProductId: string | null
}) {
  for (const row of params.rows.filter((candidate) => candidate.included)) {
    const roomName = params.roomLabels.get(row.roomId) ?? humanizeRoomCode(row.roomId)
    const paintProduct = resolvePaintProductLabel({
      paintProductId: row.paintProductId || params.defaultPaintProductId,
      fallbackLabel: row.paintProductLabel,
      paintLabelsById: params.paintLabels,
    })
    const notes = prepFragments(row.notes)
    appendScopeBucket(params.sectionBuckets, params.scope, row.price, {
      room: roomName,
      paintProduct,
      note: notes.join(', '),
      coat: row.coatCount,
      primeMode: row.primeMode,
    })
  }
}

function extractRoomRows(params: {
  sectionBuckets: ScopeBuckets
  roomLabels: Map<string, string>
  paintLabels: Map<string, string>
  roomWallScopes: NormalizedPaintScopeRow[]
  roomCeilingScopes: NormalizedPaintScopeRow[]
  wallPaintProductId: string | null
  ceilingPaintProductId: string | null
}) {
  applyPaintScopeRows({
    sectionBuckets: params.sectionBuckets,
    scope: 'walls',
    rows: params.roomWallScopes,
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    defaultPaintProductId: params.wallPaintProductId,
  })
  applyPaintScopeRows({
    sectionBuckets: params.sectionBuckets,
    scope: 'ceilings',
    rows: params.roomCeilingScopes,
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    defaultPaintProductId: params.ceilingPaintProductId,
  })
}

function classifyTrimRows(params: {
  trimItems: NormalizedTrimItemRow[]
  trimMetaById: Map<string, NormalizedTrimCatalogRow>
}) {
  return params.trimItems.map((row) => {
    const meta = params.trimMetaById.get(row.trimId)
    const label = meta?.label || row.trimLabel
    return {
      ...row,
      category: trimCategory(label, meta?.family ?? row.family),
      label,
    } satisfies ClassifiedTrimRow
  })
}

function collectTrimRows(params: {
  sectionBuckets: ScopeBuckets
  scope: CustomerEstimateSectionKey
  rows: ClassifiedTrimRow[]
  roomLabels: Map<string, string>
  paintLabels: Map<string, string>
  trimPaintProductId: string | null
}) {
  for (const row of params.rows) {
    const roomName = params.roomLabels.get(row.roomId) ?? humanizeRoomCode(row.roomId)
    const notes = prepFragments(row.notes)
    const paintProduct = resolvePaintProductLabel({
      paintProductId: row.paintProductId || params.trimPaintProductId,
      fallbackLabel: row.paintProductLabel,
      paintLabelsById: params.paintLabels,
    })
    appendScopeBucket(params.sectionBuckets, params.scope, row.price, {
      room: roomName,
      subjectLabel: params.scope === 'trim' ? undefined : row.label,
      paintProduct,
      note: notes.join(', '),
      coat: row.coats,
      primeMode: row.primeMode,
    })
  }
}

function collectDoorScopeRows(params: {
  sectionBuckets: ScopeBuckets
  rows: NormalizedDoorScopeRow[]
  roomLabels: Map<string, string>
  paintLabels: Map<string, string>
  trimPaintProductId: string | null
}) {
  for (const row of params.rows.filter((candidate) => candidate.included)) {
    const roomName = params.roomLabels.get(row.roomId) ?? humanizeRoomCode(row.roomId)
    const notes = prepFragments(row.notes)
    const paintProduct = resolvePaintProductLabel({
      paintProductId: row.paintProductId || params.trimPaintProductId,
      fallbackLabel: row.paintProductLabel,
      paintLabelsById: params.paintLabels,
    })
    appendScopeBucket(params.sectionBuckets, 'doors', row.price, {
      room: roomName,
      subjectLabel: row.doorLabel,
      paintProduct,
      note: notes.join(', '),
      coat: row.coats,
      primeMode: row.primeMode,
    })
  }
}

function collectDrywallScopeRows(params: {
  sectionBuckets: ScopeBuckets
  rows: NormalizedDrywallScopeRow[]
  roomLabels: Map<string, string>
}) {
  for (const row of params.rows.filter((candidate) => candidate.included)) {
    const roomName = params.roomLabels.get(row.roomId) ?? humanizeRoomCode(row.roomId)
    const qtyText = row.quantity != null && row.unit ? `${row.quantity} ${row.unit}` : ''
    appendScopeBucket(params.sectionBuckets, 'drywall', row.price, {
      room: roomName,
      subjectLabel: textJoin([row.surface, row.repairLabel, qtyText]),
      note: prepFragments(row.notes).join(', '),
    })
  }
}

function extractTrimRows(params: {
  sectionBuckets: ScopeBuckets
  roomTrimScopes: NormalizedTrimScopeRow[]
  roomDoorScopes?: NormalizedDoorScopeRow[]
  roomDrywallScopes?: NormalizedDrywallScopeRow[]
  trimItems: NormalizedTrimItemRow[]
  trimMetaById: Map<string, NormalizedTrimCatalogRow>
  roomLabels: Map<string, string>
  paintLabels: Map<string, string>
  trimPaintProductId: string | null
}) {
  const trimTypeRows = classifyTrimRows({
    ...params,
    trimItems: [
      ...params.roomTrimScopes.filter((row) => row.included),
      ...params.trimItems,
    ],
  })
  const trimCategories = new Set(['baseboard', 'crown', 'window_casing'])
  const doorCategories = new Set(['door', 'door_casing'])
  const cabinetCategories = new Set(['cabinet'])
  collectTrimRows({
    sectionBuckets: params.sectionBuckets,
    scope: 'trim',
    rows: trimTypeRows.filter(
      (row) =>
        trimCategories.has(row.category) ||
        (!doorCategories.has(row.category) && !cabinetCategories.has(row.category))
    ),
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    trimPaintProductId: params.trimPaintProductId,
  })
  collectDoorScopeRows({
    sectionBuckets: params.sectionBuckets,
    rows: params.roomDoorScopes ?? [],
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    trimPaintProductId: params.trimPaintProductId,
  })
  collectTrimRows({
    sectionBuckets: params.sectionBuckets,
    scope: 'doors',
    rows: trimTypeRows.filter((row) => doorCategories.has(row.category)),
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    trimPaintProductId: params.trimPaintProductId,
  })
  collectTrimRows({
    sectionBuckets: params.sectionBuckets,
    scope: 'cabinets',
    rows: trimTypeRows.filter((row) => cabinetCategories.has(row.category)),
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    trimPaintProductId: params.trimPaintProductId,
  })
}

function extractProductRows(params: {
  sectionBuckets: ScopeBuckets
  otherRows: NormalizedOtherRow[]
}) {
  for (const row of params.otherRows) {
    const desc = labelOrFallback(row.description, '') || labelOrFallback(row.location, '')
    params.sectionBuckets.other.price += row.price
    params.sectionBuckets.other.texts.push(
      cleanCustomerFacingText(
        textJoin([
          desc || 'Additional work',
          row.location ? `in ${labelOrFallback(row.location, humanizeRoomCode(row.location))}` : '',
          row.qty ? `${row.qty}${row.uom ? ` ${row.uom}` : ''}` : '',
        ])
      )
    )
  }
}

export function extractScopeBuckets(params: {
  rooms: NormalizedRoomRow[]
  roomWallScopes: NormalizedPaintScopeRow[]
  roomCeilingScopes: NormalizedPaintScopeRow[]
  roomTrimScopes: NormalizedTrimScopeRow[]
  roomDoorScopes?: NormalizedDoorScopeRow[]
  roomDrywallScopes?: NormalizedDrywallScopeRow[]
  trimItems: NormalizedTrimItemRow[]
  otherRows: NormalizedOtherRow[]
  paintCatalogRows: NormalizedPaintCatalogRow[]
  trimCatalogRows: NormalizedTrimCatalogRow[]
  jobsettings: NormalizedJobSettings
}) {
  const roomLabels = roomNameMap(params.rooms)
  const paintLabels = paintNameMap(params.paintCatalogRows)
  const wallPaintProductId = jobSettingsPaintProductId(params.jobsettings, 'walls') || null
  const ceilingPaintProductId = jobSettingsPaintProductId(params.jobsettings, 'ceilings') || null
  const trimPaintProductId = jobSettingsPaintProductId(params.jobsettings, 'trim') || null
  const trimMetaById = new Map(params.trimCatalogRows.map((row) => [row.id, row]))

  const sectionBuckets = createScopeBuckets()
  extractRoomRows({
    sectionBuckets,
    roomLabels,
    paintLabels,
    roomWallScopes: params.roomWallScopes,
    roomCeilingScopes: params.roomCeilingScopes,
    wallPaintProductId,
    ceilingPaintProductId,
  })
  extractTrimRows({
    sectionBuckets,
    roomTrimScopes: params.roomTrimScopes,
    roomDoorScopes: params.roomDoorScopes,
    trimItems: params.trimItems,
    trimMetaById,
    roomLabels,
    paintLabels,
    trimPaintProductId,
  })
  collectDrywallScopeRows({
    sectionBuckets,
    rows: params.roomDrywallScopes ?? [],
    roomLabels,
  })
  extractProductRows({ sectionBuckets, otherRows: params.otherRows })

  return sectionBuckets
}
