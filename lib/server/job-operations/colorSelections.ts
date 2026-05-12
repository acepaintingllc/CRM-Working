import { createHash, randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/server/org'
import { isUuid } from '@/lib/server/routeUtils'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  loadAcceptedEstimateOperationalSource as loadCanonicalAcceptedEstimateOperationalSource,
} from './acceptedEstimateSource'
import type {
  JobColorCatalogOption,
  JobColorSelectionCompleteness,
  JobColorSelectionDraftItem,
  JobColorSelectionsDraftInput,
  JobColorSelectionRecord,
  JobColorSelectionsReadModel,
  JobColorSelectionScopeKind,
  JobColorSelectionSetRecord,
  JobColorSelectionStatus,
  JobColorSelectionSurface,
  JobPaintSheenOption,
} from '@/types/job-operations/colorSelections'
import type { AcceptedEstimateOperationalSource } from '@/types/job-operations/acceptedEstimateSource'

type DbError = { code?: string | null; message?: string | null }
type QueryResponse<T> = { data: T | null; error: DbError | null }
type QueryListResponse<T> = { data: T[] | null; error: DbError | null }
type QueryBuilder = {
  select(columns: string): QueryBuilder
  eq(column: string, value: unknown): QueryBuilder
  is(column: string, value: unknown): QueryBuilder
  order(column: string, options?: { ascending?: boolean }): QueryBuilder
  limit(count: number): QueryBuilder
  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>): QueryBuilder
  update(payload: Record<string, unknown>): QueryBuilder
  delete(): QueryBuilder
  maybeSingle<T = unknown>(): Promise<QueryResponse<T>>
  single<T = unknown>(): Promise<QueryResponse<T>>
  then<TResult1 = QueryListResponse<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryListResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>
}
type DbClient = { from(table: string): QueryBuilder }

type LoadAcceptedEstimateOperationalSource = typeof loadCanonicalAcceptedEstimateOperationalSource

type ColorSelectionsDeps = {
  db?: DbClient
  now?: () => Date
  loadAcceptedEstimateOperationalSource?: LoadAcceptedEstimateOperationalSource
}

type Actor =
  | { type: 'staff'; userId: string }
  | { type: 'customer'; tokenHash: string }

type ColorCatalogRow = {
  id: string
  brand_id: string | null
  color_number: string | null
  color_name: string | null
  family: string | null
  hex: string | null
  lrv: number | null
  collection: string | null
  active: boolean | null
  paint_brands?: { brand_name?: string | null } | null
}

type SheenRow = {
  id: string
  sheen_name: string | null
  display_name: string | null
  active: boolean | null
}

const writableStatuses: JobColorSelectionStatus[] = ['draft', 'needs_revision']

const selectionSetSelect = [
  'id',
  'org_id',
  'job_id',
  'estimate_id',
  'estimate_snapshot_id',
  'customer_id',
  'status',
  'revision_number',
  'title',
  'accepted_estimate_display_name',
  'accepted_total',
  'public_token_expires_at',
  'public_token_revoked_at',
  'submitted_at',
  'confirmed_at',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
].join(', ')

const selectionSelect = [
  'id',
  'org_id',
  'job_id',
  'estimate_id',
  'estimate_snapshot_id',
  'selection_set_id',
  'room_id',
  'room_display_name',
  'scope_kind',
  'scope_id',
  'scope_display_name',
  'surface_label',
  'paint_brand_id',
  'paint_brand_display_name',
  'color_catalog_id',
  'color_number',
  'color_name',
  'color_display_name',
  'sheen_id',
  'sheen_display_name',
  'paint_product_id',
  'paint_product_display_name',
  'quantity_label',
  'notes',
  'customer_notes',
  'status',
  'position',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
].join(', ')

function getDb(deps?: ColorSelectionsDeps): DbClient {
  return deps?.db ?? (supabaseAdmin as unknown as DbClient)
}

function getLoader(deps?: ColorSelectionsDeps): LoadAcceptedEstimateOperationalSource {
  return deps?.loadAcceptedEstimateOperationalSource ?? loadCanonicalAcceptedEstimateOperationalSource
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function numberText(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return text(value)
}

function asMoney(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeUuid(value: unknown, label: string): ServiceResult<string | null> {
  if (value == null || value === '') return okResult(null)
  if (!isUuid(value)) return errorResult('invalid_input', `Invalid ${label}.`)
  return okResult(value)
}

function normalizeRequiredUuid(value: unknown, label: string): ServiceResult<string> {
  if (!isUuid(value)) return errorResult('invalid_input', `Invalid ${label}.`)
  return okResult(value)
}

function normalizeOptionalText(value: unknown, label: string, maxLength = 500): ServiceResult<string | null> {
  if (value == null) return okResult(null)
  if (typeof value !== 'string') return errorResult('invalid_input', `${label} must be text.`)
  const trimmed = value.trim()
  if (!trimmed) return okResult(null)
  if (trimmed.length > maxLength) {
    return errorResult('invalid_input', `${label} must be ${maxLength} characters or fewer.`)
  }
  return okResult(trimmed)
}

function normalizeScopeKind(value: unknown): ServiceResult<JobColorSelectionScopeKind> {
  const allowed = ['walls', 'ceilings', 'trim', 'doors', 'drywall', 'cabinets', 'other']
  if (typeof value === 'string' && allowed.includes(value)) {
    return okResult(value as JobColorSelectionScopeKind)
  }
  return errorResult('invalid_input', 'scope_kind is required and must be a supported surface kind.')
}

function readBodyField(body: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return body[snakeKey] ?? body[camelKey]
}

export function normalizeJobColorSelectionsDraftInput(
  body: unknown
): ServiceResult<JobColorSelectionsDraftInput> {
  if (!isRecord(body)) return errorResult('invalid_input', 'Color selection payload must be an object.')
  const rawSelections = readBodyField(body, 'selections', 'selections')
  if (!Array.isArray(rawSelections)) {
    return errorResult('invalid_input', 'selections must be an array.')
  }

  const selections: JobColorSelectionDraftItem[] = []
  for (const raw of rawSelections) {
    if (!isRecord(raw)) return errorResult('invalid_input', 'Each selection must be an object.')

    const scopeKind = normalizeScopeKind(readBodyField(raw, 'scope_kind', 'scopeKind'))
    if (!scopeKind.ok) return scopeKind

    const colorCatalogId = normalizeUuid(
      readBodyField(raw, 'color_catalog_id', 'colorCatalogId'),
      'color catalog id'
    )
    if (!colorCatalogId.ok) return colorCatalogId

    const paintBrandId = normalizeUuid(
      readBodyField(raw, 'paint_brand_id', 'paintBrandId'),
      'paint brand id'
    )
    if (!paintBrandId.ok) return paintBrandId

    const sheenId = normalizeUuid(readBodyField(raw, 'sheen_id', 'sheenId'), 'sheen id')
    if (!sheenId.ok) return sheenId

    const notes = normalizeOptionalText(raw.notes, 'notes', 4_000)
    if (!notes.ok) return notes

    const customerNotes = normalizeOptionalText(
      readBodyField(raw, 'customer_notes', 'customerNotes'),
      'customer_notes',
      4_000
    )
    if (!customerNotes.ok) return customerNotes

    selections.push({
      room_id: text(readBodyField(raw, 'room_id', 'roomId')),
      room_display_name: text(readBodyField(raw, 'room_display_name', 'roomDisplayName')),
      scope_kind: scopeKind.data,
      scope_id: text(readBodyField(raw, 'scope_id', 'scopeId')),
      scope_display_name: text(readBodyField(raw, 'scope_display_name', 'scopeDisplayName')),
      surface_label: text(readBodyField(raw, 'surface_label', 'surfaceLabel')),
      paint_brand_id: paintBrandId.data,
      paint_brand_display_name: text(readBodyField(raw, 'paint_brand_display_name', 'paintBrandDisplayName')),
      color_catalog_id: colorCatalogId.data,
      color_number: text(readBodyField(raw, 'color_number', 'colorNumber')),
      color_name: text(readBodyField(raw, 'color_name', 'colorName')),
      color_display_name: text(readBodyField(raw, 'color_display_name', 'colorDisplayName')),
      sheen_id: sheenId.data,
      sheen_display_name: text(readBodyField(raw, 'sheen_display_name', 'sheenDisplayName')),
      paint_product_id: text(readBodyField(raw, 'paint_product_id', 'paintProductId')),
      paint_product_display_name: text(readBodyField(raw, 'paint_product_display_name', 'paintProductDisplayName')),
      quantity_label: text(readBodyField(raw, 'quantity_label', 'quantityLabel')),
      notes: notes.data,
      customer_notes: customerNotes.data,
      position:
        typeof raw.position === 'number' && Number.isFinite(raw.position)
          ? Math.max(0, Math.round(raw.position))
          : null,
    })
  }

  return okResult({ selections })
}

export function normalizeColorSelectionConfirmInput(
  body: unknown
): ServiceResult<{ status: 'confirmed' | 'needs_revision'; notes: string | null }> {
  const record = isRecord(body) ? body : {}
  const status = record.status ?? record.decision ?? 'confirmed'
  if (status !== 'confirmed' && status !== 'needs_revision') {
    return errorResult('invalid_input', 'status must be confirmed or needs_revision.')
  }
  const notes = normalizeOptionalText(record.notes, 'notes', 4_000)
  if (!notes.ok) return notes
  return okResult({ status, notes: notes.data })
}

function scopeKindLabel(kind: JobColorSelectionScopeKind) {
  switch (kind) {
    case 'ceilings':
      return 'Ceiling'
    case 'trim':
      return 'Trim'
    case 'doors':
      return 'Doors'
    case 'drywall':
      return 'Drywall'
    case 'cabinets':
      return 'Cabinets'
    case 'other':
      return 'Other'
    case 'walls':
    default:
      return 'Walls'
  }
}

function readRoomName(row: Record<string, unknown>, roomMap: Map<string, string | null>) {
  const roomId = text(row.room_id ?? row.roomId)
  return (
    text(row.room_name ?? row.roomName ?? row.room_display_name ?? row.roomDisplayName) ??
    (roomId ? roomMap.get(roomId) ?? null : null)
  )
}

function readSurfaceProduct(row: Record<string, unknown>) {
  return {
    id: text(row.paint_product_id ?? row.paintProductId ?? row.product_id ?? row.productId),
    label: text(
      row.paint_product_label ??
        row.paintProductLabel ??
        row.paint_product_display_name ??
        row.product_label ??
        row.productLabel
    ),
  }
}

function readScopeDisplayName(row: Record<string, unknown>, kind: JobColorSelectionScopeKind) {
  return text(
    row.scope_display_name ??
      row.scopeDisplayName ??
      row.surface_label ??
      row.surfaceLabel ??
      row.name ??
      row.label ??
      row.scope_name ??
      row.scopeName
  ) ?? scopeKindLabel(kind)
}

function readQuantityLabel(row: Record<string, unknown>) {
  const raw =
    numberText(row.quantity_label ?? row.quantityLabel) ??
    numberText(row.effective_quantity ?? row.effectiveQuantity) ??
    numberText(row.quantity)
  return raw
}

function readRooms(source: AcceptedEstimateOperationalSource) {
  const roomMap = new Map<string, string | null>()
  for (const rawRoom of source.rooms ?? []) {
    if (!isRecord(rawRoom)) continue
    const id = text(rawRoom.id ?? rawRoom.room_id ?? rawRoom.roomId)
    if (!id) continue
    roomMap.set(id, text(rawRoom.name ?? rawRoom.room_name ?? rawRoom.label))
  }
  return roomMap
}

export function buildColorSelectionSurfaces(
  source: AcceptedEstimateOperationalSource
): JobColorSelectionSurface[] {
  const roomMap = readRooms(source)
  const surfaces: JobColorSelectionSurface[] = []
  let position = 0
  for (const kind of ['walls', 'ceilings', 'trim', 'doors'] as const) {
    for (const rawRow of source.scopes[kind] ?? []) {
      if (!isRecord(rawRow)) continue
      const scopeId = text(rawRow.id ?? rawRow.scope_id ?? rawRow.scopeId)
      const roomId = text(rawRow.room_id ?? rawRow.roomId)
      const roomName = readRoomName(rawRow, roomMap)
      const scopeDisplayName = readScopeDisplayName(rawRow, kind)
      const surfaceLabel = roomName ? `${roomName} ${scopeKindLabel(kind)}` : scopeDisplayName
      const product = readSurfaceProduct(rawRow)

      surfaces.push({
        key: surfaceKey(kind, scopeId, surfaceLabel),
        room_id: roomId,
        room_display_name: roomName,
        scope_kind: kind,
        scope_id: scopeId,
        scope_display_name: scopeDisplayName,
        surface_label: surfaceLabel,
        paint_product_id: product.id,
        paint_product_display_name: product.label,
        quantity_label: readQuantityLabel(rawRow),
        required: true,
        position,
      })
      position += 1
    }
  }
  return surfaces
}

function surfaceKey(kind: JobColorSelectionScopeKind, scopeId: string | null, surfaceLabel: string | null) {
  return `${kind}:${scopeId ?? surfaceLabel ?? 'unscoped'}`
}

function selectionSurfaceKey(selection: Pick<JobColorSelectionRecord, 'scope_kind' | 'scope_id' | 'surface_label'>) {
  return surfaceKey(selection.scope_kind, selection.scope_id, selection.surface_label)
}

export function computeColorSelectionCompleteness(params: {
  surfaces: JobColorSelectionSurface[]
  selections: Array<Pick<JobColorSelectionRecord, 'scope_kind' | 'scope_id' | 'surface_label' | 'color_catalog_id' | 'color_name' | 'color_display_name' | 'sheen_id' | 'sheen_display_name'>>
}): JobColorSelectionCompleteness {
  const selectionsBySurface = new Map(params.selections.map((selection) => [selectionSurfaceKey(selection), selection]))
  const required = params.surfaces.filter((surface) => surface.required)
  const missingSurfaceKeys: string[] = []
  for (const surface of required) {
    const selection = selectionsBySurface.get(surface.key)
    const hasColor = Boolean(selection?.color_catalog_id || selection?.color_name || selection?.color_display_name)
    const hasSheen = Boolean(selection?.sheen_id || selection?.sheen_display_name)
    if (!hasColor || !hasSheen) missingSurfaceKeys.push(surface.key)
  }
  return {
    required_count: required.length,
    completed_count: required.length - missingSurfaceKeys.length,
    missing_surface_keys: missingSurfaceKeys,
    complete: missingSurfaceKeys.length === 0,
  }
}

async function loadAcceptedSource(
  orgId: string,
  jobId: string,
  deps?: ColorSelectionsDeps
): Promise<ServiceResult<AcceptedEstimateOperationalSource>> {
  return getLoader(deps)({ orgId, jobId }, deps as Parameters<LoadAcceptedEstimateOperationalSource>[1])
}

async function loadLatestSelectionSet(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId: string
) {
  return db
    .from('job_color_selection_sets')
    .select(selectionSetSelect)
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('estimate_snapshot_id', estimateSnapshotId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle<JobColorSelectionSetRecord>()
}

async function loadSelections(db: DbClient, selectionSetId: string) {
  return db
    .from('job_color_selections')
    .select(selectionSelect)
    .eq('selection_set_id', selectionSetId)
    .order('position', { ascending: true }) as unknown as Promise<QueryListResponse<JobColorSelectionRecord>>
}

async function loadCatalog(
  db: DbClient,
  orgId: string
): Promise<ServiceResult<{ colors: JobColorCatalogOption[]; sheens: JobPaintSheenOption[] }>> {
  const colors = (await db
    .from('paint_color_catalog')
    .select('id, brand_id, color_number, color_name, family, hex, lrv, collection, active, paint_brands(brand_name)')
    .eq('org_id', orgId)
    .order('color_name', { ascending: true })
    .limit(500)) as QueryListResponse<ColorCatalogRow>
  if (colors.error) {
    return errorResult('server_error', colors.error.message ?? 'Unable to load paint colors.')
  }

  const sheens = (await db
    .from('paint_sheens')
    .select('id, sheen_name, display_name, active')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })) as QueryListResponse<SheenRow>
  if (sheens.error) {
    return errorResult('server_error', sheens.error.message ?? 'Unable to load paint sheens.')
  }

  return okResult({
    colors: (colors.data ?? []).map((row) => ({
      id: row.id,
      brand_id: row.brand_id,
      brand_name: row.paint_brands?.brand_name ?? null,
      color_number: row.color_number,
      color_name: row.color_name ?? '',
      family: row.family,
      hex: row.hex,
      lrv: row.lrv,
      collection: row.collection,
      active: row.active !== false,
    })),
    sheens: (sheens.data ?? []).map((row) => ({
      id: row.id,
      sheen_name: row.sheen_name ?? '',
      display_name: row.display_name ?? row.sheen_name ?? '',
      active: row.active !== false,
    })),
  })
}

async function buildReadModel(params: {
  db: DbClient
  orgId: string
  jobId: string
  source: AcceptedEstimateOperationalSource
  selectionSet: JobColorSelectionSetRecord | null
  publicToken?: string | null
}): Promise<ServiceResult<JobColorSelectionsReadModel>> {
  const surfaces = buildColorSelectionSurfaces(params.source)
  const selectionsResult = params.selectionSet
    ? await loadSelections(params.db, params.selectionSet.id)
    : { data: [], error: null }
  if (selectionsResult.error) {
    return errorResult('server_error', selectionsResult.error.message ?? 'Unable to load color selections.')
  }

  const catalog = await loadCatalog(params.db, params.orgId)
  if (!catalog.ok) return catalog

  const selections = selectionsResult.data ?? []
  return okResult({
    source: {
      job: params.source.job,
      customer: params.source.customer,
      acceptance: params.source.acceptance,
      estimate: params.source.estimate,
      totals: params.source.totals,
    },
    selection_set: params.selectionSet,
    public_access: {
      token: params.publicToken ?? null,
      url_path: params.publicToken ? `/color-selection/${params.publicToken}` : null,
      expires_at: params.selectionSet?.public_token_expires_at ?? null,
    },
    surfaces,
    selections,
    catalog: catalog.data,
    completeness: computeColorSelectionCompleteness({ surfaces, selections }),
  })
}

export async function loadJobColorSelections(
  orgId: string,
  jobId: string,
  deps?: ColorSelectionsDeps
): Promise<ServiceResult<JobColorSelectionsReadModel>> {
  const accepted = await loadAcceptedSource(orgId, jobId, deps)
  if (!accepted.ok) return accepted
  const snapshotId = accepted.data.estimate.estimate_snapshot_id
  if (!snapshotId) return errorResult('not_found', 'Accepted estimate snapshot is missing.')

  const db = getDb(deps)
  const selectionSet = await loadLatestSelectionSet(db, orgId, jobId, snapshotId)
  if (selectionSet.error) {
    return errorResult('server_error', selectionSet.error.message ?? 'Unable to load color selection set.')
  }

  return buildReadModel({
    db,
    orgId,
    jobId,
    source: accepted.data,
    selectionSet: selectionSet.data ?? null,
  })
}

function actorAudit(actor: Actor) {
  return actor.type === 'staff'
    ? { updated_by: actor.userId }
    : {}
}

async function createSelectionSet(params: {
  db: DbClient
  source: AcceptedEstimateOperationalSource
  actor: Actor
}) {
  const token = createPublicToken()
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString()
  const createdBy = params.actor.type === 'staff' ? params.actor.userId : null
  const result = await params.db
    .from('job_color_selection_sets')
    .insert({
      org_id: params.source.source.org_id,
      job_id: params.source.source.job_id,
      estimate_id: params.source.source.estimate_id,
      estimate_snapshot_id: params.source.source.estimate_snapshot_id,
      customer_id: params.source.customer.id,
      status: 'draft',
      title: 'Color selections',
      accepted_estimate_display_name: params.source.estimate.version_name,
      accepted_total: asMoney(params.source.totals.accepted_total),
      public_token_hash: hashPublicToken(token),
      public_token_expires_at: expires,
      created_by: createdBy,
      updated_by: createdBy,
    })
    .select(selectionSetSelect)
    .single<JobColorSelectionSetRecord>()
  return { ...result, publicToken: token }
}

async function ensureWritableSelectionSet(params: {
  db: DbClient
  orgId: string
  jobId: string
  source: AcceptedEstimateOperationalSource
  actor: Actor
}): Promise<ServiceResult<{ selectionSet: JobColorSelectionSetRecord; publicToken: string | null }>> {
  const snapshotId = params.source.estimate.estimate_snapshot_id
  if (!snapshotId) return errorResult('not_found', 'Accepted estimate snapshot is missing.')

  const latest = await loadLatestSelectionSet(params.db, params.orgId, params.jobId, snapshotId)
  if (latest.error) {
    return errorResult('server_error', latest.error.message ?? 'Unable to load color selection set.')
  }
  if (!latest.data) {
    const created = await createSelectionSet({
      db: params.db,
      source: params.source,
      actor: params.actor,
    })
    if (created.error || !created.data) {
      return errorResult('server_error', created.error?.message ?? 'Unable to create color selection set.')
    }
    return okResult({ selectionSet: created.data, publicToken: created.publicToken })
  }
  if (!writableStatuses.includes(latest.data.status)) {
    return errorResult('conflict', 'Confirmed or submitted color selections cannot be edited as a draft.')
  }
  return okResult({ selectionSet: latest.data, publicToken: null })
}

async function loadColorCatalogRow(db: DbClient, orgId: string, colorCatalogId: string | null) {
  if (!colorCatalogId) return okResult(null)
  const row = await db
    .from('paint_color_catalog')
    .select('id, brand_id, color_number, color_name, family, hex, lrv, collection, active, paint_brands(brand_name)')
    .eq('org_id', orgId)
    .eq('id', colorCatalogId)
    .maybeSingle<ColorCatalogRow>()
  if (row.error) return errorResult('server_error', row.error.message ?? 'Unable to load paint color.')
  if (!row.data) return errorResult('not_found', 'Paint color not found.')
  return okResult(row.data)
}

async function loadSheenRow(db: DbClient, orgId: string, sheenId: string | null) {
  if (!sheenId) return okResult(null)
  const row = await db
    .from('paint_sheens')
    .select('id, sheen_name, display_name, active')
    .eq('org_id', orgId)
    .eq('id', sheenId)
    .maybeSingle<SheenRow>()
  if (row.error) return errorResult('server_error', row.error.message ?? 'Unable to load paint sheen.')
  if (!row.data) return errorResult('not_found', 'Paint sheen not found.')
  return okResult(row.data)
}

function findSurface(
  surfaces: JobColorSelectionSurface[],
  input: Pick<JobColorSelectionDraftItem, 'scope_kind' | 'scope_id' | 'surface_label'>
) {
  const key = surfaceKey(input.scope_kind, input.scope_id ?? null, input.surface_label ?? null)
  return surfaces.find((surface) => surface.key === key) ?? null
}

async function buildSelectionPayload(params: {
  db: DbClient
  orgId: string
  selectionSet: JobColorSelectionSetRecord
  input: JobColorSelectionDraftItem
  surface: JobColorSelectionSurface | null
  actor: Actor
}) {
  const color = await loadColorCatalogRow(params.db, params.orgId, params.input.color_catalog_id ?? null)
  if (!color.ok) return color
  const sheen = await loadSheenRow(params.db, params.orgId, params.input.sheen_id ?? null)
  if (!sheen.ok) return sheen

  const colorName = color.data?.color_name ?? params.input.color_name ?? null
  const colorNumber = color.data?.color_number ?? params.input.color_number ?? null
  const colorDisplay = colorNumber && colorName ? `${colorNumber} ${colorName}` : colorName ?? colorNumber
  const sheenDisplay = sheen.data?.display_name ?? sheen.data?.sheen_name ?? params.input.sheen_display_name ?? null

  return okResult({
    org_id: params.selectionSet.org_id,
    job_id: params.selectionSet.job_id,
    estimate_id: params.selectionSet.estimate_id,
    estimate_snapshot_id: params.selectionSet.estimate_snapshot_id,
    selection_set_id: params.selectionSet.id,
    room_id: params.surface?.room_id ?? params.input.room_id ?? null,
    room_display_name: params.surface?.room_display_name ?? params.input.room_display_name ?? null,
    scope_kind: params.input.scope_kind,
    scope_id: params.surface?.scope_id ?? params.input.scope_id ?? null,
    scope_display_name: params.surface?.scope_display_name ?? params.input.scope_display_name ?? null,
    surface_label: params.surface?.surface_label ?? params.input.surface_label ?? null,
    paint_brand_id: color.data?.brand_id ?? params.input.paint_brand_id ?? null,
    paint_brand_display_name: color.data?.paint_brands?.brand_name ?? params.input.paint_brand_display_name ?? null,
    color_catalog_id: color.data?.id ?? null,
    color_number: colorNumber,
    color_name: colorName,
    color_display_name: params.input.color_display_name ?? colorDisplay,
    sheen_id: sheen.data?.id ?? null,
    sheen_display_name: sheenDisplay,
    paint_product_id: params.surface?.paint_product_id ?? params.input.paint_product_id ?? null,
    paint_product_display_name: params.surface?.paint_product_display_name ?? params.input.paint_product_display_name ?? null,
    quantity_label: params.surface?.quantity_label ?? params.input.quantity_label ?? null,
    notes: params.input.notes ?? null,
    customer_notes: params.input.customer_notes ?? null,
    status: 'draft',
    position: params.surface?.position ?? params.input.position ?? 0,
    ...actorAudit(params.actor),
  })
}

async function loadExistingSelectionForSurface(params: {
  db: DbClient
  selectionSetId: string
  scopeKind: JobColorSelectionScopeKind
  scopeId: string | null
  surfaceLabel: string | null
}) {
  let query = params.db
    .from('job_color_selections')
    .select(selectionSelect)
    .eq('selection_set_id', params.selectionSetId)
    .eq('scope_kind', params.scopeKind)
  query = params.scopeId ? query.eq('scope_id', params.scopeId) : query.is('scope_id', null)
  if (!params.scopeId) {
    query = params.surfaceLabel ? query.eq('surface_label', params.surfaceLabel) : query.is('surface_label', null)
  }
  return query.maybeSingle<JobColorSelectionRecord>()
}

async function saveSelectionItem(params: {
  db: DbClient
  orgId: string
  selectionSet: JobColorSelectionSetRecord
  surfaces: JobColorSelectionSurface[]
  input: JobColorSelectionDraftItem
  actor: Actor
}): Promise<ServiceResult<JobColorSelectionRecord>> {
  const surface = findSurface(params.surfaces, params.input)
  const payload = await buildSelectionPayload({
    db: params.db,
    orgId: params.orgId,
    selectionSet: params.selectionSet,
    input: params.input,
    surface,
    actor: params.actor,
  })
  if (!payload.ok) return payload

  const existing = await loadExistingSelectionForSurface({
    db: params.db,
    selectionSetId: params.selectionSet.id,
    scopeKind: payload.data.scope_kind,
    scopeId: payload.data.scope_id,
    surfaceLabel: payload.data.surface_label,
  })
  if (existing.error) {
    return errorResult('server_error', existing.error.message ?? 'Unable to inspect color selection.')
  }

  if (existing.data) {
    const updated = await params.db
      .from('job_color_selections')
      .update(payload.data)
      .eq('id', existing.data.id)
      .select(selectionSelect)
      .single<JobColorSelectionRecord>()
    if (updated.error || !updated.data) {
      return errorResult('server_error', updated.error?.message ?? 'Unable to update color selection.')
    }
    return okResult(updated.data)
  }

  const created = await params.db
    .from('job_color_selections')
    .insert(payload.data)
    .select(selectionSelect)
    .single<JobColorSelectionRecord>()
  if (created.error || !created.data) {
    return errorResult('server_error', created.error?.message ?? 'Unable to create color selection.')
  }
  return okResult(created.data)
}

async function saveSelections(params: {
  orgId: string
  jobId: string
  input: JobColorSelectionsDraftInput
  actor: Actor
}, deps?: ColorSelectionsDeps): Promise<ServiceResult<JobColorSelectionsReadModel>> {
  const accepted = await loadAcceptedSource(params.orgId, params.jobId, deps)
  if (!accepted.ok) return accepted
  const db = getDb(deps)
  const selectionSet = await ensureWritableSelectionSet({
    db,
    orgId: params.orgId,
    jobId: params.jobId,
    source: accepted.data,
    actor: params.actor,
  })
  if (!selectionSet.ok) return selectionSet

  const surfaces = buildColorSelectionSurfaces(accepted.data)
  for (const selection of params.input.selections) {
    const saved = await saveSelectionItem({
      db,
      orgId: params.orgId,
      selectionSet: selectionSet.data.selectionSet,
      surfaces,
      input: selection,
      actor: params.actor,
    })
    if (!saved.ok) return saved
  }

  const refreshed = await loadLatestSelectionSet(
    db,
    params.orgId,
    params.jobId,
    selectionSet.data.selectionSet.estimate_snapshot_id
  )
  if (refreshed.error) {
    return errorResult('server_error', refreshed.error.message ?? 'Unable to reload color selection set.')
  }
  return buildReadModel({
    db,
    orgId: params.orgId,
    jobId: params.jobId,
    source: accepted.data,
    selectionSet: refreshed.data ?? selectionSet.data.selectionSet,
    publicToken: selectionSet.data.publicToken,
  })
}

export function saveJobColorSelections(params: {
  orgId: string
  jobId: string
  userId: string
  input: JobColorSelectionsDraftInput
}, deps?: ColorSelectionsDeps) {
  return saveSelections({
    orgId: params.orgId,
    jobId: params.jobId,
    input: params.input,
    actor: { type: 'staff', userId: params.userId },
  }, deps)
}

async function setSelectionSetStatus(params: {
  db: DbClient
  selectionSet: JobColorSelectionSetRecord
  status: JobColorSelectionStatus
  actor: Actor
  now: string
}) {
  const timestampPatch =
    params.status === 'submitted'
      ? { submitted_at: params.now, confirmed_at: null }
      : params.status === 'confirmed'
        ? { confirmed_at: params.now }
        : { confirmed_at: null }
  const result = await params.db
    .from('job_color_selection_sets')
    .update({
      status: params.status,
      ...timestampPatch,
      ...actorAudit(params.actor),
    })
    .eq('id', params.selectionSet.id)
    .select(selectionSetSelect)
    .single<JobColorSelectionSetRecord>()
  if (result.error || !result.data) {
    return errorResult('server_error', result.error?.message ?? 'Unable to update color selection status.')
  }

  const rows = (await params.db
    .from('job_color_selections')
    .update({
      status: params.status,
      ...actorAudit(params.actor),
    })
    .eq('selection_set_id', params.selectionSet.id)) as QueryListResponse<unknown>
  if (rows.error) {
    return errorResult('server_error', rows.error.message ?? 'Unable to update color selections.')
  }

  return okResult(result.data)
}

async function submitSelections(params: {
  orgId: string
  jobId: string
  actor: Actor
}, deps?: ColorSelectionsDeps) {
  const model = await loadJobColorSelections(params.orgId, params.jobId, deps)
  if (!model.ok) return model
  if (!model.data.selection_set) return errorResult('not_found', 'Draft color selections not found.')
  if (!writableStatuses.includes(model.data.selection_set.status)) {
    return errorResult('conflict', 'Only draft color selections can be submitted.')
  }
  if (!model.data.completeness.complete) {
    return errorResult('invalid_input', 'Required color selections are incomplete.')
  }

  const db = getDb(deps)
  const updated = await setSelectionSetStatus({
    db,
    selectionSet: model.data.selection_set,
    status: 'submitted',
    actor: params.actor,
    now: (deps?.now?.() ?? new Date()).toISOString(),
  })
  if (!updated.ok) return updated

  const accepted = await loadAcceptedSource(params.orgId, params.jobId, deps)
  if (!accepted.ok) return accepted
  return buildReadModel({
    db,
    orgId: params.orgId,
    jobId: params.jobId,
    source: accepted.data,
    selectionSet: updated.data,
  })
}

export function submitJobColorSelections(params: {
  orgId: string
  jobId: string
  userId: string
}, deps?: ColorSelectionsDeps) {
  return submitSelections({
    orgId: params.orgId,
    jobId: params.jobId,
    actor: { type: 'staff', userId: params.userId },
  }, deps)
}

export async function confirmJobColorSelections(params: {
  orgId: string
  jobId: string
  userId: string
  status: 'confirmed' | 'needs_revision'
}, deps?: ColorSelectionsDeps): Promise<ServiceResult<JobColorSelectionsReadModel>> {
  const model = await loadJobColorSelections(params.orgId, params.jobId, deps)
  if (!model.ok) return model
  if (!model.data.selection_set) return errorResult('not_found', 'Color selections not found.')
  if (params.status === 'confirmed' && !model.data.completeness.complete) {
    return errorResult('invalid_input', 'Required color selections are incomplete.')
  }

  const db = getDb(deps)
  const updated = await setSelectionSetStatus({
    db,
    selectionSet: model.data.selection_set,
    status: params.status,
    actor: { type: 'staff', userId: params.userId },
    now: (deps?.now?.() ?? new Date()).toISOString(),
  })
  if (!updated.ok) return updated

  const accepted = await loadAcceptedSource(params.orgId, params.jobId, deps)
  if (!accepted.ok) return accepted
  return buildReadModel({
    db,
    orgId: params.orgId,
    jobId: params.jobId,
    source: accepted.data,
    selectionSet: updated.data,
  })
}

function createPublicToken() {
  return randomBytes(24).toString('base64url')
}

export function hashPublicToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function loadSelectionSetByToken(
  db: DbClient,
  token: string
): Promise<ServiceResult<JobColorSelectionSetRecord>> {
  const tokenHash = hashPublicToken(token)
  const row = await db
    .from('job_color_selection_sets')
    .select(selectionSetSelect)
    .eq('public_token_hash', tokenHash)
    .is('public_token_revoked_at', null)
    .maybeSingle<JobColorSelectionSetRecord>()
  if (row.error) return errorResult('server_error', row.error.message ?? 'Unable to load color selection link.')
  if (!row.data) return errorResult('not_found', 'Color selection link not found.')
  const expiresAt = row.data.public_token_expires_at
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return errorResult('forbidden', 'Color selection link has expired.')
  }
  return okResult(row.data)
}

export async function loadPublicJobColorSelections(
  token: string,
  deps?: ColorSelectionsDeps
): Promise<ServiceResult<JobColorSelectionsReadModel>> {
  const db = getDb(deps)
  const selectionSet = await loadSelectionSetByToken(db, token)
  if (!selectionSet.ok) return selectionSet
  const accepted = await loadAcceptedSource(selectionSet.data.org_id, selectionSet.data.job_id, deps)
  if (!accepted.ok) return accepted
  return buildReadModel({
    db,
    orgId: selectionSet.data.org_id,
    jobId: selectionSet.data.job_id,
    source: accepted.data,
    selectionSet: selectionSet.data,
  })
}

export async function savePublicJobColorSelections(
  token: string,
  input: JobColorSelectionsDraftInput,
  deps?: ColorSelectionsDeps
): Promise<ServiceResult<JobColorSelectionsReadModel>> {
  const db = getDb(deps)
  const selectionSet = await loadSelectionSetByToken(db, token)
  if (!selectionSet.ok) return selectionSet
  if (!writableStatuses.includes(selectionSet.data.status)) {
    return errorResult('conflict', 'Submitted or confirmed color selections cannot be edited.')
  }
  return saveSelections({
    orgId: selectionSet.data.org_id,
    jobId: selectionSet.data.job_id,
    input,
    actor: { type: 'customer', tokenHash: hashPublicToken(token) },
  }, deps)
}

export async function submitPublicJobColorSelections(
  token: string,
  deps?: ColorSelectionsDeps
): Promise<ServiceResult<JobColorSelectionsReadModel>> {
  const db = getDb(deps)
  const selectionSet = await loadSelectionSetByToken(db, token)
  if (!selectionSet.ok) return selectionSet
  return submitSelections({
    orgId: selectionSet.data.org_id,
    jobId: selectionSet.data.job_id,
    actor: { type: 'customer', tokenHash: hashPublicToken(token) },
  }, deps)
}
