import type {
  BuiltCustomerEstimateDocument,
  CompanyProfile,
  CustomerEstimateDocument,
  CustomerEstimateCustomer,
  CustomerEstimatePricingSummary,
  CustomerEstimateQuoteRow,
  CustomerEstimateSectionKey,
  EstimatePublicSnapshot,
  Unsafe,
} from './types.ts'
import { buildDefaultTermsText, splitTermsText } from './presets.ts'
import { reconcileWholeDollarRows } from '../estimator/pricingPolicies.ts'

type CustomerEstimateRow = Unsafe
type CustomerEstimateCatalogs = {
  paint_products?: CustomerEstimateRow[]
  trim_items?: CustomerEstimateRow[]
}

export interface CustomerEstimateInput {
  estimate: CustomerEstimateRow
  job: CustomerEstimateRow
  customer?: CustomerEstimateRow | null
  company: CompanyProfile
  inputs: {
    rooms?: CustomerEstimateRow[]
    room_wall_scopes?: CustomerEstimateRow[]
    room_ceiling_scopes?: CustomerEstimateRow[]
    room_trim_scopes?: CustomerEstimateRow[]
    trim_items?: CustomerEstimateRow[]
    other?: CustomerEstimateRow[]
    jobsettings?: CustomerEstimateRow | null
  }
  catalogs?: CustomerEstimateCatalogs | null
  settings?: {
    quote_validity_days?: number | null
    terms_text?: string | null
    default_template_key?: string | null
  }
  pricingSummary?: CustomerEstimatePricingSummary | null
  overrides?: {
    title?: string
    intro_paragraph?: string
    closing_paragraph?: string
    scope_text_edits?: Partial<Record<CustomerEstimateSectionKey, string>>
    quote_validity_days?: number | string | null
    deposit_language?: string
    card_fee_note?: string
  }
  publicMeta?: {
    status?: string
    sent_at?: string | null
    viewed_at?: string | null
    accepted_at?: string | null
    declined_at?: string | null
    public_token?: string | null
  }
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNum(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function formatHumanDate(value: string) {
  const raw = asText(value)
  if (!raw) return ''
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw)
  if (isoDate) {
    const year = Number(isoDate[1])
    const month = Number(isoDate[2])
    const day = Number(isoDate[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return raw
}

function listJoin(values: string[]) {
  const filtered = values.map((value) => asText(value)).filter(Boolean)
  if (filtered.length === 0) return ''
  if (filtered.length === 1) return filtered[0]
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`
  return `${filtered.slice(0, -1).join(', ')}, and ${filtered[filtered.length - 1]}`
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.map((value) => asText(value)).filter(Boolean)))
}

function humanizeIdentifier(value: string) {
  const trimmed = asText(value)
  if (!trimmed) return ''
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])/g, (_, ch: string) => ch.toUpperCase())
    .trim()
}

function humanizeRoomCode(value: string) {
  const trimmed = asText(value).toUpperCase()
  if (!trimmed) return ''
  const match = /^R0*(\d+)$/i.exec(trimmed)
  if (match) return `Room ${Number(match[1])}`
  return humanizeIdentifier(trimmed) || 'Room'
}

function labelOrFallback(value: unknown, fallback: string) {
  const text = asText(value)
  if (!text) return fallback
  if (/^[0-9a-f-]{16,}$/i.test(text)) return fallback
  return text
}

function roomNameMap(rows: Unsafe[]) {
  const map = new Map<string, string>()
  for (const row of rows) {
    const roomId = asText(row.room_id).toUpperCase()
    if (!roomId) continue
    map.set(roomId, labelOrFallback(row.room_name, humanizeRoomCode(roomId)))
  }
  return map
}

function paintNameMap(rows: Unsafe[]) {
  const map = new Map<string, string>()
  for (const row of rows) {
    const paintId = asText(row.id).toUpperCase()
    const label =
      asText(row.display_name) ||
      asText(row.label) ||
      asText(row.name) ||
      humanizeIdentifier(asText(row.display_id))
    const displayId = asText(row.display_id).toUpperCase()
    if (label) {
      if (paintId) map.set(paintId, label)
      if (displayId) map.set(displayId, label)
    }
  }
  return map
}

function jobSettingsPaintProductId(
  jobsettings: Unsafe | null | undefined,
  keys: string[]
) {
  if (!jobsettings || typeof jobsettings !== 'object') return ''
  for (const key of keys) {
    const value = asText((jobsettings as Unsafe)[key]).toUpperCase()
    if (value) return value
  }
  return ''
}

function resolvePaintProductLabel(params: {
  paintProductId?: string | null
  fallbackLabel?: unknown
  paintLabelsById: Map<string, string>
}) {
  const productId = asText(params.paintProductId).toUpperCase()
  const catalogLabel = productId ? params.paintLabelsById.get(productId) ?? '' : ''
  return (
    labelOrFallback(catalogLabel, '') ||
    labelOrFallback(params.fallbackLabel, '') ||
    labelOrFallback(productId, '')
  )
}

function cleanCustomerFacingText(value: string) {
  const raw = asText(value)
  if (!raw) return ''
  return raw
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/\b[a-f0-9]{16,}\b/gi, '')
    .replace(/\s*[—-]\s*\$\d[\d,]*(?:\.\d{2})?/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s+-\s+/g, ' - ')
    .trim()
}

function formatAddressFromParts(params: {
  address?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}) {
  const street = asText(params.street)
  const city = asText(params.city)
  const state = asText(params.state)
  const zip = asText(params.zip)
  const fallbackAddress = asText(params.address)
  const line1 = street || fallbackAddress
  const cityStateZip = [state, zip].filter(Boolean).join(' ').trim()
  const line2 = city && cityStateZip ? `${city}, ${cityStateZip}` : city || cityStateZip
  return [line1, line2].filter(Boolean).join('\n')
}

function textJoin(values: string[]) {
  return values.filter((value) => !!value.trim()).join(' ')
}

function sentenceCase(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function trimCategory(labelOrCategory: string, family?: string | null) {
  const familyRaw = asText(family).toLowerCase()
  if (familyRaw.includes('door')) {
    if (familyRaw.includes('casing')) return 'door_casing'
    return 'door'
  }
  if (familyRaw.includes('baseboard') || familyRaw.includes('base board') || familyRaw.includes('trim')) return 'baseboard'
  const raw = labelOrCategory.toLowerCase().replace(/[^a-z0-9]/g, '')
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

function normalizeScopeText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\b(drywall)\b/gi, 'drywall')
    .replace(/\b(wallpaper)\b/gi, 'wallpaper')
    .trim()
}

function splitParagraphs(value: string) {
  return splitTermsText(value)
}

function buildScopeText(params: {
  label: string
  fallbackTexts: string[]
  overrideText?: string
}) {
  const override = asText(params.overrideText)
  if (override) return override
  const fallback = uniqueText(params.fallbackTexts).map((text) => cleanCustomerFacingText(text)).filter(Boolean).join('\n')
  if (fallback) return fallback
  return `${params.label} is included in this quote.`
}

function buildCustomerEstimateSections(params: {
  scoped: Record<CustomerEstimateSectionKey, ScopeBucket>
  overrides?: {
    scope_text_edits?: Partial<Record<CustomerEstimateSectionKey, string>>
  }
}) {
  const sectionDefinitions: Array<{
    key: CustomerEstimateSectionKey
    label: string
  }> = [
    { key: 'walls', label: 'Walls' },
    { key: 'ceilings', label: 'Ceilings' },
    { key: 'trim', label: 'Trim' },
    { key: 'doors', label: 'Doors' },
    { key: 'cabinets', label: 'Cabinets' },
    { key: 'other', label: 'Other' },
  ]

  return sectionDefinitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    text: buildScopeText({
      label: definition.label === 'Other' ? 'Other work' : definition.label,
      fallbackTexts: params.scoped[definition.key].texts,
      overrideText: params.overrides?.scope_text_edits?.[definition.key],
    }),
    price: params.scoped[definition.key].price > 0 ? params.scoped[definition.key].price : null,
  }))
}

function prepFragments(texts: string[]) {
  const joined = texts.join(' | ').toLowerCase()
  const parts: string[] = []
  if (joined.includes('drywall')) parts.push('repair minor drywall issues where needed')
  if (joined.includes('wallpaper')) parts.push('remove wallpaper')
  if (joined.includes('stain')) parts.push('stain block repaired or discolored areas')
  if (joined.includes('major special prep') || joined.includes('special prep')) parts.push('handle special prep as needed')
  if (parts.length === 0 && texts.some((t) => !!t.trim())) {
    parts.push(...texts.filter(Boolean).map((text) => sentenceCase(text)))
  }
  return uniqueText(parts)
}

type ScopeBucket = {
  texts: string[]
  price: number
  rooms: string[]
  paintProducts: string[]
  subjectLabels: string[]
  notes: string[]
  coats: number[]
  primeModes: Array<'SPOT' | 'FULL'>
}

type ScopeBuckets = Record<CustomerEstimateSectionKey, ScopeBucket>
type TrimTypeRow = Unsafe & { category: string; label: string; price: number }

function createScopeBuckets(): Record<CustomerEstimateSectionKey, ScopeBucket> {
  return {
    walls: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
    ceilings: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
    trim: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
    doors: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
    cabinets: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
    other: { texts: [], price: 0, rooms: [], paintProducts: [], subjectLabels: [], notes: [], coats: [], primeModes: [] },
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

function pickPrice(row: Unsafe) {
  return (
    asNum(row.effective_total) ??
    asNum(row.final_total) ??
    asNum(row.raw_total) ??
    asNum(row.override_total) ??
    0
  )
}

function resolvePrimeMode(row: Unsafe) {
  const mode = asText(row.prime_mode).toUpperCase()
  if (mode === 'FULL' || mode === 'SPOT') return mode
  return null
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
  rows: Unsafe[]
  roomLabels: Map<string, string>
  paintLabels: Map<string, string>
  defaultPaintProductId: string | null
  prepKeys: string[]
  coatKeys: string[]
}) {
  const activeRows = params.rows.filter((row) => asText(row.active || row.include).toUpperCase() !== 'N')
  for (const row of activeRows) {
    const roomId = asText(row.room_id).toUpperCase()
    const roomName = params.roomLabels.get(roomId) ?? humanizeRoomCode(roomId)
    const paintProduct = resolvePaintProductLabel({
      paintProductId: asText(row.paint_product_id) || params.defaultPaintProductId,
      fallbackLabel: asText(row.paint_product_label),
      paintLabelsById: params.paintLabels,
    })
    const notes = prepFragments(params.prepKeys.map((key) => asText(row[key])))
    const coats = params.coatKeys.map((key) => asNum(row[key])).find((value) => value != null) ?? null
    appendScopeBucket(params.sectionBuckets, params.scope, pickPrice(row), {
      room: roomName,
      paintProduct,
      note: notes.join(', '),
      coat: coats,
      primeMode: resolvePrimeMode(row),
    })
  }
}

function extractRoomRows(params: {
  sectionBuckets: ScopeBuckets
  roomLabels: Map<string, string>
  paintLabels: Map<string, string>
  roomWallScopes: Unsafe[]
  roomCeilingScopes: Unsafe[]
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
    prepKeys: ['notes', 'walls_prep_override', 'scope_notes'],
    coatKeys: ['paint_coats', 'wall_coats'],
  })
  applyPaintScopeRows({
    sectionBuckets: params.sectionBuckets,
    scope: 'ceilings',
    rows: params.roomCeilingScopes,
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    defaultPaintProductId: params.ceilingPaintProductId,
    prepKeys: ['notes', 'ceiling_prep_override', 'scope_notes'],
    coatKeys: ['paint_coats', 'ceiling_coats'],
  })
}

function classifyTrimRows(params: {
  trimItems: Unsafe[]
  trimLabelById: Map<string, string>
  trimMetaById: Map<string, { family: string; label: string }>
}) {
  return params.trimItems.map((row) => {
    const trimId = asText(row.trim_menu_id).toUpperCase()
    const meta = params.trimMetaById.get(trimId)
    const label =
      meta?.label ||
      labelOrFallback(row.trim_menu_label, '') ||
      params.trimLabelById.get(trimId) ||
      humanizeIdentifier(trimId) ||
      trimId

    return {
      ...row,
      price: pickPrice(row),
      category: trimCategory(label, meta?.family ?? null),
      label,
    } satisfies TrimTypeRow
  })
}

function collectTrimRows(params: {
  sectionBuckets: ScopeBuckets
  scope: CustomerEstimateSectionKey
  rows: TrimTypeRow[]
  roomLabels: Map<string, string>
  paintLabels: Map<string, string>
  trimPaintProductId: string | null
}) {
  for (const row of params.rows) {
    const roomId = asText(row.room_id).toUpperCase()
    const roomName = params.roomLabels.get(roomId) ?? humanizeRoomCode(roomId)
    const notes = prepFragments([asText(row.notes), asText(row.prep_level_override), asText(row.override_description)])
    const paintProduct = resolvePaintProductLabel({
      paintProductId: asText(row.paint_product_id) || params.trimPaintProductId,
      fallbackLabel: asText(row.paint_product_label),
      paintLabelsById: params.paintLabels,
    })
    appendScopeBucket(params.sectionBuckets, params.scope, row.price, {
      room: roomName,
      subjectLabel: row.label,
      paintProduct,
      note: notes.join(', '),
      coat: asNum(row.coats) ?? null,
      primeMode: resolvePrimeMode(row),
    })
  }
}

function extractTrimRows(params: {
  sectionBuckets: ScopeBuckets
  trimItems: Unsafe[]
  trimLabelById: Map<string, string>
  trimMetaById: Map<string, { family: string; label: string }>
  roomLabels: Map<string, string>
  paintLabels: Map<string, string>
  trimPaintProductId: string | null
}) {
  const trimTypeRows = classifyTrimRows(params)
  collectTrimRows({
    sectionBuckets: params.sectionBuckets,
    scope: 'trim',
    rows: trimTypeRows.filter((row) => ['baseboard', 'crown', 'window_casing'].includes(row.category)),
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    trimPaintProductId: params.trimPaintProductId,
  })
  collectTrimRows({
    sectionBuckets: params.sectionBuckets,
    scope: 'doors',
    rows: trimTypeRows.filter((row) => ['door', 'door_casing'].includes(row.category)),
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    trimPaintProductId: params.trimPaintProductId,
  })
  collectTrimRows({
    sectionBuckets: params.sectionBuckets,
    scope: 'cabinets',
    rows: trimTypeRows.filter((row) => row.category === 'cabinet'),
    roomLabels: params.roomLabels,
    paintLabels: params.paintLabels,
    trimPaintProductId: params.trimPaintProductId,
  })
}

function extractProductRows(params: {
  sectionBuckets: ScopeBuckets
  otherRows: Unsafe[]
}) {
  for (const row of params.otherRows) {
    const desc = labelOrFallback(asText(row.client_description), '') || labelOrFallback(asText(row.location), '')
    const location = asText(row.location)
    const qty = asNum(row.qty) ?? 1
    const uom = asText(row.uom)
    params.sectionBuckets.other.price += pickPrice(row)
    params.sectionBuckets.other.texts.push(
      cleanCustomerFacingText(
        textJoin([
          desc || 'Additional work',
          location ? `in ${labelOrFallback(location, humanizeRoomCode(location))}` : '',
          qty ? `${qty}${uom ? ` ${uom}` : ''}` : '',
        ])
      )
    )
  }
}

function finalizeScopeBuckets(sectionBuckets: ScopeBuckets) {
  const finalizeBucket = (scope: CustomerEstimateSectionKey, scopeWord: string) => {
    const bucket = sectionBuckets[scope]
    if (bucket.price <= 0) {
      sectionBuckets[scope] = { ...bucket, texts: [] }
      return
    }

    const sentence = buildSentence({ bucket, scopeWord })
    if (sentence) {
      sectionBuckets[scope] = { ...bucket, texts: [sentence] }
      return
    }

    sectionBuckets[scope] = {
      ...bucket,
      texts: uniqueText(bucket.texts).map((text) => cleanCustomerFacingText(text)).filter(Boolean),
    }
  }

  finalizeBucket('walls', 'on walls')
  finalizeBucket('ceilings', 'on ceilings')
  finalizeBucket('trim', 'on trim')
  finalizeBucket('doors', 'on doors')
  finalizeBucket('cabinets', 'on cabinets')
  sectionBuckets.other = {
    ...sectionBuckets.other,
    texts:
      sectionBuckets.other.price > 0
        ? uniqueText(sectionBuckets.other.texts).map((text) => cleanCustomerFacingText(text)).filter(Boolean)
        : [],
  }
}

function buildSentence(params: {
  bucket: ScopeBucket
  scopeWord: string
}) {
  const rooms = uniqueText(params.bucket.rooms)
  const paintProducts = uniqueText(params.bucket.paintProducts)
  const subjectLabels = uniqueText(params.bucket.subjectLabels)
  const notes = uniqueText(params.bucket.notes)
  const coatCount = params.bucket.coats.find((value) => Number.isFinite(value)) ?? null
  const primeText = params.bucket.primeModes.includes('FULL')
    ? ', with full prime'
    : params.bucket.primeModes.includes('SPOT')
      ? ', with spot prime'
      : ''
  const prep = notes.length > 0 ? `Prep, ${listJoin(notes)}, and` : 'Prep and'
  const coatText = coatCount != null ? `paint ${coatCount} coats` : 'paint'
  const subjectText = subjectLabels.length > 0 ? `for ${listJoin(subjectLabels)}` : ''
  const roomText = rooms.length > 0 ? `in ${listJoin(rooms)}` : ''
  const productText = paintProducts.length > 0 ? `, using ${listJoin(paintProducts)}` : ''
  return normalizeScopeText(
    cleanCustomerFacingText(
      textJoin([prep, coatText, params.scopeWord, subjectText, roomText, productText, primeText])
    )
  )
}

function extractScopeRows(params: {
  rooms: Unsafe[]
  roomWallScopes: Unsafe[]
  roomCeilingScopes: Unsafe[]
  roomTrimScopes: Unsafe[]
  trimItems: Unsafe[]
  otherRows: Unsafe[]
  catalogs?: Unsafe
  jobsettings?: Unsafe | null
}) {
  const roomLabels = roomNameMap(params.rooms)
  const paintLabels = paintNameMap((params.catalogs?.paint_products as Unsafe[] | undefined) ?? [])
  const wallPaintProductId =
    jobSettingsPaintProductId(params.jobsettings, ['walls_paint_id', 'wall_paint_id']) || null
  const ceilingPaintProductId =
    jobSettingsPaintProductId(params.jobsettings, ['ceiling_paint_id']) || null
  const trimPaintProductId = jobSettingsPaintProductId(params.jobsettings, ['trim_paint_id']) || null
  const trimCatalogRows = (params.catalogs?.trim_items as Unsafe[] | undefined) ?? []
  const trimLabelById = new Map<string, string>()
  const trimMetaById = new Map<string, { family: string; label: string }>()
  for (const row of trimCatalogRows) {
    const id = asText(row.id).toUpperCase()
    if (!id) continue
    const label = asText(row.label) || id
    trimLabelById.set(id, label)
    trimMetaById.set(id, {
      family: trimCategory(asText(row.label), asText(row.family)),
      label,
    })
  }

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
    trimItems: params.trimItems,
    trimLabelById,
    trimMetaById,
    roomLabels,
    paintLabels,
    trimPaintProductId,
  })
  extractProductRows({ sectionBuckets, otherRows: params.otherRows })
  finalizeScopeBuckets(sectionBuckets)

  return sectionBuckets
}

function buildCustomerProfile(params: {
  customer?: Unsafe | null
  job: Unsafe
}) : CustomerEstimateCustomer {
  const customer = (params.customer ?? {}) as Unsafe
  const job = params.job
  const address = formatAddressFromParts({
    address: asText(customer.address || job.customer_address),
    street: asText(customer.street),
    city: asText(customer.city),
    state: asText(customer.state),
    zip: asText(customer.zip),
  })
  return {
    name: asText(customer.name || job.customer_name),
    email: asText(customer.email || job.customer_email),
    phone: asText(customer.phone || job.customer_phone),
    address,
    street: asText(customer.street),
    city: asText(customer.city),
    state: asText(customer.state),
    zip: asText(customer.zip),
  }
}

export function buildCustomerEstimateDocument(params: CustomerEstimateInput): BuiltCustomerEstimateDocument {
  const estimate = params.estimate
  const job = params.job
  const total = params.pricingSummary?.finalTotal ?? null
  const scoped = extractScopeRows({
    rooms: params.inputs.rooms ?? [],
    roomWallScopes: params.inputs.room_wall_scopes ?? [],
    roomCeilingScopes: params.inputs.room_ceiling_scopes ?? [],
    roomTrimScopes: params.inputs.room_trim_scopes ?? [],
    trimItems: params.inputs.trim_items ?? [],
    otherRows: params.inputs.other ?? [],
    catalogs: params.catalogs ?? undefined,
    jobsettings: params.inputs.jobsettings ?? undefined,
  })

  const versionName = asText(estimate.version_name) || 'Quote'
  const flowVersion = 'v2'
  const status = asText(params.publicMeta?.status) || asText(estimate.version_state) || 'draft'
  const title = params.overrides?.title?.trim() || versionName
  const estimateDate = asText(job.estimate_date || estimate.created_at || estimate.updated_at)
  const intro =
    params.overrides?.intro_paragraph?.trim() ||
    `Thank you for the opportunity to prepare this quote for ${asText(job.customer_name) || 'your project'}.`
  const closing =
    params.overrides?.closing_paragraph?.trim() ||
    'Please review the quote below. If everything looks right, you can accept it directly from the secure link.'
  const quoteValidityDays = Number(params.overrides?.quote_validity_days ?? params.settings?.quote_validity_days ?? 90)
  const depositLanguage =
    params.overrides?.deposit_language?.trim() ||
    'A deposit may be required for scheduling or special-order materials.'
  const cardFeeNote =
    params.overrides?.card_fee_note?.trim() ||
    'Credit card payments are subject to a processing fee.'
  const termsText = params.settings?.terms_text?.trim() || ''
  const terms = splitParagraphs(
    termsText ||
      buildDefaultTermsText({
        quoteValidityDays,
        estimateDate,
        depositLanguage,
        cardFeeNote,
      })
  )

  const sections = buildCustomerEstimateSections({
    scoped,
    overrides: params.overrides,
  }).filter((section) => section.price != null && section.text.trim())
  const customer = buildCustomerProfile({ customer: params.customer ?? null, job })
  const quoteRows: CustomerEstimateQuoteRow[] = reconcileWholeDollarRows(
    sections.map((section) => ({
      key: section.key,
      label: section.label,
      description: section.text.trim(),
      price: section.price ?? 0,
    })),
    total ?? null
  )
  const computedTotal = Math.round(total ?? round2(quoteRows.reduce((sum, section) => sum + section.price, 0)))

  return {
    meta: {
      estimate_id: asText(estimate.id),
      version_name: versionName,
      version_state: asText(estimate.version_state) || 'draft',
      flow_version: flowVersion,
      title,
      quote_date: formatHumanDate(estimateDate),
      sent_at: params.publicMeta?.sent_at ?? null,
      viewed_at: params.publicMeta?.viewed_at ?? null,
      accepted_at: params.publicMeta?.accepted_at ?? null,
      declined_at: params.publicMeta?.declined_at ?? null,
      status,
      public_token: params.publicMeta?.public_token ?? null,
    },
    company: params.company,
    customer,
    intro_paragraph: intro,
    closing_paragraph: closing,
    quote_validity_days: quoteValidityDays,
    deposit_language: depositLanguage,
    card_fee_note: cardFeeNote,
    quote_rows: quoteRows,
    scopes: sections,
    total: computedTotal,
    terms,
    source_meta: {
      company: {
        business_name: !!asText(params.company.business_name),
        main_phone: !!asText(params.company.main_phone),
        business_email: !!asText(params.company.business_email),
        address: !!asText(params.company.address),
        website: !!asText(params.company.website),
        sender_signature: !!asText(params.company.sender_signature),
        logo_url: !!asText(params.company.logo_url),
      },
      settings: {
        quote_validity_days:
          params.overrides?.quote_validity_days != null ||
          params.settings?.quote_validity_days != null,
        terms_text: !!params.settings?.terms_text?.trim(),
      },
      overrides: {
        title: !!params.overrides?.title?.trim(),
        intro_paragraph: !!params.overrides?.intro_paragraph?.trim(),
        closing_paragraph: !!params.overrides?.closing_paragraph?.trim(),
        deposit_language: !!params.overrides?.deposit_language?.trim(),
        card_fee_note: !!params.overrides?.card_fee_note?.trim(),
      },
    },
  }
}

export function buildEstimatePublicSnapshot(params: {
  version: Unsafe
  document: CustomerEstimateDocument
  draft: Record<string, unknown>
  publicUrl: string | null
}): EstimatePublicSnapshot {
  return {
    estimate_id: params.document.meta.estimate_id,
    estimate_version_id: asText(params.version.id),
    version_number: Number(params.version.version_number ?? 0),
    status: (asText(params.version.status) || 'draft') as EstimatePublicSnapshot['status'],
    public_token: asText(params.version.public_token) || null,
    public_url: params.publicUrl,
    draft: params.draft,
    document: params.document,
    snapshot_json: {
      document: params.document,
      draft: params.draft,
    },
    sent_at: asText(params.version.sent_at) || null,
    viewed_at: asText(params.version.viewed_at) || null,
    accepted_at: asText(params.version.accepted_at) || null,
    declined_at: asText(params.version.declined_at) || null,
    locked_at: asText(params.version.locked_at) || null,
  }
}
