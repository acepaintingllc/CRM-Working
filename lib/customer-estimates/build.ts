import type {
  CompanyProfile,
  CustomerEstimateCustomer,
  CustomerEstimateDocument,
  CustomerEstimatePricingSummary,
  CustomerEstimateQuoteRow,
  CustomerEstimateSection,
  CustomerEstimateSectionKey,
  EstimatePublicSnapshot,
  Unsafe,
} from './types'
import { buildDefaultTermsText, splitTermsText } from './presets.ts'
import { reconcileWholeDollarRows } from '../estimator/pricingPolicies.ts'

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
  return `${params.label} is included in this estimate.`
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
  if (params.room) bucket.rooms.push(params.room)
  if (params.paintProduct) bucket.paintProducts.push(params.paintProduct)
  if (params.subjectLabel) bucket.subjectLabels.push(params.subjectLabel)
  if (params.note) bucket.notes.push(params.note)
  if (params.coat != null) bucket.coats.push(params.coat)
  if (params.primeMode === 'SPOT' || params.primeMode === 'FULL') bucket.primeModes.push(params.primeMode)
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

  const pickPrice = (row: Unsafe) =>
    asNum(row.effective_total) ??
    asNum(row.final_total) ??
    asNum(row.raw_total) ??
    asNum(row.override_total) ??
    0

  const wallScopes = params.roomWallScopes.filter((row) => asText(row.active || row.include).toUpperCase() !== 'N')
  for (const row of wallScopes) {
    const price = pickPrice(row)
    sectionBuckets.walls.price += price
    const roomId = asText(row.room_id).toUpperCase()
    const roomName = roomLabels.get(roomId) ?? humanizeRoomCode(roomId)
    const paintProduct = resolvePaintProductLabel({
      paintProductId: asText(row.paint_product_id) || wallPaintProductId,
      fallbackLabel: asText(row.paint_product_label),
      paintLabelsById: paintLabels,
    })
    const notes = prepFragments([asText(row.notes), asText(row.walls_prep_override), asText(row.scope_notes)])
    const coats = asNum(row.paint_coats) ?? asNum(row.wall_coats) ?? null
    const primeMode = asText(row.prime_mode).toUpperCase() === 'FULL'
      ? 'FULL'
      : asText(row.prime_mode).toUpperCase() === 'SPOT'
        ? 'SPOT'
        : null
    addToBucket(sectionBuckets.walls, {
      room: roomName,
      paintProduct,
      note: notes.join(', '),
      coat: coats,
      primeMode,
    })
  }

  const ceilingScopes = params.roomCeilingScopes.filter((row) => asText(row.active || row.include).toUpperCase() !== 'N')
  for (const row of ceilingScopes) {
    const price = pickPrice(row)
    sectionBuckets.ceilings.price += price
    const roomId = asText(row.room_id).toUpperCase()
    const roomName = roomLabels.get(roomId) ?? humanizeRoomCode(roomId)
    const paintProduct = resolvePaintProductLabel({
      paintProductId: asText(row.paint_product_id) || ceilingPaintProductId,
      fallbackLabel: asText(row.paint_product_label),
      paintLabelsById: paintLabels,
    })
    const notes = prepFragments([asText(row.notes), asText(row.ceiling_prep_override), asText(row.scope_notes)])
    const coats = asNum(row.paint_coats) ?? asNum(row.ceiling_coats) ?? null
    const primeMode = asText(row.prime_mode).toUpperCase() === 'FULL'
      ? 'FULL'
      : asText(row.prime_mode).toUpperCase() === 'SPOT'
        ? 'SPOT'
        : null
    addToBucket(sectionBuckets.ceilings, {
      room: roomName,
      paintProduct,
      note: notes.join(', '),
      coat: coats,
      primeMode,
    })
  }

  const trimTypeRows = params.trimItems.map((row) => {
    const trimId = asText(row.trim_menu_id).toUpperCase()
    const meta = trimMetaById.get(trimId)
    const label =
      meta?.label ||
      labelOrFallback(row.trim_menu_label, '') ||
      trimLabelById.get(trimId) ||
      humanizeIdentifier(trimId) ||
      trimId
    return {
      ...row,
      price: pickPrice(row),
      category: trimCategory(label, meta?.family ?? null),
      label,
    }
  })

  const trimRows = trimTypeRows.filter((row) => row.category === 'baseboard' || row.category === 'crown' || row.category === 'window_casing')
  const doorRows = trimTypeRows.filter((row) => row.category === 'door' || row.category === 'door_casing')
  const cabinetRows = trimTypeRows.filter((row) => row.category === 'cabinet')

  const collectTrimRows = (rows: Array<Unsafe & { label: string; price: number }>, scope: CustomerEstimateSectionKey) => {
    for (const row of rows) {
      sectionBuckets[scope].price += row.price
      const roomId = asText(row.room_id).toUpperCase()
      const roomName = roomLabels.get(roomId) ?? humanizeRoomCode(roomId)
      const coats = asNum(row.coats) ?? null
      const notes = prepFragments([asText(row.notes), asText(row.prep_level_override), asText(row.override_description)])
      const paintProduct = resolvePaintProductLabel({
        paintProductId: asText(row.paint_product_id) || trimPaintProductId,
        fallbackLabel: asText(row.paint_product_label),
        paintLabelsById: paintLabels,
      })
      const primeMode = asText(row.prime_mode).toUpperCase() === 'FULL'
        ? 'FULL'
        : asText(row.prime_mode).toUpperCase() === 'SPOT'
          ? 'SPOT'
          : null
      addToBucket(sectionBuckets[scope], {
        room: roomName,
        subjectLabel: row.label,
        paintProduct,
        note: notes.join(', '),
        coat: coats,
        primeMode,
      })
    }
  }

  collectTrimRows(trimRows, 'trim')
  collectTrimRows(doorRows, 'doors')
  collectTrimRows(cabinetRows, 'cabinets')

  for (const row of params.otherRows) {
    const price = pickPrice(row)
    sectionBuckets.other.price += price
    const desc = labelOrFallback(asText((row as Unsafe).client_description), '') || labelOrFallback(asText((row as Unsafe).location), '')
    const location = asText((row as Unsafe).location)
    const qty = asNum((row as Unsafe).qty) ?? 1
    const uom = asText((row as Unsafe).uom)
    const text = cleanCustomerFacingText(
      textJoin([
        desc || 'Additional work',
        location ? `in ${labelOrFallback(location, humanizeRoomCode(location))}` : '',
        qty ? `${qty}${uom ? ` ${uom}` : ''}` : '',
      ])
    )
    sectionBuckets.other.texts.push(text)
  }

  const finalizeBucket = (scope: CustomerEstimateSectionKey, scopeWord: string) => {
    const bucket = sectionBuckets[scope]
    if (bucket.price <= 0) {
      bucket.texts = []
      return
    }
    const sentence = buildSentence({ bucket, scopeWord })
    if (sentence) {
      bucket.texts = [sentence]
      return
    }
    bucket.texts = uniqueText(bucket.texts).map((text) => cleanCustomerFacingText(text)).filter(Boolean)
  }

  finalizeBucket('walls', 'on walls')
  finalizeBucket('ceilings', 'on ceilings')
  finalizeBucket('trim', 'on trim')
  finalizeBucket('doors', 'on doors')
  finalizeBucket('cabinets', 'on cabinets')
  if (sectionBuckets.other.price > 0) {
    sectionBuckets.other.texts = uniqueText(sectionBuckets.other.texts)
      .map((text) => cleanCustomerFacingText(text))
      .filter(Boolean)
  } else {
    sectionBuckets.other.texts = []
  }

  return sectionBuckets
}

function getOutputValue(outputs: Record<string, unknown> | null | undefined, key: string) {
  const value = outputs?.[key]
  const num = asNum(value)
  return num
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

export function buildCustomerEstimateDocument(params: {
  estimate: Unsafe
  job: Unsafe
  customer?: Unsafe | null
  company: CompanyProfile
  inputs: {
    rooms?: Unsafe[]
    room_wall_scopes?: Unsafe[]
    room_ceiling_scopes?: Unsafe[]
    room_trim_scopes?: Unsafe[]
    trim_items?: Unsafe[]
    other?: Unsafe[]
    jobsettings?: Unsafe | null
  }
  catalogs?: Unsafe | null
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
}): CustomerEstimateDocument {
  const estimate = params.estimate
  const job = params.job
  const outputs = ((estimate.latest_output_json as Unsafe | null | undefined)?.output_app ?? {}) as Record<string, unknown>
  const total = params.pricingSummary?.finalTotal ?? getOutputValue(outputs, 'FinalTotal')
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

  const versionName = asText(estimate.version_name) || 'Estimate'
  const flowVersion = asText(estimate.sheet_schema_version).toLowerCase().startsWith('v2') ? 'v2' : 'legacy'
  const status = asText(params.publicMeta?.status) || asText(estimate.version_state) || 'draft'
  const title = params.overrides?.title?.trim() || versionName
  const estimateDate = asText(job.estimate_date || estimate.created_at || estimate.updated_at)
  const intro =
    params.overrides?.intro_paragraph?.trim() ||
    `Thank you for the opportunity to prepare this estimate for ${asText(job.customer_name) || 'your project'}.`
  const closing =
    params.overrides?.closing_paragraph?.trim() ||
    'Please review the estimate below. If everything looks right, you can accept it directly from the secure link.'
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
