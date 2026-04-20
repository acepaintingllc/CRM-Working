'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import {
  createSaveRequestTracker,
  getSaveStatusText,
  shouldQueueAutosave,
  type SaveStatus,
} from '@/lib/estimator/v2WallsAutosave'
import { sanitizeV2WallsDrafts } from '@/lib/estimator/v2WallsSanitize'
import { validateV2WallsBeforeSave } from '@/lib/estimator/v2WallsValidation'
import { sanitizeV2CeilingsDrafts } from '@/lib/estimator/v2CeilingsSanitize'
import { validateV2CeilingsBeforeSave } from '@/lib/estimator/v2CeilingsValidation'
import { sanitizeV2TrimDrafts } from '@/lib/estimator/v2TrimSanitize'
import { validateV2TrimBeforeSave } from '@/lib/estimator/v2TrimValidation'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

type Unsafe = Record<string, unknown>

type EstimateMeta = {
  id: string
  job_id: string
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  updated_at: string | null
}

type JobMeta = {
  id: string
  title: string
  status: string | null
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  customer_email: string | null
  customer_phone: string | null
}

type PaintProductOption = {
  id: string
  label: string
  type: string
  scopes?: string[]
}

type CatalogOption = {
  id: string
  label: string
}

type WallComplexityOption = CatalogOption & {
  labor_multiplier: number | null
}

type RoomFlagOption = CatalogOption & {
  wall_factor: number | null
  ceil_factor: number | null
  trim_factor: number | null
}

type CeilingTypeOption = CatalogOption & {
  labor_mult: number | null
}

type TrimTypeOption = CatalogOption & {
  family: string | null
  unit_type: 'LF' | 'EA' | 'SF' | null
  helper_allowed: boolean
  default_production_rate_id: string | null
}

type CatalogsPayload = {
  catalogs: {
    paint_products: PaintProductOption[]
    color_codes: CatalogOption[]
    wall_complexity_types: WallComplexityOption[]
    room_types: CatalogOption[]
    room_flags: RoomFlagOption[]
    ceiling_types: CeilingTypeOption[]
    trim_items: TrimTypeOption[]
  }
}

type WallScopeTrace = {
  scope_id: string | null
  area: {
    effective_area_sf: number | null
  }
}

type WallRoomTotal = {
  room_id: string
  effective_area_sf: number
}

type WallCalculationsPayload = {
  scopes?: Unsafe[]
  segments?: Unsafe[]
  room_totals?: WallRoomTotal[]
  scope_traces?: WallScopeTrace[]
}

type EstimateResponse = {
  estimate: EstimateMeta
  inputs: {
    jobsettings?: Unsafe
    rooms?: Unsafe[]
    room_wall_scopes?: Unsafe[]
    wall_segments?: Unsafe[]
    room_flags?: Unsafe[]
    room_ceiling_scopes?: Unsafe[]
    ceiling_scope_segments?: Unsafe[]
    room_trim_scopes?: Unsafe[]
  }
  wall_calculations?: WallCalculationsPayload
  ceiling_calculations?: Unsafe
  trim_calculations?: Unsafe
}

type JobResponse = {
  job: JobMeta
}

type JobSettingsDraft = {
  laborDayEnabled: boolean
  dayhours: number
  roundingIncrementHours: number
  laborRate: number
  jobMinEnabled: boolean
  jobMinAmount: number
  wallPaintProductId: string
}

type CustomerDraft = {
  customerId: string
  name: string
  email: string
  phone: string
  address: string
}

type RoomDraft = {
  id: string
  roomId: string
  roomName: string
  roomTypeId: string
  lengthIn: string
  widthIn: string
  heightIn: string
  wallComplexityId: string
  notes: string
  position: number
}

type RoomFlagDraft = {
  id: string
  roomId: string
  flagId: string
  position: number
}

type WallScopeMode = 'RECT' | 'SEG'
type WallPrimeMode = 'NONE' | 'SPOT' | 'FULL'
type WallSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

type WallScopeDraft = {
  id: string
  roomId: string
  position: number
  mode: WallScopeMode
  include: 'Y' | 'N'
  scopeName: string
  colorId: string
  paintProductId: string
  primerProductId: string
  primeMode: WallPrimeMode
  heightIn: string
  perimeterIn: string
  standardDoorCount: string
  standardWindowCount: string
  heightFactor: string
  complexityFactor: string
  wallFlagFactor: string
  cutInTopFactor: string
  cutInBottomFactor: string
  paintCoats: string
  primerCoats: string
  spotPrimePercent: string
  overrideAreaSqFt: string
  overridePaintHours: string
  overridePrimerHours: string
  overridePaintGallons: string
  overridePrimerGallons: string
  overrideSupplyCost: string
  overrideTotal: string
  notes: string
}

type WallSegmentDraft = {
  id: string
  wallScopeId: string
  roomId: string
  position: number
  segmentName: string
  include: 'Y' | 'N'
  shapeType: WallSegmentShape
  quantity: string
  widthIn: string
  heightIn: string
  baseIn: string
  manualAreaSqFt: string
  standardDoorCount: string
  standardWindowCount: string
  overrideAreaSqFt: string
  notes: string
}

type CeilingScopeMode = 'RECT' | 'SEG'
type CeilingPrimeMode = 'NONE' | 'SPOT' | 'FULL'
type CeilingSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

type CeilingScopeDraft = {
  id: string
  roomId: string
  position: number
  mode: CeilingScopeMode
  include: 'Y' | 'N'
  scopeName: string
  colorId: string
  paintProductId: string
  primerProductId: string
  primeMode: CeilingPrimeMode
  spotPrimePercent: string
  ceilingTypeId: string
  lengthIn: string
  widthIn: string
  areaSf: string
  heightFactor: string
  complexityFactor: string
  ceilingFlagFactor: string
  paintCoats: string
  primerCoats: string
  overrideAreaSqFt: string
  overridePaintHours: string
  overridePrimerHours: string
  overridePaintGallons: string
  overridePrimerGallons: string
  overrideSupplyCost: string
  overrideTotal: string
  notes: string
}

type CeilingSegmentDraft = {
  id: string
  ceilingScopeId: string
  roomId: string
  position: number
  segmentName: string
  include: 'Y' | 'N'
  shapeType: CeilingSegmentShape
  quantity: string
  widthIn: string
  heightIn: string
  baseIn: string
  manualAreaSqFt: string
  overrideAreaSqFt: string
  notes: string
}

type TrimUnitType = 'LF' | 'EA' | 'SF'
type TrimMeasurementMode = 'MANUAL' | 'ROOM_HELPER'

type TrimScopeDraft = {
  id: string
  roomId: string
  position: number
  include: 'Y' | 'N'
  scopeName: string
  trimTypeId: string
  trimFamily: string
  unitType: TrimUnitType
  measurementMode: TrimMeasurementMode
  helperSource: 'ROOM_PERIMETER' | ''
  measurementValue: string
  helperValue: string
  colorId: string
  paintProductId: string
  primerProductId: string
  paintEnabled: 'Y' | 'N'
  primeMode: 'NONE' | 'SPOT' | 'FULL'
  spotPrimePercent: string
  productionRateId: string
  prepFactor: string
  heightFactor: string
  profileFactor: string
  roomFlagFactor: string
  maskingFactor: string
  stairFactor: string
  difficultFinishFactor: string
  caulkFillFactor: string
  paintCoats: string
  primerCoats: string
  overrideMeasurement: string
  overrideHours: string
  overrideGallons: string
  overrideSupplyCost: string
  overrideTotal: string
  overrideDescription: string
  notes: string
}

type ScopeDerived = {
  rawArea: number | null
  effectiveArea: number | null
}

type SegmentDerived = {
  rawArea: number | null
  deductionArea: number
  deductionAdjustedArea: number | null
  effectiveArea: number | null
}

const STANDARD_DOOR_DEDUCTION_SF = 21
const STANDARD_WINDOW_DEDUCTION_SF = 15
const AUTO_SAVE_DELAY_MS = 900

const S = {
  page: {
    display: 'block',
    minHeight: '100vh',
    background: 'var(--v2-bg)',
    color: 'var(--v2-ink)',
  } as CSSProperties,
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 18px',
    borderBottom: '1px solid var(--v2-line)',
    background: 'rgba(8,8,8,0.94)',
    backdropFilter: 'blur(10px)',
  } as CSSProperties,
  mono: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(9px + 4pt)',
    letterSpacing: '0.11em',
    textTransform: 'uppercase',
    color: 'var(--v2-ink-3)',
  } as CSSProperties,
  shell: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    gap: 16,
    padding: 16,
  } as CSSProperties,
  panel: {
    border: '1px solid var(--v2-line)',
    borderRadius: 14,
    background: 'var(--v2-bg-2)',
    padding: 10,
  } as CSSProperties,
  input: {
    width: '100%',
    padding: '7px 9px',
    minHeight: 34,
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(12px + 4pt)',
  } as CSSProperties,
  textarea: {
    width: '100%',
    minHeight: 70,
    padding: '7px 9px',
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(12px + 4pt)',
    resize: 'vertical',
  } as CSSProperties,
  label: {
    display: 'grid',
    gap: 3,
  } as CSSProperties,
  button: {
    padding: '7px 9px',
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(11px + 4pt)',
    fontWeight: 700,
    cursor: 'pointer',
  } as CSSProperties,
  buttonPrimary: {
    padding: '8px 11px',
    borderRadius: 9,
    border: '1px solid rgba(134,239,172,0.36)',
    background: '#8ad39b',
    color: '#062410',
    fontSize: 'calc(12px + 4pt)',
    fontWeight: 800,
    cursor: 'pointer',
  } as CSSProperties,
  roomButton: {
    width: '100%',
    textAlign: 'left',
    borderRadius: 14,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    padding: 12,
    color: 'var(--v2-ink)',
    cursor: 'pointer',
  } as CSSProperties,
  sectionTitle: {
    fontSize: 'calc(20px + 4pt)',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
  } as CSSProperties,
  previewValue: {
    fontSize: 'calc(18px + 4pt)',
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: 'var(--v2-ink)',
  } as CSSProperties,
  computedBig: {
    fontSize: 'calc(24px + 4pt)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: 'var(--v2-ink)',
    lineHeight: 1,
    marginTop: 4,
  } as CSSProperties,
  dimOperator: {
    fontSize: 'calc(16px + 4pt)',
    fontWeight: 300,
    color: 'var(--v2-ink-3)',
    alignSelf: 'end',
    paddingBottom: 10,
    userSelect: 'none',
  } as CSSProperties,
  stepper: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--v2-line)',
    borderRadius: 9,
    background: '#111111',
    overflow: 'hidden',
    height: 34,
  } as CSSProperties,
  stepperBtn: {
    width: 28,
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: 'var(--v2-ink)',
    fontSize: 'calc(15px + 4pt)',
    fontWeight: 300,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as CSSProperties,
  stepperVal: {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: 'calc(12px + 4pt)',
    fontWeight: 700,
    color: 'var(--v2-ink)',
    pointerEvents: 'none' as const,
  } as CSSProperties,
  flagChip: {
    padding: '6px 8px',
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#0d0d0d',
    color: 'var(--v2-ink-2)',
    fontSize: 'calc(11px + 4pt)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left' as const,
    width: '100%',
  } as CSSProperties,
  scopePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    borderRadius: 20,
    fontSize: 'calc(10px + 4pt)',
    fontWeight: 600,
    border: '1px solid var(--v2-line)',
  } as CSSProperties,
  footer: {
    position: 'sticky' as const,
    bottom: 0,
    zIndex: 20,
    borderTop: '1px solid var(--v2-line)',
    background: 'rgba(8,8,8,0.96)',
    backdropFilter: 'blur(10px)',
    padding: '7px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  } as CSSProperties,
} as const

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function unknownNumberOrNull(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toInputNumber(value: unknown) {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : ''
}

function toDisplayNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '--'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getFlagMultiplierHint(label: string) {
  const normalized = label.replace(/\u00D7/g, 'x')
  const scoped = normalized.match(/\b(?:walls?|ceil(?:ing)?|trim|doors?)\s*x\s*\d+(?:\.\d+)?\b/i)
  if (scoped) return scoped[0].replace(/\s+/g, ' ')
  const simple = normalized.match(/\bx\s*\d+(?:\.\d+)?\b/i)
  if (simple) return simple[0].replace(/\s+/g, '')
  return null
}

function toPositiveFactorString(value: unknown, fallback = '1') {
  const parsed = unknownNumberOrNull(value)
  if (parsed == null || parsed <= 0) return fallback
  return toInputNumber(parsed) || fallback
}

function sortByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position)
}

function resolveRoomModeById(params: {
  rooms: RoomDraft[]
  wallScopes: WallScopeDraft[]
  ceilingScopes: CeilingScopeDraft[]
}) {
  const roomMode = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of params.wallScopes) {
    if (roomMode.has(scope.roomId)) continue
    roomMode.set(scope.roomId, scope.mode)
  }
  for (const scope of params.ceilingScopes) {
    if (roomMode.has(scope.roomId)) continue
    roomMode.set(scope.roomId, scope.mode)
  }
  for (const room of params.rooms) {
    if (!roomMode.has(room.roomId)) {
      roomMode.set(room.roomId, 'RECT')
    }
  }
  return roomMode
}

function nextRoomCode(rooms: RoomDraft[]) {
  const used = new Set(rooms.map((room) => room.roomId))
  let n = 1
  while (used.has(`R${String(n).padStart(3, '0')}`)) {
    n += 1
  }
  return `R${String(n).padStart(3, '0')}`
}

function createDefaultRoom(existingRooms: RoomDraft[]): RoomDraft {
  return {
    id: createUuid(),
    roomId: nextRoomCode(existingRooms),
    roomName: `Room ${existingRooms.length + 1}`,
    roomTypeId: '',
    lengthIn: '',
    widthIn: '',
    heightIn: '',
    wallComplexityId: '',
    notes: '',
    position: existingRooms.length,
  }
}

function createDefaultScope(roomId: string, mode: WallScopeMode, paintProductId = ''): WallScopeDraft {
  return {
    id: createUuid(),
    roomId,
    position: 0,
    mode,
    include: 'Y',
    scopeName: '',
    colorId: '',
    paintProductId,
    primerProductId: '',
    primeMode: 'NONE',
    heightIn: '',
    perimeterIn: '',
    standardDoorCount: '',
    standardWindowCount: '',
    heightFactor: '1',
    complexityFactor: '1',
    wallFlagFactor: '1',
    cutInTopFactor: '1',
    cutInBottomFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    spotPrimePercent: '',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
  }
}

function createDefaultSegment(roomId: string, wallScopeId: string): WallSegmentDraft {
  return {
    id: createUuid(),
    wallScopeId,
    roomId,
    position: 0,
    segmentName: '',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '',
    heightIn: '',
    baseIn: '',
    manualAreaSqFt: '',
    standardDoorCount: '',
    standardWindowCount: '',
    overrideAreaSqFt: '',
    notes: '',
  }
}

function normalizeRoom(row: Unsafe, index: number): RoomDraft {
  return {
    id: asText(row.id) || createUuid(),
    roomId: asText(row.room_id).toUpperCase() || `R${String(index + 1).padStart(3, '0')}`,
    roomName: asText(row.room_name) || `Room ${index + 1}`,
    roomTypeId: asText(row.room_type_id).toUpperCase(),
    lengthIn: toInputNumber(row.length_in),
    widthIn: toInputNumber(row.width_in),
    heightIn: toInputNumber(row.wallheight_in ?? row.height_in),
    wallComplexityId: asText(row.wall_complexity_id || row.wall_complexity_type_id).toUpperCase(),
    notes: asText(row.notes),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
  }
}

function normalizeRoomFlag(row: Unsafe, index: number): RoomFlagDraft | null {
  const roomId = asText(row.room_id).toUpperCase()
  const flagId = asText(row.flag_id).toUpperCase()
  if (!roomId || !flagId) return null
  return {
    id: asText(row.id) || createUuid(),
    roomId,
    flagId,
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
  }
}

function normalizeScope(row: Unsafe, index: number): WallScopeDraft {
  return {
    id: asText(row.id) || createUuid(),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    mode: asText(row.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT',
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    scopeName: asText(row.scope_name),
    colorId: asText(row.color_id).toUpperCase(),
    paintProductId: asText(row.paint_product_id),
    primerProductId: asText(row.primer_product_id),
    primeMode:
      asText(row.prime_mode).toUpperCase() === 'SPOT'
        ? 'SPOT'
        : asText(row.prime_mode).toUpperCase() === 'FULL'
          ? 'FULL'
          : 'NONE',
    heightIn: toInputNumber(row.height_in),
    perimeterIn: toInputNumber(row.perimeter_in),
    standardDoorCount: toInputNumber(row.standard_door_count),
    standardWindowCount: toInputNumber(row.standard_window_count),
    heightFactor: toInputNumber(row.height_factor || 1) || '1',
    complexityFactor: toInputNumber(row.complexity_factor || 1) || '1',
    wallFlagFactor: toInputNumber(row.wall_flag_factor || 1) || '1',
    cutInTopFactor: toInputNumber(row.cut_in_top_factor || 1) || '1',
    cutInBottomFactor: toInputNumber(row.cut_in_bottom_factor || 1) || '1',
    paintCoats: toPositiveFactorString(row.paint_coats ?? row.wall_coats ?? row.walls_topcoats, '2'),
    primerCoats: toPositiveFactorString(row.primer_coats ?? row.wall_primer_coats, '1'),
    spotPrimePercent: toInputNumber(row.spot_prime_percent ?? row.wall_spot_prime_pct),
    overrideAreaSqFt: toInputNumber(row.override_area_sf),
    overridePaintHours: toInputNumber(row.override_paint_hours),
    overridePrimerHours: toInputNumber(row.override_primer_hours),
    overridePaintGallons: toInputNumber(row.override_paint_gallons),
    overridePrimerGallons: toInputNumber(row.override_primer_gallons),
    overrideSupplyCost: toInputNumber(row.override_supply_cost),
    overrideTotal: toInputNumber(row.override_total),
    notes: asText(row.notes),
  }
}

function normalizeSegment(row: Unsafe, index: number): WallSegmentDraft {
  const shapeRaw = asText(row.shape_type).toUpperCase()
  return {
    id: asText(row.id) || createUuid(),
    wallScopeId: asText(row.wall_scope_id),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    segmentName: asText(row.segment_name),
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    shapeType:
      shapeRaw === 'TRIANGLE' ? 'TRIANGLE' : shapeRaw === 'MANUAL' ? 'MANUAL' : 'RECTANGLE',
    quantity: toInputNumber(row.quantity || 1) || '1',
    widthIn: toInputNumber(row.width_in),
    heightIn: toInputNumber(row.height_in),
    baseIn: toInputNumber(row.base_in),
    manualAreaSqFt: toInputNumber(row.manual_area_sf),
    standardDoorCount: toInputNumber(row.standard_door_count),
    standardWindowCount: toInputNumber(row.standard_window_count),
    overrideAreaSqFt: toInputNumber(row.override_area_sf),
    notes: asText(row.notes),
  }
}

function createDefaultCeilingScope(roomId: string, mode: CeilingScopeMode): CeilingScopeDraft {
  return {
    id: createUuid(),
    roomId,
    position: 0,
    mode,
    include: 'Y',
    scopeName: '',
    colorId: '',
    paintProductId: '',
    primerProductId: '',
    primeMode: 'NONE',
    spotPrimePercent: '',
    ceilingTypeId: '',
    lengthIn: '',
    widthIn: '',
    areaSf: '',
    heightFactor: '1',
    complexityFactor: '1',
    ceilingFlagFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
  }
}

function createDefaultCeilingSegment(roomId: string, ceilingScopeId: string): CeilingSegmentDraft {
  return {
    id: createUuid(),
    ceilingScopeId,
    roomId,
    position: 0,
    segmentName: '',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '',
    heightIn: '',
    baseIn: '',
    manualAreaSqFt: '',
    overrideAreaSqFt: '',
    notes: '',
  }
}

function normalizeCeilingScope(row: Unsafe, index: number): CeilingScopeDraft {
  const modeRaw = asText(row.mode).toUpperCase()
  const primeModeRaw = asText(row.prime_mode).toUpperCase()
  return {
    id: asText(row.id) || createUuid(),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    mode: modeRaw === 'SEG' ? 'SEG' : 'RECT',
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    scopeName: asText(row.scope_name),
    colorId: asText(row.color_id).toUpperCase(),
    paintProductId: asText(row.paint_product_id),
    primerProductId: asText(row.primer_product_id),
    primeMode: primeModeRaw === 'SPOT' ? 'SPOT' : primeModeRaw === 'FULL' ? 'FULL' : 'NONE',
    spotPrimePercent: toInputNumber(row.spot_prime_percent),
    ceilingTypeId: asText(row.ceiling_type_id).toUpperCase(),
    lengthIn: toInputNumber(row.length_in),
    widthIn: toInputNumber(row.width_in),
    areaSf: toInputNumber(row.area_sf),
    heightFactor: toPositiveFactorString(row.height_factor, '1'),
    complexityFactor: toPositiveFactorString(row.complexity_factor, '1'),
    ceilingFlagFactor: toPositiveFactorString(row.ceiling_flag_factor, '1'),
    paintCoats: toPositiveFactorString(row.paint_coats, '2'),
    primerCoats: toPositiveFactorString(row.primer_coats, '1'),
    overrideAreaSqFt: toInputNumber(row.override_area_sf),
    overridePaintHours: toInputNumber(row.override_paint_hours),
    overridePrimerHours: toInputNumber(row.override_primer_hours),
    overridePaintGallons: toInputNumber(row.override_paint_gallons),
    overridePrimerGallons: toInputNumber(row.override_primer_gallons),
    overrideSupplyCost: toInputNumber(row.override_supply_cost),
    overrideTotal: toInputNumber(row.override_total),
    notes: asText(row.notes),
  }
}

function normalizeCeilingSegment(row: Unsafe, index: number): CeilingSegmentDraft {
  const shapeRaw = asText(row.shape_type).toUpperCase()
  return {
    id: asText(row.id) || createUuid(),
    ceilingScopeId: asText(row.ceiling_scope_id),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    segmentName: asText(row.segment_name),
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    shapeType: shapeRaw === 'TRIANGLE' ? 'TRIANGLE' : shapeRaw === 'MANUAL' ? 'MANUAL' : 'RECTANGLE',
    quantity: toInputNumber(row.quantity || 1) || '1',
    widthIn: toInputNumber(row.width_in),
    heightIn: toInputNumber(row.height_in),
    baseIn: toInputNumber(row.base_in),
    manualAreaSqFt: toInputNumber(row.manual_area_sf),
    overrideAreaSqFt: toInputNumber(row.override_area_sf),
    notes: asText(row.notes),
  }
}

function createDefaultTrimScope(roomId: string): TrimScopeDraft {
  return {
    id: createUuid(),
    roomId,
    position: 0,
    include: 'Y',
    scopeName: '',
    trimTypeId: '',
    trimFamily: '',
    unitType: 'LF',
    measurementMode: 'MANUAL',
    helperSource: '',
    measurementValue: '',
    helperValue: '',
    colorId: '',
    paintProductId: '',
    primerProductId: '',
    paintEnabled: 'Y',
    primeMode: 'NONE',
    spotPrimePercent: '',
    productionRateId: '',
    prepFactor: '1',
    heightFactor: '1',
    profileFactor: '1',
    roomFlagFactor: '1',
    maskingFactor: '1',
    stairFactor: '1',
    difficultFinishFactor: '1',
    caulkFillFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideMeasurement: '',
    overrideHours: '',
    overrideGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    overrideDescription: '',
    notes: '',
  }
}

function normalizeTrimScope(row: Unsafe, index: number): TrimScopeDraft {
  const measurementModeRaw = asText(row.measurement_mode).toUpperCase()
  const primeModeRaw = asText(row.prime_mode).toUpperCase()
  const unitRaw = asText(row.unit_type || row.unit).toUpperCase()
  return {
    id: asText(row.id) || createUuid(),
    roomId: asText(row.room_id).toUpperCase(),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    include: asText(row.include).toUpperCase() === 'N' ? 'N' : 'Y',
    scopeName: asText(row.scope_name),
    trimTypeId: asText(row.trim_type_id || row.trim_menu_id).toUpperCase(),
    trimFamily: asText(row.trim_family || row.category).toUpperCase(),
    unitType: unitRaw === 'EA' ? 'EA' : unitRaw === 'SF' ? 'SF' : 'LF',
    measurementMode: measurementModeRaw === 'ROOM_HELPER' ? 'ROOM_HELPER' : 'MANUAL',
    helperSource:
      asText(row.helper_source).toUpperCase() === 'ROOM_PERIMETER' ? 'ROOM_PERIMETER' : '',
    measurementValue: toInputNumber(row.measurement_value ?? row.qty),
    helperValue: toInputNumber(row.helper_value),
    colorId: asText(row.color_id).toUpperCase(),
    paintProductId: asText(row.paint_product_id),
    primerProductId: asText(row.primer_product_id),
    paintEnabled: asText(row.paint_enabled).toUpperCase() === 'N' ? 'N' : 'Y',
    primeMode: primeModeRaw === 'SPOT' ? 'SPOT' : primeModeRaw === 'FULL' ? 'FULL' : 'NONE',
    spotPrimePercent: toInputNumber(row.spot_prime_percent),
    productionRateId: asText(row.production_rate_id).toUpperCase(),
    prepFactor: toPositiveFactorString(row.prep_factor, '1'),
    heightFactor: toPositiveFactorString(row.height_factor, '1'),
    profileFactor: toPositiveFactorString(row.profile_factor, '1'),
    roomFlagFactor: toPositiveFactorString(row.room_flag_factor, '1'),
    maskingFactor: toPositiveFactorString(row.masking_factor, '1'),
    stairFactor: toPositiveFactorString(row.stair_factor, '1'),
    difficultFinishFactor: toPositiveFactorString(row.difficult_finish_factor, '1'),
    caulkFillFactor: toPositiveFactorString(row.caulk_fill_factor, '1'),
    paintCoats: toPositiveFactorString(row.paint_coats, '2'),
    primerCoats: toPositiveFactorString(row.primer_coats, '1'),
    overrideMeasurement: toInputNumber(row.override_measurement),
    overrideHours: toInputNumber(row.override_hours),
    overrideGallons: toInputNumber(row.override_gallons),
    overrideSupplyCost: toInputNumber(row.override_supply_cost),
    overrideTotal: toInputNumber(row.override_total),
    overrideDescription: asText(row.override_description),
    notes: asText(row.notes),
  }
}

function deriveSegment(segment: WallSegmentDraft): SegmentDerived {
  const quantity = numberOrNull(segment.quantity) ?? 1
  const widthIn = numberOrNull(segment.widthIn)
  const heightIn = numberOrNull(segment.heightIn)
  const baseIn = numberOrNull(segment.baseIn)
  const manualAreaSqFt = numberOrNull(segment.manualAreaSqFt)
  let rawArea: number | null = null

  if (segment.shapeType === 'RECTANGLE' && widthIn != null && heightIn != null) {
    rawArea = (widthIn * heightIn * quantity) / 144
  } else if (segment.shapeType === 'TRIANGLE' && baseIn != null && heightIn != null) {
    rawArea = ((baseIn * heightIn) / 2 / 144) * quantity
  } else if (segment.shapeType === 'MANUAL' && manualAreaSqFt != null) {
    rawArea = manualAreaSqFt * quantity
  }

  const doorCount = numberOrNull(segment.standardDoorCount) ?? 0
  const windowCount = numberOrNull(segment.standardWindowCount) ?? 0
  const deductionArea = doorCount * STANDARD_DOOR_DEDUCTION_SF + windowCount * STANDARD_WINDOW_DEDUCTION_SF
  const deductionAdjustedArea = rawArea == null ? null : Math.max(rawArea - deductionArea, 0)
  const overrideArea = numberOrNull(segment.overrideAreaSqFt)
  return {
    rawArea,
    deductionArea,
    deductionAdjustedArea,
    effectiveArea: overrideArea ?? deductionAdjustedArea,
  }
}

function deriveScope(scope: WallScopeDraft, scopeSegments: WallSegmentDraft[]): ScopeDerived {
  if (scope.mode === 'RECT') {
    const perimeter = numberOrNull(scope.perimeterIn)
    const height = numberOrNull(scope.heightIn)
    const doorCount = numberOrNull(scope.standardDoorCount) ?? 0
    const windowCount = numberOrNull(scope.standardWindowCount) ?? 0
    const openingArea = doorCount * STANDARD_DOOR_DEDUCTION_SF + windowCount * STANDARD_WINDOW_DEDUCTION_SF
    const rawArea =
      perimeter != null && height != null ? Math.max(perimeter * height / 144 - openingArea, 0) : null
    const overrideArea = numberOrNull(scope.overrideAreaSqFt)
    return {
      rawArea,
      effectiveArea: overrideArea ?? rawArea,
    }
  }

  const rawArea = sortByPosition(scopeSegments)
    .filter((segment) => segment.include === 'Y')
    .reduce((sum, segment) => sum + (deriveSegment(segment).effectiveArea ?? 0), 0)
  const overrideArea = numberOrNull(scope.overrideAreaSqFt)
  return {
    rawArea,
    effectiveArea: overrideArea ?? rawArea,
  }
}

function moveItem<T>(rows: T[], from: number, to: number) {
  if (to < 0 || to >= rows.length) return rows
  const next = [...rows]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label style={S.label}>
      <span style={S.mono}>{label}</span>
      {children}
    </label>
  )
}

function RoomSetup({ children }: { children: ReactNode }) {
  return <section className="section-card section-card-compact" style={{ ...S.panel, display: 'grid', gap: 8 }}>{children}</section>
}

function GeometryBlock({ children }: { children: ReactNode }) {
  return <section className="section-card section-card-green section-card-compact" style={{ ...S.panel, display: 'grid', gap: 8 }}>{children}</section>
}

function PaintSetup({ children }: { children: ReactNode }) {
  return <section className="section-card section-card-compact" style={{ ...S.panel, display: 'grid', gap: 8 }}>{children}</section>
}

function Modifiers({ children }: { children: ReactNode }) {
  return <section className="section-card section-card-compact" style={{ ...S.panel, display: 'grid', gap: 8 }}>{children}</section>
}

function Scope({ children }: { children: ReactNode }) {
  return <section className="section-card section-card-compact" style={{ ...S.panel, display: 'grid', gap: 6 }}>{children}</section>
}

function Advanced({ children }: { children: ReactNode }) {
  return <section className="section-card section-card-compact" style={{ ...S.panel, display: 'grid', gap: 8 }}>{children}</section>
}

function SummaryRail({ children }: { children: ReactNode }) {
  return <aside className="room-side-col section-card section-card-compact" style={{ ...S.panel, display: 'grid', gap: 8, alignSelf: 'start', position: 'sticky', top: 74 }}>{children}</aside>
}

function RoomHeaderSetup({ children }: { children: ReactNode }) {
  return (
    <section className="section-card section-card-green section-card-compact" style={{ ...S.panel, display: 'grid', gap: 10 }}>
      {children}
    </section>
  )
}

function RoomLevelModifiers({ children }: { children: ReactNode }) {
  return (
    <section className="section-card section-card-compact" style={{ ...S.panel, display: 'grid', gap: 8 }}>
      {children}
    </section>
  )
}

function ScopeAccordionList({ children }: { children: ReactNode }) {
  return <section style={{ display: 'grid', gap: 10 }}>{children}</section>
}

function ScopeAccordionRow({
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  title: string
  summary: ReactNode
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="section-card section-card-compact" style={{ ...S.panel, display: 'grid', gap: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          border: '1px solid var(--v2-line)',
          background: '#111111',
          borderRadius: 10,
          padding: '10px 12px',
          textAlign: 'left',
          color: 'var(--v2-ink)',
          display: 'grid',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>{title}</span>
          <span style={{ ...S.mono, color: 'var(--v2-ink-3)' }}>{expanded ? 'collapse ^' : 'expand v'}</span>
        </div>
        {summary}
      </button>
      {expanded ? <div style={{ display: 'grid', gap: 10 }}>{children}</div> : null}
    </section>
  )
}

function WallsScopePanel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 10 }}>{children}</div>
}

function CeilingsScopePanel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 10 }}>{children}</div>
}

function TrimScopePanel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 10 }}>{children}</div>
}

export default function EstimateV2WallsPage() {
  const params = useParams<{ id: string }>()
  const estimateId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [estimate, setEstimate] = useState<EstimateMeta | null>(null)
  const [job, setJob] = useState<JobMeta | null>(null)
  const [catalogs, setCatalogs] = useState<CatalogsPayload['catalogs']>({
    paint_products: [],
    color_codes: [],
    wall_complexity_types: [],
    room_types: [],
    room_flags: [],
    ceiling_types: [],
    trim_items: [],
  })
  const [rooms, setRooms] = useState<RoomDraft[]>([])
  const [scopes, setScopes] = useState<WallScopeDraft[]>([])
  const [segments, setSegments] = useState<WallSegmentDraft[]>([])
  const [roomFlags, setRoomFlags] = useState<RoomFlagDraft[]>([])
  const [ceilingScopes, setCeilingScopes] = useState<CeilingScopeDraft[]>([])
  const [ceilingSegments, setCeilingSegments] = useState<CeilingSegmentDraft[]>([])
  const [trimScopes, setTrimScopes] = useState<TrimScopeDraft[]>([])
  const [wallCalculations, setWallCalculations] = useState<WallCalculationsPayload | null>(null)
  const [ceilingCalculations, setCeilingCalculations] = useState<Unsafe | null>(null)
  const [trimCalculations, setTrimCalculations] = useState<Unsafe | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [autoSaveHint, setAutoSaveHint] = useState<string | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<(trigger?: 'manual' | 'auto') => Promise<void>>(async () => {})
  const saveRequestTrackerRef = useRef(createSaveRequestTracker())

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [jobSettingsDraft, setJobSettingsDraft] = useState<JobSettingsDraft>({
    laborDayEnabled: true,
    dayhours: 8,
    roundingIncrementHours: 4,
    laborRate: 40,
    jobMinEnabled: false,
    jobMinAmount: 0,
    wallPaintProductId: '',
  })
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>({
    customerId: '',
    name: '',
    email: '',
    phone: '',
    address: '',
  })
  const customerSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const policySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!estimateId) return
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      setValidationIssues([])

      const [estimateRes, catalogsRes] = await Promise.all([
        authedFetch(`/api/estimates/${estimateId}`, { cache: 'no-store' }),
        authedFetch(`/api/estimates/${estimateId}/catalogs?v2=1`, { cache: 'no-store' }),
      ])

      const estimatePayload = (await estimateRes.json().catch(() => null)) as EstimateResponse | { error?: string } | null
      const catalogsPayload = (await catalogsRes.json().catch(() => null)) as CatalogsPayload | { error?: string } | null

      if (!active) return

      if (!estimateRes.ok || !estimatePayload || !('estimate' in estimatePayload)) {
        setError((estimatePayload as { error?: string } | null)?.error ?? estimateRes.statusText)
        setLoading(false)
        return
      }

      const nextEstimate = estimatePayload.estimate
      setEstimate(nextEstimate)

      if (catalogsRes.ok && catalogsPayload && 'catalogs' in catalogsPayload) {
        setCatalogs(catalogsPayload.catalogs)
      } else if (!catalogsRes.ok) {
        setError((catalogsPayload as { error?: string } | null)?.error ?? catalogsRes.statusText)
      }

      const jobRes = await authedFetch(`/api/jobs/${nextEstimate.job_id}`, { cache: 'no-store' })
      const jobPayload = (await jobRes.json().catch(() => null)) as JobResponse | { error?: string } | null
      if (!active) return
      if (jobRes.ok && jobPayload && 'job' in jobPayload) {
        setJob(jobPayload.job)
        const j = jobPayload.job
        setCustomerDraft({
          customerId: j.customer_id ?? '',
          name: j.customer_name ?? '',
          email: j.customer_email ?? '',
          phone: j.customer_phone ?? '',
          address: j.customer_address ?? '',
        })
      }

      const js = estimatePayload.inputs?.jobsettings ?? null
      if (js) {
        const normalizedWallDefault = asText(js.walls_paint_id ?? js.wall_paint_id)
        setJobSettingsDraft({
          laborDayEnabled: js.labor_day_policy_enabled !== false,
          dayhours: Number(js.dayhours) || 8,
          roundingIncrementHours: Number(js.rounding_increment_hours) || 4,
          laborRate: Number(js.override_labor_rate) || 40,
          jobMinEnabled: js.job_minimum_enabled === true,
          jobMinAmount: Number(js.job_minimum_amount) || 0,
          wallPaintProductId: normalizedWallDefault,
        })
      }

      const normalizedRooms = sortByPosition((estimatePayload.inputs.rooms ?? []).map(normalizeRoom))
      const loadedScopes = sortByPosition((estimatePayload.inputs.room_wall_scopes ?? []).map(normalizeScope))
      const loadedSegments = sortByPosition((estimatePayload.inputs.wall_segments ?? []).map(normalizeSegment))
      const sanitized = sanitizeV2WallsDrafts({
        rooms: normalizedRooms,
        scopes: loadedScopes,
        segments: loadedSegments,
      })
      const initialWallPaintDefault =
        asText((js as Unsafe | null | undefined)?.walls_paint_id ?? (js as Unsafe | null | undefined)?.wall_paint_id) ||
        sanitized.scopes.find((scope) => asText(scope.paintProductId))?.paintProductId ||
        ''
      setJobSettingsDraft((prev) => (prev.wallPaintProductId === initialWallPaintDefault ? prev : { ...prev, wallPaintProductId: initialWallPaintDefault }))
      const normalizedRoomFlags = sortByPosition(
        (estimatePayload.inputs.room_flags ?? [])
          .map(normalizeRoomFlag)
          .filter((flag): flag is RoomFlagDraft => flag != null)
      )

      const normalizedCeilingScopes = sortByPosition(
        (estimatePayload.inputs.room_ceiling_scopes ?? []).map(normalizeCeilingScope)
      )
      const normalizedCeilingSegments = sortByPosition(
        (estimatePayload.inputs.ceiling_scope_segments ?? []).map(normalizeCeilingSegment)
      )
      const sanitizedCeilings = sanitizeV2CeilingsDrafts({
        rooms: normalizedRooms.map((r) => ({
          roomId: r.roomId,
          lengthIn: r.lengthIn,
          widthIn: r.widthIn,
          position: r.position,
        })),
        ceilingScopes: normalizedCeilingScopes,
        ceilingSegments: normalizedCeilingSegments,
      })
      const normalizedTrimScopes = sortByPosition(
        (estimatePayload.inputs.room_trim_scopes ?? []).map(normalizeTrimScope)
      )
      const roomModeById = resolveRoomModeById({
        rooms: normalizedRooms,
        wallScopes: sanitized.scopes,
        ceilingScopes: sanitizedCeilings.ceilingScopes,
      })
      const sanitizedTrim = sanitizeV2TrimDrafts({
        rooms: normalizedRooms.map((r) => ({
          roomId: r.roomId,
          mode: roomModeById.get(r.roomId) ?? 'RECT',
          position: r.position,
        })),
        trimScopes: normalizedTrimScopes,
      })

      setRooms(normalizedRooms)
      setScopes(sanitized.scopes)
      setSegments(sanitized.segments)
      setRoomFlags(normalizedRoomFlags)
      setCeilingScopes(sanitizedCeilings.ceilingScopes)
      setCeilingSegments(sanitizedCeilings.ceilingSegments)
      setTrimScopes(sanitizedTrim.trimScopes)
      setWallCalculations(estimatePayload.wall_calculations ?? null)
      setCeilingCalculations(estimatePayload.ceiling_calculations ?? null)
      setTrimCalculations(estimatePayload.trim_calculations ?? null)
      setSelectedRoomId((current) => {
        if (current && normalizedRooms.some((room) => room.roomId === current)) return current
        return normalizedRooms[0]?.roomId ?? ''
      })

      const initialSnapshot = JSON.stringify(
        buildSavePayload(
          normalizedRooms,
          sanitized.scopes,
          sanitized.segments,
          normalizedRoomFlags,
          sanitizedCeilings.ceilingScopes,
          sanitizedCeilings.ceilingSegments,
          sanitizedTrim.trimScopes
        )
      )
      setLastSavedSnapshot(initialSnapshot)
      setSaveStatus('saved')
      setAutoSaveHint(null)
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [estimateId])

  const currentPayload = useMemo(
    () => buildSavePayload(rooms, scopes, segments, roomFlags, ceilingScopes, ceilingSegments, trimScopes),
    [rooms, scopes, segments, roomFlags, ceilingScopes, ceilingSegments, trimScopes]
  )
  const currentSnapshot = useMemo(() => JSON.stringify(currentPayload), [currentPayload])
  const dirty = !loading && currentSnapshot !== lastSavedSnapshot

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const selectedRoom = rooms.find((room) => room.roomId === selectedRoomId) ?? null
  const selectedRoomScopes = useMemo(
    () => sortByPosition(scopes.filter((scope) => scope.roomId === selectedRoomId)),
    [scopes, selectedRoomId]
  )
  const selectedRoomMode = selectedRoomScopes[0]?.mode ?? 'RECT'
  const firstScope = selectedRoomScopes[0] ?? null

  const selectedRoomCeilingScopes = useMemo(
    () => sortByPosition(ceilingScopes.filter((s) => s.roomId === selectedRoomId)),
    [ceilingScopes, selectedRoomId]
  )
  const selectedRoomTrimScopes = useMemo(
    () => sortByPosition(trimScopes.filter((s) => s.roomId === selectedRoomId)),
    [trimScopes, selectedRoomId]
  )
  const wallsIncluded = selectedRoomScopes.some((scope) => scope.include === 'Y')
  const selectedRoomCeilingMode = selectedRoomCeilingScopes[0]?.mode ?? 'RECT'
  const firstCeilingScope = selectedRoomCeilingScopes[0] ?? null
  const ceilingsIncluded = selectedRoomCeilingScopes.some((scope) => scope.include === 'Y')
  const trimsIncluded = selectedRoomTrimScopes.some((scope) => scope.include === 'Y')
  const jobTrimsIncluded = trimScopes.some((scope) => scope.include === 'Y')
  const roomModeById = useMemo(
    () => resolveRoomModeById({ rooms, wallScopes: scopes, ceilingScopes }),
    [rooms, scopes, ceilingScopes]
  )
  const selectedRoomResolvedMode = selectedRoom ? roomModeById.get(selectedRoom.roomId) ?? 'RECT' : 'RECT'

  const ceilingScopeEffectiveAreaById = useMemo(() => {
    const next = new Map<string, number | null>()
    const calcScopes =
      ceilingCalculations && typeof ceilingCalculations === 'object' && Array.isArray((ceilingCalculations as Unsafe).scopes)
        ? ((ceilingCalculations as Unsafe).scopes as Unsafe[])
        : []
    for (const scope of calcScopes) {
      const scopeId = asText(scope.id)
      if (!scopeId) continue
      next.set(scopeId, unknownNumberOrNull(scope.effective_area_sf))
    }
    return next
  }, [ceilingCalculations])

  const trimScopeEffectiveMeasurementById = useMemo(() => {
    const next = new Map<string, number | null>()
    const calcScopes =
      trimCalculations && typeof trimCalculations === 'object' && Array.isArray((trimCalculations as Unsafe).scopes)
        ? ((trimCalculations as Unsafe).scopes as Unsafe[])
        : []
    for (const scope of calcScopes) {
      const scopeId = asText(scope.id)
      if (!scopeId) continue
      next.set(scopeId, unknownNumberOrNull(scope.effective_measurement))
    }
    return next
  }, [trimCalculations])

  const trimScopeEffectiveTotalById = useMemo(() => {
    const next = new Map<string, number | null>()
    const calcScopes =
      trimCalculations && typeof trimCalculations === 'object' && Array.isArray((trimCalculations as Unsafe).scopes)
        ? ((trimCalculations as Unsafe).scopes as Unsafe[])
        : []
    for (const scope of calcScopes) {
      const scopeId = asText(scope.id)
      if (!scopeId) continue
      next.set(scopeId, unknownNumberOrNull(scope.effective_total))
    }
    return next
  }, [trimCalculations])

  const selectedCeilingEffectiveSqFt = useMemo(() => {
    let total = 0
    let hasValues = false
    for (const scope of selectedRoomCeilingScopes) {
      if (scope.include !== 'Y') continue
      const area = ceilingScopeEffectiveAreaById.get(scope.id)
      if (area == null) continue
      hasValues = true
      total += area
    }
    return hasValues ? Math.round(total * 100) / 100 : null
  }, [selectedRoomCeilingScopes, ceilingScopeEffectiveAreaById])

  const wallComplexityById = useMemo(() => {
    const next = new Map<string, WallComplexityOption>()
    for (const option of catalogs.wall_complexity_types) {
      next.set(option.id, option)
    }
    return next
  }, [catalogs.wall_complexity_types])

  const roomFlagById = useMemo(() => {
    const next = new Map<string, RoomFlagOption>()
    for (const option of catalogs.room_flags) {
      next.set(option.id, option)
    }
    return next
  }, [catalogs.room_flags])

  const roomScopeByRoomId = useMemo(() => {
    const next = new Map<string, WallScopeDraft[]>()
    for (const scope of scopes) {
      const list = next.get(scope.roomId)
      if (list) {
        list.push(scope)
      } else {
        next.set(scope.roomId, [scope])
      }
    }
    for (const [roomId, roomScopes] of next.entries()) {
      next.set(roomId, sortByPosition(roomScopes))
    }
    return next
  }, [scopes])

  const roomComplexityFactorByRoomId = useMemo(() => {
    const next = new Map<string, string>()
    for (const room of rooms) {
      const multiplier = wallComplexityById.get(room.wallComplexityId)?.labor_multiplier ?? 1
      next.set(room.roomId, toPositiveFactorString(multiplier, '1'))
    }
    return next
  }, [rooms, wallComplexityById])

  const roomWallFlagFactorByRoomId = useMemo(() => {
    const next = new Map<string, string>()
    const selectedByRoomId = new Map<string, RoomFlagDraft[]>()
    for (const flag of roomFlags) {
      const list = selectedByRoomId.get(flag.roomId)
      if (list) {
        list.push(flag)
      } else {
        selectedByRoomId.set(flag.roomId, [flag])
      }
    }

    for (const room of rooms) {
      const selectedFlags = selectedByRoomId.get(room.roomId) ?? []
      let factor = 1
      for (const selectedFlag of selectedFlags) {
        const nextFactor = roomFlagById.get(selectedFlag.flagId)?.wall_factor
        if (nextFactor != null && Number.isFinite(nextFactor) && nextFactor > 0) {
          factor *= nextFactor
        }
      }
      next.set(room.roomId, toPositiveFactorString(factor, '1'))
    }

    return next
  }, [roomFlags, roomFlagById, rooms])

  const roomCeilingFlagFactorByRoomId = useMemo(() => {
    const next = new Map<string, string>()
    const selectedByRoomId = new Map<string, RoomFlagDraft[]>()
    for (const flag of roomFlags) {
      const list = selectedByRoomId.get(flag.roomId)
      if (list) {
        list.push(flag)
      } else {
        selectedByRoomId.set(flag.roomId, [flag])
      }
    }
    for (const room of rooms) {
      const selectedFlags = selectedByRoomId.get(room.roomId) ?? []
      let factor = 1
      for (const selectedFlag of selectedFlags) {
        const nextFactor = roomFlagById.get(selectedFlag.flagId)?.ceil_factor
        if (nextFactor != null && Number.isFinite(nextFactor) && nextFactor > 0) {
          factor *= nextFactor
        }
      }
      next.set(room.roomId, toPositiveFactorString(factor, '1'))
    }
    return next
  }, [roomFlags, roomFlagById, rooms])

  const roomTrimFlagFactorByRoomId = useMemo(() => {
    const next = new Map<string, string>()
    const selectedByRoomId = new Map<string, RoomFlagDraft[]>()
    for (const flag of roomFlags) {
      const list = selectedByRoomId.get(flag.roomId)
      if (list) {
        list.push(flag)
      } else {
        selectedByRoomId.set(flag.roomId, [flag])
      }
    }
    for (const room of rooms) {
      const selectedFlags = selectedByRoomId.get(room.roomId) ?? []
      let factor = 1
      for (const selectedFlag of selectedFlags) {
        const nextFactor = roomFlagById.get(selectedFlag.flagId)?.trim_factor
        if (nextFactor != null && Number.isFinite(nextFactor) && nextFactor > 0) {
          factor *= nextFactor
        }
      }
      next.set(room.roomId, toPositiveFactorString(factor, '1'))
    }
    return next
  }, [roomFlags, roomFlagById, rooms])

  useEffect(() => {
    setScopes((prev) => {
      let changed = false
      const next = prev.map((scope) => {
        const complexityFactor = roomComplexityFactorByRoomId.get(scope.roomId) ?? '1'
        const wallFlagFactor = roomWallFlagFactorByRoomId.get(scope.roomId) ?? '1'
        if (scope.complexityFactor === complexityFactor && scope.wallFlagFactor === wallFlagFactor) {
          return scope
        }
        changed = true
        return { ...scope, complexityFactor, wallFlagFactor }
      })
      return changed ? next : prev
    })
  }, [roomComplexityFactorByRoomId, roomWallFlagFactorByRoomId])

  useEffect(() => {
    setCeilingScopes((prev) => {
      let changed = false
      const next = prev.map((scope) => {
        const complexityFactor = roomComplexityFactorByRoomId.get(scope.roomId) ?? '1'
        const ceilingFlagFactor = roomCeilingFlagFactorByRoomId.get(scope.roomId) ?? '1'
        if (scope.complexityFactor === complexityFactor && scope.ceilingFlagFactor === ceilingFlagFactor) {
          return scope
        }
        changed = true
        return { ...scope, complexityFactor, ceilingFlagFactor }
      })
      return changed ? next : prev
    })
  }, [roomComplexityFactorByRoomId, roomCeilingFlagFactorByRoomId])

  useEffect(() => {
    setTrimScopes((prev) => {
      let changed = false
      const next = prev.map((scope) => {
        const roomFlagFactor = roomTrimFlagFactorByRoomId.get(scope.roomId) ?? '1'
        if (scope.roomFlagFactor === roomFlagFactor) return scope
        changed = true
        return { ...scope, roomFlagFactor }
      })
      return changed ? next : prev
    })
  }, [roomTrimFlagFactorByRoomId])

  useEffect(() => {
    setTrimScopes((prev) => {
      let changed = false
      const next = prev.map((scope) => {
        const roomMode = roomModeById.get(scope.roomId) ?? 'RECT'
        const trimType = catalogs.trim_items.find((item) => item.id === scope.trimTypeId)
        const helperAllowedByType = !!trimType?.helper_allowed
        if (scope.measurementMode !== 'ROOM_HELPER') return scope
        if (roomMode === 'RECT' && helperAllowedByType) {
          if (scope.helperSource === 'ROOM_PERIMETER') return scope
          changed = true
          return { ...scope, helperSource: 'ROOM_PERIMETER' as const }
        }
        changed = true
        return {
          ...scope,
          measurementMode: 'MANUAL' as TrimMeasurementMode,
          helperSource: '' as const,
          helperValue: '',
        }
      })
      return changed ? next : prev
    })
  }, [catalogs.trim_items, roomModeById])

  const scopeEffectiveAreaById = useMemo(() => {
    const next = new Map<string, number | null>()

    for (const trace of wallCalculations?.scope_traces ?? []) {
      const scopeId = asText(trace.scope_id)
      if (!scopeId) continue
      next.set(scopeId, unknownNumberOrNull(trace.area?.effective_area_sf))
    }

    for (const scope of wallCalculations?.scopes ?? []) {
      const scopeId = asText((scope as Unsafe).id)
      if (!scopeId || next.has(scopeId)) continue
      next.set(scopeId, unknownNumberOrNull((scope as Unsafe).effective_area_sf))
    }

    return next
  }, [wallCalculations])

  const segmentEffectiveAreaById = useMemo(() => {
    const next = new Map<string, number | null>()
    for (const segment of wallCalculations?.segments ?? []) {
      const segmentId = asText((segment as Unsafe).id)
      if (!segmentId) continue
      next.set(segmentId, unknownNumberOrNull((segment as Unsafe).effective_area_sf))
    }
    return next
  }, [wallCalculations])

  const roomEffectiveAreaByRoomId = useMemo(() => {
    const next = new Map<string, number | null>()
    for (const total of wallCalculations?.room_totals ?? []) {
      const roomId = asText(total.room_id).toUpperCase()
      if (!roomId) continue
      next.set(roomId, unknownNumberOrNull(total.effective_area_sf))
    }
    return next
  }, [wallCalculations])

  const localSegmentEffectiveAreaById = useMemo(() => {
    const next = new Map<string, number | null>()
    for (const segment of segments) {
      next.set(segment.id, deriveSegment(segment).effectiveArea)
    }
    return next
  }, [segments])

  const localScopeEffectiveAreaById = useMemo(() => {
    const next = new Map<string, number | null>()
    for (const scope of scopes) {
      const scopeSegments = sortByPosition(segments.filter((segment) => segment.wallScopeId === scope.id))
      next.set(scope.id, deriveScope(scope, scopeSegments).effectiveArea)
    }
    return next
  }, [scopes, segments])

  const localRoomEffectiveAreaByRoomId = useMemo(() => {
    const next = new Map<string, number | null>()
    for (const room of rooms) {
      const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === room.roomId))
      const total = roomScopes.reduce((sum, scope) => {
        if (scope.include !== 'Y') return sum
        return sum + (localScopeEffectiveAreaById.get(scope.id) ?? 0)
      }, 0)
      next.set(room.roomId, total)
    }
    return next
  }, [rooms, scopes, localScopeEffectiveAreaById])

  const hasServerCalculations = (wallCalculations?.room_totals?.length ?? 0) > 0
  const useLocalPreviewCalculations = dirty || !hasServerCalculations

  const displayedSegmentEffectiveAreaById = useMemo(
    () => (useLocalPreviewCalculations ? localSegmentEffectiveAreaById : segmentEffectiveAreaById),
    [localSegmentEffectiveAreaById, segmentEffectiveAreaById, useLocalPreviewCalculations]
  )

  const displayedScopeEffectiveAreaById = useMemo(
    () => (useLocalPreviewCalculations ? localScopeEffectiveAreaById : scopeEffectiveAreaById),
    [localScopeEffectiveAreaById, scopeEffectiveAreaById, useLocalPreviewCalculations]
  )

  const displayedRoomEffectiveAreaByRoomId = useMemo(
    () => (useLocalPreviewCalculations ? localRoomEffectiveAreaByRoomId : roomEffectiveAreaByRoomId),
    [localRoomEffectiveAreaByRoomId, roomEffectiveAreaByRoomId, useLocalPreviewCalculations]
  )

  const confirmNavigation = () => {
    if (!dirty) return true
    return window.confirm('You have unsaved changes. Leave this workspace?')
  }

  const updateRoom = (roomId: string, patch: Partial<RoomDraft>) => {
    setRooms((prev) => prev.map((room) => (room.roomId === roomId ? { ...room, ...patch } : room)))
  }

  const updateRoomComplexity = (roomId: string, wallComplexityId: string) => {
    updateRoom(roomId, { wallComplexityId })
    const nextComplexityFactor = toPositiveFactorString(
      wallComplexityById.get(wallComplexityId)?.labor_multiplier ?? 1,
      '1'
    )
    setScopes((prev) =>
      prev.map((scope) =>
        scope.roomId === roomId
          ? {
              ...scope,
              complexityFactor: nextComplexityFactor,
            }
          : scope
      )
    )
  }

  const updateScope = (scopeId: string, patch: Partial<WallScopeDraft>) => {
    setScopes((prev) => prev.map((scope) => (scope.id === scopeId ? { ...scope, ...patch } : scope)))
    if (patch.paintProductId != null) {
      const nextPaintProductId = asText(patch.paintProductId)
      if (nextPaintProductId) {
        setJobSettingsDraft((prev) => {
          if (prev.wallPaintProductId === nextPaintProductId) return prev
          const next = { ...prev, wallPaintProductId: nextPaintProductId }
          savePolicyDebounced(next)
          return next
        })
      }
    }
  }

  const updateSegment = (segmentId: string, patch: Partial<WallSegmentDraft>) => {
    setSegments((prev) => prev.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment)))
  }

  const addRoom = () => {
    setRooms((prev) => {
      const room = createDefaultRoom(prev)
      setScopes((scopesPrev) => [...scopesPrev, createDefaultScope(room.roomId, 'RECT', jobSettingsDraft.wallPaintProductId)])
      setSelectedRoomId(room.roomId)
      return [...prev, room]
    })
  }

  const deleteRoom = (roomId: string) => {
    const roomScopes = scopes.filter((scope) => scope.roomId === roomId)
    const roomSegments = segments.filter((segment) => segment.roomId === roomId)
    const roomCeilScopes = ceilingScopes.filter((scope) => scope.roomId === roomId)
    const roomCeilSegments = ceilingSegments.filter((segment) => segment.roomId === roomId)
    const roomTrimRows = trimScopes.filter((scope) => scope.roomId === roomId)
    const room = rooms.find((entry) => entry.roomId === roomId)
    const label = room?.roomName || roomId
    const hasData =
      roomScopes.length > 0 ||
      roomSegments.length > 0 ||
      roomCeilScopes.length > 0 ||
      roomCeilSegments.length > 0 ||
      roomTrimRows.length > 0
    const ok = window.confirm(
      hasData ? `Delete ${label} and all scope rows/segments in it?` : `Delete ${label}?`
    )
    if (!ok) return

    setRooms((prev) =>
      sortByPosition(prev.filter((roomEntry) => roomEntry.roomId !== roomId)).map((roomEntry, idx) => ({
        ...roomEntry,
        position: idx,
      }))
    )
    setScopes((prev) => prev.filter((scope) => scope.roomId !== roomId))
    setSegments((prev) => prev.filter((segment) => segment.roomId !== roomId))
    setRoomFlags((prev) => prev.filter((flag) => flag.roomId !== roomId))
    setCeilingScopes((prev) => prev.filter((scope) => scope.roomId !== roomId))
    setCeilingSegments((prev) => prev.filter((seg) => seg.roomId !== roomId))
    setTrimScopes((prev) => prev.filter((scope) => scope.roomId !== roomId))
    setSelectedRoomId((prev) => {
      if (prev !== roomId) return prev
      const remaining = sortByPosition(rooms.filter((roomEntry) => roomEntry.roomId !== roomId))
      return remaining[0]?.roomId ?? ''
    })
  }

  const switchRoomMode = (roomId: string, nextMode: WallScopeMode) => {
    const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === roomId))
    const currentMode = roomScopes[0]?.mode ?? 'RECT'

    if (roomScopes.length === 0) {
      setScopes((prev) => [...prev, createDefaultScope(roomId, nextMode, jobSettingsDraft.wallPaintProductId)])
      return
    }

    if (currentMode === nextMode) return

    if (currentMode === 'RECT' && nextMode === 'SEG') {
      const firstScope = roomScopes[0]
      setScopes((prev) =>
        prev.map((scope) =>
          scope.id === firstScope.id
            ? {
                ...scope,
                mode: 'SEG',
                perimeterIn: '',
                standardDoorCount: '',
                standardWindowCount: '',
                position: 0,
              }
            : scope
        )
      )
      return
    }

    const confirmed = window.confirm(
      'Switching this room back to RECT will reset all SEG scopes and segments in the room. Continue?'
    )
    if (!confirmed) return

    const freshScope = createDefaultScope(roomId, 'RECT', jobSettingsDraft.wallPaintProductId)
    const roomScopeIds = new Set(roomScopes.map((scope) => scope.id))
    setScopes((prev) => [...prev.filter((scope) => scope.roomId !== roomId), freshScope])
    setSegments((prev) => prev.filter((segment) => !roomScopeIds.has(segment.wallScopeId)))
  }

  const addScope = (roomId: string) => {
    const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === roomId))
    const nextScope = createDefaultScope(roomId, 'SEG', jobSettingsDraft.wallPaintProductId)
    nextScope.position = roomScopes.length
    setScopes((prev) => [...prev, nextScope])
  }

  const moveScope = (roomId: string, scopeId: string, direction: -1 | 1) => {
    const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === roomId))
    const index = roomScopes.findIndex((scope) => scope.id === scopeId)
    if (index === -1) return
    const reordered = moveItem(roomScopes, index, index + direction).map((scope, idx) => ({
      ...scope,
      position: idx,
    }))
    setScopes((prev) => [...prev.filter((scope) => scope.roomId !== roomId), ...reordered])
  }

  const deleteScope = (roomId: string, scopeId: string) => {
    const ok = window.confirm('Delete this wall scope and all of its segments?')
    if (!ok) return
    setScopes((prev) => {
      const roomScopes = sortByPosition(prev.filter((scope) => scope.roomId === roomId && scope.id !== scopeId)).map(
        (scope, idx) => ({ ...scope, position: idx })
      )
      return [...prev.filter((scope) => scope.roomId !== roomId && scope.id !== scopeId), ...roomScopes]
    })
    setSegments((prev) => prev.filter((segment) => segment.wallScopeId !== scopeId))
  }

  const addSegment = (roomId: string, wallScopeId: string) => {
    const nextSegment = createDefaultSegment(roomId, wallScopeId)
    const scopeSegments = sortByPosition(segments.filter((segment) => segment.wallScopeId === wallScopeId))
    nextSegment.position = scopeSegments.length
    setSegments((prev) => [...prev, nextSegment])
  }

  const moveSegment = (wallScopeId: string, segmentId: string, direction: -1 | 1) => {
    const scopeSegments = sortByPosition(segments.filter((segment) => segment.wallScopeId === wallScopeId))
    const index = scopeSegments.findIndex((segment) => segment.id === segmentId)
    if (index === -1) return
    const reordered = moveItem(scopeSegments, index, index + direction).map((segment, idx) => ({
      ...segment,
      position: idx,
    }))
    setSegments((prev) => [...prev.filter((segment) => segment.wallScopeId !== wallScopeId), ...reordered])
  }

  const deleteSegment = (wallScopeId: string, segmentId: string) => {
    setSegments((prev) => {
      const remaining = sortByPosition(
        prev.filter((segment) => !(segment.wallScopeId === wallScopeId && segment.id === segmentId))
      )
      const roomSegments = remaining.filter((segment) => segment.wallScopeId === wallScopeId).map((segment, idx) => ({
        ...segment,
        position: idx,
      }))
      return [...remaining.filter((segment) => segment.wallScopeId !== wallScopeId), ...roomSegments]
    })
  }

  const toggleRoomWallInclude = (roomId: string) => {
    const roomScopes = sortByPosition(scopes.filter((scope) => scope.roomId === roomId))
    if (roomScopes.length === 0) {
      const nextScope = createDefaultScope(roomId, 'RECT', jobSettingsDraft.wallPaintProductId)
      nextScope.include = 'Y'
      setScopes((prev) => [...prev, nextScope])
      setOpenWallsSection((prev) => ({ ...prev, [roomId]: true }))
      return
    }
    const nextInclude: 'Y' | 'N' = roomScopes.some((scope) => scope.include === 'Y') ? 'N' : 'Y'
    const roomScopeIds = new Set(roomScopes.map((scope) => scope.id))
    setScopes((prev) =>
      prev.map((scope) =>
        roomScopeIds.has(scope.id)
          ? { ...scope, include: nextInclude }
          : scope
      )
    )
  }

  const updateCeilingScope = (scopeId: string, patch: Partial<CeilingScopeDraft>) => {
    setCeilingScopes((prev) => prev.map((scope) => (scope.id === scopeId ? { ...scope, ...patch } : scope)))
  }

  const toggleRoomCeilingInclude = (roomId: string) => {
    const roomScopes = sortByPosition(ceilingScopes.filter((scope) => scope.roomId === roomId))
    if (roomScopes.length === 0) {
      const nextScope = createDefaultCeilingScope(roomId, 'RECT')
      nextScope.include = 'Y'
      setCeilingScopes((prev) => [...prev, nextScope])
      setOpenCeilingSection((prev) => ({ ...prev, [roomId]: true }))
      return
    }

    const nextInclude: 'Y' | 'N' = roomScopes.some((scope) => scope.include === 'Y') ? 'N' : 'Y'
    const roomScopeIds = new Set(roomScopes.map((scope) => scope.id))
    setCeilingScopes((prev) =>
      prev.map((scope) =>
        roomScopeIds.has(scope.id)
          ? { ...scope, include: nextInclude }
          : scope
      )
    )
  }

  const addCeilingScope = (roomId: string) => {
    const roomScopes = sortByPosition(ceilingScopes.filter((s) => s.roomId === roomId))
    const nextScope = createDefaultCeilingScope(roomId, 'SEG')
    nextScope.position = roomScopes.length
    setCeilingScopes((prev) => [...prev, nextScope])
  }

  const deleteCeilingScope = (roomId: string, scopeId: string) => {
    const ok = window.confirm('Delete this ceiling scope and all of its segments?')
    if (!ok) return
    setCeilingScopes((prev) => {
      const roomScopes = sortByPosition(
        prev.filter((s) => s.roomId === roomId && s.id !== scopeId)
      ).map((s, idx) => ({ ...s, position: idx }))
      return [...prev.filter((s) => s.roomId !== roomId && s.id !== scopeId), ...roomScopes]
    })
    setCeilingSegments((prev) => prev.filter((seg) => seg.ceilingScopeId !== scopeId))
  }

  const moveCeilingScope = (roomId: string, scopeId: string, direction: -1 | 1) => {
    const roomScopes = sortByPosition(ceilingScopes.filter((s) => s.roomId === roomId))
    const index = roomScopes.findIndex((s) => s.id === scopeId)
    if (index === -1) return
    const reordered = moveItem(roomScopes, index, index + direction).map((s, idx) => ({ ...s, position: idx }))
    setCeilingScopes((prev) => [...prev.filter((s) => s.roomId !== roomId), ...reordered])
  }

  const switchRoomCeilingMode = (roomId: string, nextMode: CeilingScopeMode) => {
    const roomCeilingScopes = sortByPosition(ceilingScopes.filter((s) => s.roomId === roomId))
    const currentMode = roomCeilingScopes[0]?.mode ?? null

    if (roomCeilingScopes.length === 0) {
      setCeilingScopes((prev) => [...prev, createDefaultCeilingScope(roomId, nextMode)])
      return
    }
    if (currentMode === nextMode) return

    if (currentMode === 'RECT' && nextMode === 'SEG') {
      setCeilingScopes((prev) =>
        prev.map((s) =>
          s.id === roomCeilingScopes[0].id ? { ...s, mode: 'SEG', lengthIn: '', widthIn: '', areaSf: '', position: 0 } : s
        )
      )
      return
    }

    const confirmed = window.confirm('Switch to RECT? This will reset all SEG ceiling scopes and segments.')
    if (!confirmed) return
    const freshScope = createDefaultCeilingScope(roomId, 'RECT')
    const roomScopeIds = new Set(roomCeilingScopes.map((s) => s.id))
    setCeilingScopes((prev) => [...prev.filter((s) => s.roomId !== roomId), freshScope])
    setCeilingSegments((prev) => prev.filter((seg) => !roomScopeIds.has(seg.ceilingScopeId)))
  }

  const addCeilingSegment = (roomId: string, ceilingScopeId: string) => {
    const scopeSegments = sortByPosition(ceilingSegments.filter((seg) => seg.ceilingScopeId === ceilingScopeId))
    const nextSeg = createDefaultCeilingSegment(roomId, ceilingScopeId)
    nextSeg.position = scopeSegments.length
    setCeilingSegments((prev) => [...prev, nextSeg])
  }

  const deleteCeilingSegment = (ceilingScopeId: string, segmentId: string) => {
    setCeilingSegments((prev) => {
      const remaining = sortByPosition(prev.filter((seg) => !(seg.ceilingScopeId === ceilingScopeId && seg.id === segmentId)))
      const scopeSegs = remaining.filter((seg) => seg.ceilingScopeId === ceilingScopeId).map((seg, idx) => ({ ...seg, position: idx }))
      return [...remaining.filter((seg) => seg.ceilingScopeId !== ceilingScopeId), ...scopeSegs]
    })
  }

  const moveCeilingSegment = (ceilingScopeId: string, segmentId: string, direction: -1 | 1) => {
    const scopeSegs = sortByPosition(ceilingSegments.filter((seg) => seg.ceilingScopeId === ceilingScopeId))
    const index = scopeSegs.findIndex((seg) => seg.id === segmentId)
    if (index === -1) return
    const reordered = moveItem(scopeSegs, index, index + direction).map((seg, idx) => ({ ...seg, position: idx }))
    setCeilingSegments((prev) => [...prev.filter((seg) => seg.ceilingScopeId !== ceilingScopeId), ...reordered])
  }

  const updateCeilingSegment = (segmentId: string, patch: Partial<CeilingSegmentDraft>) => {
    setCeilingSegments((prev) => prev.map((seg) => (seg.id === segmentId ? { ...seg, ...patch } : seg)))
  }

  const updateTrimScope = (scopeId: string, patch: Partial<TrimScopeDraft>) => {
    setTrimScopes((prev) => prev.map((scope) => (scope.id === scopeId ? { ...scope, ...patch } : scope)))
  }

  const addTrimScope = (roomId: string) => {
    const roomScopes = sortByPosition(trimScopes.filter((scope) => scope.roomId === roomId))
    const nextScope = createDefaultTrimScope(roomId)
    nextScope.position = roomScopes.length
    setTrimScopes((prev) => [...prev, nextScope])
  }

  const moveTrimScope = (roomId: string, scopeId: string, direction: -1 | 1) => {
    const roomScopes = sortByPosition(trimScopes.filter((scope) => scope.roomId === roomId))
    const index = roomScopes.findIndex((scope) => scope.id === scopeId)
    if (index === -1) return
    const reordered = moveItem(roomScopes, index, index + direction).map((scope, idx) => ({
      ...scope,
      position: idx,
    }))
    setTrimScopes((prev) => [...prev.filter((scope) => scope.roomId !== roomId), ...reordered])
  }

  const deleteTrimScope = (roomId: string, scopeId: string) => {
    const ok = window.confirm('Delete this trim item?')
    if (!ok) return
    setTrimScopes((prev) => {
      const remaining = prev.filter((scope) => !(scope.roomId === roomId && scope.id === scopeId))
      const roomScopes = sortByPosition(remaining.filter((scope) => scope.roomId === roomId)).map((scope, idx) => ({
        ...scope,
        position: idx,
      }))
      return [...remaining.filter((scope) => scope.roomId !== roomId), ...roomScopes]
    })
  }

  const toggleRoomTrimInclude = (roomId: string) => {
    const roomScopes = sortByPosition(trimScopes.filter((scope) => scope.roomId === roomId))
    if (roomScopes.length === 0) {
      const nextScope = createDefaultTrimScope(roomId)
      nextScope.include = 'Y'
      setTrimScopes((prev) => [...prev, nextScope])
      return
    }
    const hasIncluded = roomScopes.some((scope) => scope.include === 'Y')
    setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.roomId === roomId ? { ...scope, include: hasIncluded ? 'N' : 'Y' } : scope
      )
    )
  }

  const updateTrimType = (scopeId: string, trimTypeId: string) => {
    const trimType = catalogs.trim_items.find((item) => item.id === trimTypeId)
    setTrimScopes((prev) =>
      prev.map((scope) => {
        if (scope.id !== scopeId) return scope
        const roomMode = roomModeById.get(scope.roomId) ?? 'RECT'
        const helperAllowed = !!trimType?.helper_allowed && roomMode === 'RECT'
        const keepHelperMode = helperAllowed && scope.measurementMode === 'ROOM_HELPER'
        return {
          ...scope,
          trimTypeId,
          trimFamily: (trimType?.family ?? scope.trimFamily ?? '').toUpperCase(),
          unitType: (trimType?.unit_type ?? scope.unitType ?? 'LF') as TrimUnitType,
          productionRateId: trimType?.default_production_rate_id ?? scope.productionRateId,
          measurementMode: keepHelperMode ? 'ROOM_HELPER' : 'MANUAL',
          helperSource: keepHelperMode ? 'ROOM_PERIMETER' : '',
        }
      })
    )
  }

  const save = useCallback(async (trigger: 'manual' | 'auto' = 'manual'): Promise<boolean> => {
    if (!estimateId || saving) return false
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    const sanitized = sanitizeV2WallsDrafts({
      rooms,
      scopes,
      segments,
    })
    const scopeRowsForSave = sanitized.scopes
    const segmentRowsForSave = sanitized.segments
    const sanitizedCeilings = sanitizeV2CeilingsDrafts({
      rooms: rooms.map((r) => ({ roomId: r.roomId, lengthIn: r.lengthIn, widthIn: r.widthIn, position: r.position })),
      ceilingScopes,
      ceilingSegments,
    })
    const ceilingScopesForSave = sanitizedCeilings.ceilingScopes
    const ceilingSegmentsForSave = sanitizedCeilings.ceilingSegments
    if (sanitizedCeilings.changed) {
      setCeilingScopes(ceilingScopesForSave)
      setCeilingSegments(ceilingSegmentsForSave)
    }
    const saveRoomModeById = resolveRoomModeById({
      rooms,
      wallScopes: scopeRowsForSave,
      ceilingScopes: ceilingScopesForSave,
    })
    const sanitizedTrim = sanitizeV2TrimDrafts({
      rooms: rooms.map((room) => ({
        roomId: room.roomId,
        mode: saveRoomModeById.get(room.roomId) ?? 'RECT',
        position: room.position,
      })),
      trimScopes,
    })
    const trimScopesForSave = sanitizedTrim.trimScopes
    if (sanitizedTrim.changed) {
      setTrimScopes(trimScopesForSave)
    }
    const payloadForSave = buildSavePayload(
      rooms,
      scopeRowsForSave,
      segmentRowsForSave,
      roomFlags,
      ceilingScopesForSave,
      ceilingSegmentsForSave,
      trimScopesForSave
    )

    if (sanitized.changed) {
      setScopes(scopeRowsForSave)
      setSegments(segmentRowsForSave)
    }

    const wallIssues = validateV2WallsBeforeSave({
      rooms,
      scopes: scopeRowsForSave,
      segments: segmentRowsForSave,
    })
    const ceilingIssues = validateV2CeilingsBeforeSave({
      rooms: rooms.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        position: room.position,
      })),
      ceilingScopes: ceilingScopesForSave,
      ceilingSegments: ceilingSegmentsForSave,
    })
    const trimIssues = validateV2TrimBeforeSave({
      rooms: rooms.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        mode: saveRoomModeById.get(room.roomId) ?? 'RECT',
        position: room.position,
      })),
      trimScopes: trimScopesForSave.map((scope) => ({
        id: scope.id,
        roomId: scope.roomId,
        position: scope.position,
        include: scope.include,
        trimTypeId: scope.trimTypeId,
        measurementMode: scope.measurementMode,
        helperSource: scope.helperSource || null,
        measurementValue: scope.measurementValue,
      })),
    })
    const issues = [...wallIssues, ...ceilingIssues, ...trimIssues]
    if (issues.length > 0) {
      if (trigger === 'manual') {
        setValidationIssues(issues)
        setError(issues[0])
        setSaveStatus('error')
      } else {
        setSaveStatus('blocked')
        setAutoSaveHint(issues[0])
      }
      return false
    }
    setValidationIssues([])
    setAutoSaveHint(null)

    setSaving(true)
    const requestId = saveRequestTrackerRef.current.start()
    if (trigger === 'manual') {
      setError(null)
      setSaveStatus('idle')
    } else {
      setSaveStatus('autosaving')
    }
    const response = await authedFetch(`/api/estimates/${estimateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      ...(trigger === 'auto' ? { 'X-Estimate-Save-Mode': 'auto' } : {}),
      body: JSON.stringify(payloadForSave),
    })
    const payload = await response.json().catch(() => null)
    setSaving(false)

    if (!saveRequestTrackerRef.current.isLatest(requestId)) {
      setLastSavedSnapshot('')
      return false
    }

    if (!response.ok) {
      setError(payload?.error ?? response.statusText)
      setSaveStatus('error')
      return false
    }

    const hasWallCalculations =
      payload != null && typeof payload === 'object' && 'wall_calculations' in payload
    const nextWallCalculations = hasWallCalculations
      ? ((payload as { wall_calculations?: WallCalculationsPayload }).wall_calculations ?? null)
      : wallCalculations

    let nextScopes = scopeRowsForSave
    let nextSegments = segmentRowsForSave
    if (trigger === 'manual') {
      if (nextWallCalculations?.scopes) {
        nextScopes = sortByPosition(nextWallCalculations.scopes.map(normalizeScope))
        setScopes(nextScopes)
      }
      if (nextWallCalculations?.segments) {
        nextSegments = sortByPosition(nextWallCalculations.segments.map(normalizeSegment))
        setSegments(nextSegments)
      }
    }
    setWallCalculations(nextWallCalculations)

    const nextCeilingCalc =
      payload != null && typeof payload === 'object' && 'ceiling_calculations' in payload
        ? ((payload as { ceiling_calculations?: Unsafe }).ceiling_calculations ?? null)
        : ceilingCalculations
    let nextCeilingScopes = ceilingScopesForSave
    let nextCeilingSegments = ceilingSegmentsForSave
    if (trigger === 'manual') {
      if (nextCeilingCalc && Array.isArray((nextCeilingCalc as Unsafe).scopes)) {
        nextCeilingScopes = sortByPosition(((nextCeilingCalc as Unsafe).scopes as Unsafe[]).map(normalizeCeilingScope))
        setCeilingScopes(nextCeilingScopes)
      }
      if (nextCeilingCalc && Array.isArray((nextCeilingCalc as Unsafe).segments)) {
        nextCeilingSegments = sortByPosition(((nextCeilingCalc as Unsafe).segments as Unsafe[]).map(normalizeCeilingSegment))
        setCeilingSegments(nextCeilingSegments)
      }
    }
    setCeilingCalculations(nextCeilingCalc)

    const nextTrimCalc =
      payload != null && typeof payload === 'object' && 'trim_calculations' in payload
        ? ((payload as { trim_calculations?: Unsafe }).trim_calculations ?? null)
        : trimCalculations
    let nextTrimScopes = trimScopesForSave
    if (trigger === 'manual' && nextTrimCalc && Array.isArray((nextTrimCalc as Unsafe).scopes)) {
      nextTrimScopes = sortByPosition(((nextTrimCalc as Unsafe).scopes as Unsafe[]).map(normalizeTrimScope))
      setTrimScopes(nextTrimScopes)
    }
    setTrimCalculations(nextTrimCalc)

    setEstimate((prev) => (prev ? { ...prev, updated_at: new Date().toISOString() } : prev))
    setLastSavedSnapshot(
      JSON.stringify(
        buildSavePayload(rooms, nextScopes, nextSegments, roomFlags, nextCeilingScopes, nextCeilingSegments, nextTrimScopes)
      )
    )
    setSaveStatus('saved')
    return true
  }, [estimateId, ceilingCalculations, ceilingScopes, ceilingSegments, roomFlags, rooms, saving, scopes, segments, trimCalculations, trimScopes, wallCalculations])

  useEffect(() => {
    saveRef.current = async (trigger) => { await save(trigger) }
  }, [save])

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    if (!shouldQueueAutosave({ loading, saving, dirty })) return

    autoSaveTimerRef.current = setTimeout(() => {
      void saveRef.current('auto')
    }, AUTO_SAVE_DELAY_MS)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [currentSnapshot, dirty, loading, saving])

  const allPaintProducts = catalogs.paint_products.filter((product) => product.type.toLowerCase() !== 'primer')
  const allPrimerProducts = catalogs.paint_products.filter((product) => product.type.toLowerCase().includes('primer'))
  
  const paintOptions = allPaintProducts
  const wallPaintOptions = allPaintProducts.filter((p) => !p.scopes || p.scopes.length === 0 || p.scopes.includes('Walls'))
  const ceilingPaintOptions = allPaintProducts.filter((p) => !p.scopes || p.scopes.length === 0 || p.scopes.includes('Ceilings'))
  const trimPaintOptions = allPaintProducts.filter((p) => !p.scopes || p.scopes.length === 0 || p.scopes.includes('Trim'))
  const roomTypeOptions = useMemo(() => {
    if (catalogs.room_types.length > 0) return catalogs.room_types
    if (selectedRoom?.roomTypeId) {
      return [{ id: selectedRoom.roomTypeId, label: selectedRoom.roomTypeId }]
    }
    return []
  }, [catalogs.room_types, selectedRoom?.roomTypeId])
  
  const primerOptions = allPrimerProducts
  const wallPrimerOptions = allPrimerProducts.filter((p) => !p.scopes || p.scopes.length === 0 || p.scopes.includes('Walls'))
  const ceilingPrimerOptions = allPrimerProducts.filter((p) => !p.scopes || p.scopes.length === 0 || p.scopes.includes('Ceilings'))
  const trimPrimerOptions = allPrimerProducts.filter((p) => !p.scopes || p.scopes.length === 0 || p.scopes.includes('Trim'))

  const [openWallsSection, setOpenWallsSection] = useState<Record<string, boolean>>({})
  const [openAdvanced, setOpenAdvanced] = useState<Record<string, boolean>>({})
  const [openCeilingSection, setOpenCeilingSection] = useState<Record<string, boolean>>({})
  const [openCeilingAdvanced, setOpenCeilingAdvanced] = useState<Record<string, boolean>>({})
  const [openTrimSection, setOpenTrimSection] = useState<Record<string, boolean>>({})

  const toggleFlag = (roomId: string, flagId: string) => {
    setRoomFlags((prev) => {
      const exists = prev.find((f) => f.roomId === roomId && f.flagId === flagId)
      if (exists) return prev.filter((f) => !(f.roomId === roomId && f.flagId === flagId))
      const nextPosition =
        prev
          .filter((flag) => flag.roomId === roomId)
          .reduce((maxPos, flag) => Math.max(maxPos, flag.position), -1) + 1
      return [...prev, { id: createUuid(), roomId, flagId, position: nextPosition }]
    })
  }

  const handleRoomDimChange = (roomId: string, field: 'lengthIn' | 'widthIn' | 'heightIn', value: string) => {
    updateRoom(roomId, { [field]: value })
    const room = rooms.find((r) => r.roomId === roomId)
    if (!room) return
    const merged = { ...room, [field]: value }
    const L = numberOrNull(merged.lengthIn)
    const W = numberOrNull(merged.widthIn)
    const roomScopes = sortByPosition(scopes.filter((s) => s.roomId === roomId))
    const firstRectScope = roomScopes.find((s) => s.mode === 'RECT')
    if (!firstRectScope) return
    const updates: Partial<WallScopeDraft> = {}
    if (L != null && W != null) updates.perimeterIn = String(2 * (L + W))
    if (field === 'heightIn') updates.heightIn = value
    if (Object.keys(updates).length > 0) updateScope(firstRectScope.id, updates)
  }

  const totalEffectiveAreaSqFt = useMemo(() => {
    return rooms.reduce((sum, room) => sum + (displayedRoomEffectiveAreaByRoomId.get(room.roomId) ?? 0), 0)
  }, [displayedRoomEffectiveAreaByRoomId, rooms])

  const selectedRoomEffectiveSqFt = useMemo(() => {
    if (!selectedRoom) return null
    return displayedRoomEffectiveAreaByRoomId.get(selectedRoom.roomId) ?? null
  }, [displayedRoomEffectiveAreaByRoomId, selectedRoom])

  const selectedScopeEffectiveSqFt = useMemo(() => {
    if (!firstScope) return null
    return displayedScopeEffectiveAreaById.get(firstScope.id) ?? null
  }, [displayedScopeEffectiveAreaById, firstScope])

  const activeRoomFlagCount = useMemo(() => {
    if (!selectedRoom) return 0
    return roomFlags.filter((flag) => flag.roomId === selectedRoom.roomId).length
  }, [roomFlags, selectedRoom])

  const selectedRoomIssueCount = useMemo(() => {
    if (!selectedRoom) return 0
    return validationIssues.filter((issue) => issue.startsWith(`${selectedRoom.roomId}:`)).length
  }, [selectedRoom, validationIssues])
  const wallsRowExpanded = selectedRoom ? (openWallsSection[selectedRoom.roomId] ?? true) : false
  const ceilingsRowExpanded = selectedRoom ? (openCeilingSection[selectedRoom.roomId] ?? true) : false
  const trimsRowExpanded = selectedRoom ? (openTrimSection[selectedRoom.roomId] ?? true) : false
  const wallPaintLabel = firstScope?.paintProductId
    ? paintOptions.find((opt) => opt.id === firstScope.paintProductId)?.label ?? 'Custom'
    : jobSettingsDraft.wallPaintProductId
      ? paintOptions.find((opt) => opt.id === jobSettingsDraft.wallPaintProductId)?.label ??
        jobSettingsDraft.wallPaintProductId
      : 'Job default'
  const ceilingPaintLabel = firstCeilingScope?.paintProductId
    ? paintOptions.find((opt) => opt.id === firstCeilingScope.paintProductId)?.label ?? 'Custom'
    : 'Job default'
  const selectedTrimSubtotal = useMemo(() => {
    let total = 0
    let hasValues = false
    for (const scope of selectedRoomTrimScopes) {
      if (scope.include !== 'Y') continue
      const value = trimScopeEffectiveTotalById.get(scope.id)
      if (value == null) continue
      hasValues = true
      total += value
    }
    return hasValues ? Math.round(total * 100) / 100 : null
  }, [selectedRoomTrimScopes, trimScopeEffectiveTotalById])
  const selectedTrimMeasurement = useMemo(() => {
    let total = 0
    let hasValues = false
    for (const scope of selectedRoomTrimScopes) {
      if (scope.include !== 'Y') continue
      const value = trimScopeEffectiveMeasurementById.get(scope.id)
      if (value == null) continue
      hasValues = true
      total += value
    }
    return hasValues ? Math.round(total * 100) / 100 : null
  }, [selectedRoomTrimScopes, trimScopeEffectiveMeasurementById])

  const calculationsStale = dirty
  const saveStatusText = useMemo(() => {
    return getSaveStatusText({
      saving,
      saveStatus,
      dirty,
      autoSaveHint,
      error,
      updatedAt: estimate?.updated_at ?? null,
      formatDateTime,
    })
  }, [autoSaveHint, dirty, error, estimate?.updated_at, saveStatus, saving])
  const saveStatusColor =
    saveStatus === 'error'
      ? '#fecaca'
      : dirty || saveStatus === 'blocked'
        ? '#f9e2b7'
        : 'var(--v2-ink-3)'

  const saveCustomerDebounced = useCallback((draft: CustomerDraft) => {
    if (customerSaveTimerRef.current) clearTimeout(customerSaveTimerRef.current)
    customerSaveTimerRef.current = setTimeout(async () => {
      if (!draft.customerId) return
      await authedFetch(`/api/customers/${draft.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name || 'Unknown',
          email: draft.email || null,
          phone: draft.phone || null,
          address: draft.address || null,
        }),
      })
    }, 900)
  }, [])

  const savePolicyDebounced = useCallback((draft: JobSettingsDraft) => {
    if (policySaveTimerRef.current) clearTimeout(policySaveTimerRef.current)
    policySaveTimerRef.current = setTimeout(async () => {
      if (!estimateId) return
          await authedFetch(`/api/estimates/${estimateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobsettings: {
            labor_day_policy_enabled: draft.laborDayEnabled,
            dayhours: draft.dayhours,
            rounding_increment_hours: draft.roundingIncrementHours,
            override_labor_rate: draft.laborRate,
            job_minimum_enabled: draft.jobMinEnabled,
            job_minimum_amount: draft.jobMinAmount,
            walls_paint_id: draft.wallPaintProductId || null,
          },
        }),
      })
    }, 900)
  }, [estimateId])

  return (
    <div className="ace-v2-shell" style={S.page}>
      {/* WIZARD HEADER */}
      <div style={S.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href="/crm/estimates/v2"
              onClick={(event) => {
                if (!confirmNavigation()) event.preventDefault()
              }}
              style={{ ...S.button, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 'calc(13px + 4pt)' }}
            >
              {'<- Back'}
            </Link>
            <span style={S.mono}>Walls-first wizard - Rooms</span>
            {dirty && <span style={{ ...S.mono, color: '#f9e2b7' }}>- unsaved - live preview</span>}
          </div>
          <div style={{ fontSize: 'calc(26px + 4pt)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {estimate?.version_name ?? 'Estimate Version'}
          </div>
          <div style={{ color: 'var(--v2-ink-3)', fontSize: 'calc(13px + 4pt)', lineHeight: 1.5 }}>
            {job?.title ?? ''}{job?.customer_name ? ` - ${job.customer_name}` : ''}{job?.customer_address ? ` - ${job.customer_address}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="v2-btn"
            onClick={() => setSettingsOpen((o) => !o)}
            style={{ ...S.button, fontSize: 'calc(11px + 4pt)' }}
            title="Estimate settings"
          >
            ⚙ Settings
          </button>
          {estimateId && (
            <Link
              href={`/crm/estimates/${estimateId}/v2/summary`}
              style={{ ...S.button, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 'calc(11px + 4pt)' }}
            >
              Summary →
            </Link>
          )}
          <button type="button" className="v2-btn" style={{ ...S.button, opacity: 0.5, cursor: 'not-allowed' }} disabled>
            Recalculate
          </button>
          <button type="button" className="v2-btn" style={S.button} onClick={addRoom}>
            + Add room
          </button>
          <button
            type="button"
            className="v2-btn-primary"
            onClick={() => void save().then((ok) => { if (ok && estimateId) router.push(`/crm/estimates/${estimateId}/v2/summary`) })}
            disabled={saving}
            style={{ ...S.buttonPrimary, opacity: saving ? 0.65 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving...' : 'Next: Summary ->'}
          </button>
        </div>
      </div>

      <div style={S.shell} className="ace-v2-rooms-layout walls-v2-shell">
        {/* SIDEBAR */}
        <aside style={{ ...S.panel, alignSelf: 'start', position: 'sticky', top: 80, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={S.mono}>Rooms</span>
            <span style={{ ...S.mono, color: 'var(--v2-green-2)' }}>{rooms.length}</span>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {rooms.length === 0 && (
              <div style={{ color: 'var(--v2-ink-3)', fontSize: 'calc(13px + 4pt)', lineHeight: 1.6 }}>
                No rooms yet - add the first one.
              </div>
            )}
            {sortByPosition(rooms).map((room) => {
              const active = room.roomId === selectedRoomId
              const roomScopes = roomScopeByRoomId.get(room.roomId) ?? []
              const firstScopeForRoom = roomScopes[0]
              const areaSf = displayedRoomEffectiveAreaByRoomId.get(room.roomId) ?? null
              const L = numberOrNull(room.lengthIn)
              const W = numberOrNull(room.widthIn)
              const H = numberOrNull(room.heightIn)
              const dimStr = L && W && H ? `${Math.round(L / 12)}x${Math.round(W / 12)}x${Math.round(H / 12)}` : null
              const coats = Math.max(1, Math.round(numberOrNull(firstScopeForRoom?.paintCoats ?? '') ?? 2))
              return (
                <button
                  key={room.id}
                  type="button"
                  className="room-card"
                  onClick={() => setSelectedRoomId(room.roomId)}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${active ? 'rgba(134,239,172,0.32)' : 'var(--v2-line)'}`,
                    background: active ? 'rgba(74,222,128,0.07)' : '#0d0d0d',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'grid',
                    gap: 5,
                    width: '100%',
                    color: 'var(--v2-ink)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 'calc(13px + 4pt)', fontWeight: 700 }}>{room.roomName || '(unnamed)'}</div>
                      <div style={{ ...S.mono, marginTop: 3 }}>{room.roomId}</div>
                    </div>
                    {areaSf != null && (
                      <div style={{ fontSize: 'calc(12px + 4pt)', fontWeight: 700, color: 'var(--v2-green-2)', whiteSpace: 'nowrap' }}>
                        {toDisplayNumber(areaSf)} sf
                      </div>
                    )}
                  </div>
                  {dimStr && (
                    <div style={{ ...S.mono, color: 'var(--v2-ink-3)' }}>
                      {dimStr} - {coats} coat{coats !== 1 ? 's' : ''}
                    </div>
                  )}
                </button>
              )
            })}

            <button
              type="button"
              className="add-room-card"
              onClick={addRoom}
              style={{
                borderRadius: 14,
                border: '1px dashed var(--v2-line-2)',
                background: 'transparent',
                padding: '10px 12px',
                cursor: 'pointer',
                color: 'var(--v2-ink-3)',
                fontSize: 'calc(13px + 4pt)',
                fontWeight: 600,
                textAlign: 'center',
                width: '100%',
              }}
            >
              + Add room
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ display: 'grid', gap: 14, paddingBottom: 88 }}>
          {error && (
            <div style={{ ...S.panel, borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
              {error}
            </div>
          )}

          {validationIssues.length > 1 && (
            <div style={S.panel}>
              <div style={S.mono}>Validation</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {validationIssues.map((issue) => (
                  <div key={issue} style={{ color: '#f9e2b7', fontSize: 'calc(14px + 4pt)' }}>
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && <div style={S.panel}>Loading workspace...</div>}

          {!loading && !selectedRoom && (
            <div style={S.panel}>
              <div style={{ fontSize: 'calc(16px + 4pt)', color: 'var(--v2-ink-3)' }}>
                Add a room or select one from the roster to start editing walls.
              </div>
            </div>
          )}

          {!loading && selectedRoom && (
            <div className="room-workspace">
              <div className="room-main-col">
                {/* Room Header / Setup */}
                <RoomHeaderSetup>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={S.mono}>Room Setup</div>
                      <h2 style={{ fontSize: 'calc(18px + 4pt)', fontWeight: 800, letterSpacing: '-0.02em', margin: '3px 0 0' }}>
                        {selectedRoom.roomId} - {selectedRoom.roomName || 'New room'}
                      </h2>
                    </div>
                    {selectedRoom.roomTypeId && (
                      <span style={{ ...S.mono, border: '1px solid var(--v2-line)', borderRadius: 8, padding: '3px 8px' }}>
                        template: {roomTypeOptions.find((t) => t.id === selectedRoom.roomTypeId)?.label ?? selectedRoom.roomTypeId}
                      </span>
                    )}
                  </div>

                  <div className="room-setup-grid">
                    <Field label="Room Name">
                      <input
                        value={selectedRoom.roomName}
                        onChange={(event) => updateRoom(selectedRoom.roomId, { roomName: event.target.value })}
                        style={S.input}
                        placeholder="e.g. Main Suite"
                      />
                    </Field>
                    <Field label="Room Type">
                      <select
                        value={selectedRoom.roomTypeId}
                        onChange={(event) => updateRoom(selectedRoom.roomId, { roomTypeId: event.target.value })}
                        style={S.input}
                      >
                        {roomTypeOptions.length === 0 ? (
                          <option value="">Room type catalog unavailable</option>
                        ) : (
                          <option value="">-- select type --</option>
                        )}
                        {roomTypeOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </Field>
                    <div className="room-setup-actions">
                      <button
                        type="button"
                        onClick={() => deleteRoom(selectedRoom.roomId)}
                        style={{ ...S.button, color: 'var(--v2-red)', background: 'transparent', borderColor: 'rgba(248,113,113,0.24)' }}
                      >
                        Remove room
                      </button>
                    </div>
                  </div>

                  <div className="geometry-primary-grid">
                    <Field label="Length (in)">
                      <input value={selectedRoom.lengthIn} onChange={(e) => handleRoomDimChange(selectedRoom.roomId, 'lengthIn', e.target.value)} style={S.input} placeholder="0" type="number" min="0" />
                    </Field>
                    <Field label="Width (in)">
                      <input value={selectedRoom.widthIn} onChange={(e) => handleRoomDimChange(selectedRoom.roomId, 'widthIn', e.target.value)} style={S.input} placeholder="0" type="number" min="0" />
                    </Field>
                    <Field label="Height (in)">
                      <input value={selectedRoom.heightIn} onChange={(e) => handleRoomDimChange(selectedRoom.roomId, 'heightIn', e.target.value)} style={S.input} placeholder="0" type="number" min="0" />
                    </Field>
                    <div className={selectedRoomEffectiveSqFt != null ? 'walksqft-box' : 'walksqft-box-empty'}>
                      <div style={S.mono}>Wall Sq Ft</div>
                      <div style={{ ...S.computedBig, color: selectedRoomEffectiveSqFt != null ? 'var(--v2-green-2)' : 'var(--v2-ink-3)' }}>{toDisplayNumber(selectedRoomEffectiveSqFt)}</div>
                    </div>
                  </div>

                  {(wallsIncluded || ceilingsIncluded || trimsIncluded) && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      {wallsIncluded && firstScope && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                          <div style={S.mono}>Walls Paint</div>
                          <select value={firstScope.paintProductId} onChange={(e) => updateScope(firstScope.id, { paintProductId: e.target.value })} style={S.input}>
                            <option value="">-- Job default --</option>
                            {wallPaintOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                        </div>
                      )}
                      {ceilingsIncluded && firstCeilingScope && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                          <div style={S.mono}>Ceilings Paint</div>
                          <select value={firstCeilingScope.paintProductId} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { paintProductId: e.target.value })} style={S.input}>
                            <option value="">-- Job default --</option>
                            {ceilingPaintOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                        </div>
                      )}
                      {jobTrimsIncluded && trimsIncluded && selectedRoomTrimScopes[0] && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                          <div style={S.mono}>Trim Paint</div>
                          <select
                            value={selectedRoomTrimScopes.find((s) => s.include === 'Y')?.paintProductId ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              selectedRoomTrimScopes.filter((s) => s.include === 'Y').forEach((s) => updateTrimScope(s.id, { paintProductId: val }))
                            }}
                            style={S.input}
                          >
                            <option value="">-- Job default --</option>
                            {paintOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="scope-chip-row">
                    <button
                      type="button"
                      className={wallsIncluded ? 'scope-pill-active' : ''}
                      onClick={() => toggleRoomWallInclude(selectedRoom.roomId)}
                      style={{
                        ...S.scopePill,
                        cursor: 'pointer',
                        borderColor: wallsIncluded ? 'rgba(134,239,172,0.32)' : 'var(--v2-line)',
                        background: wallsIncluded ? 'rgba(74,222,128,0.08)' : 'transparent',
                        color: wallsIncluded ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
                      }}
                    >
                      Walls {wallsIncluded ? 'included' : 'excluded'}
                    </button>
                    <button
                      type="button"
                      className={ceilingsIncluded ? 'scope-pill-active' : ''}
                      onClick={() => toggleRoomCeilingInclude(selectedRoom.roomId)}
                      style={{
                        ...S.scopePill,
                        cursor: 'pointer',
                        borderColor: ceilingsIncluded ? 'rgba(134,239,172,0.32)' : 'var(--v2-line)',
                        background: ceilingsIncluded ? 'rgba(74,222,128,0.08)' : 'transparent',
                        color: ceilingsIncluded ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
                      }}
                    >
                      Ceilings {ceilingsIncluded ? 'included' : 'excluded'}
                    </button>
                    <button
                      type="button"
                      className={trimsIncluded ? 'scope-pill-active' : ''}
                      onClick={() => toggleRoomTrimInclude(selectedRoom.roomId)}
                      style={{
                        ...S.scopePill,
                        cursor: 'pointer',
                        borderColor: trimsIncluded ? 'rgba(134,239,172,0.32)' : 'var(--v2-line)',
                        background: trimsIncluded ? 'rgba(74,222,128,0.08)' : 'transparent',
                        color: trimsIncluded ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
                      }}
                    >
                      Trim {trimsIncluded ? 'included' : 'excluded'}
                    </button>
                    {['Doors', 'Drywall repair'].map((label) => (
                      <span key={label} style={{ ...S.scopePill, color: 'var(--v2-ink-3)', opacity: 0.62 }}>{label} soon</span>
                    ))}
                  </div>
                </RoomHeaderSetup>

                {catalogs.room_flags.length > 0 && (
                  <RoomLevelModifiers>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>Room-Level Modifiers</div>
                      <span style={{ ...S.mono, color: 'var(--v2-ink-3)' }}>room-wide defaults and conditions</span>
                    </div>
                    <div className="modifier-grid">
                      {catalogs.room_flags.map((flag) => {
                        const active = roomFlags.some((f) => f.roomId === selectedRoom.roomId && f.flagId === flag.id)
                        const multiplierHint =
                          flag.wall_factor != null && Number.isFinite(flag.wall_factor) && flag.wall_factor > 0
                            ? `x${flag.wall_factor}`
                            : getFlagMultiplierHint(flag.label)
                        return (
                          <button key={flag.id} type="button"
                            className={`flag-chip${active ? ' flag-chip-active' : ''}`}
                            onClick={() => toggleFlag(selectedRoom.roomId, flag.id)}
                            style={{ ...S.flagChip, borderColor: active ? 'rgba(134,239,172,0.4)' : 'var(--v2-line)', background: active ? 'rgba(74,222,128,0.1)' : '#0d0d0d', color: active ? 'var(--v2-ink)' : 'var(--v2-ink-2)' }}
                          >
                            <span style={{ fontWeight: active ? 600 : 500 }}>{flag.label}</span>
                            {(multiplierHint || active) && (
                              <span style={{ ...S.mono, color: active ? 'var(--v2-green-2)' : 'var(--v2-ink-3)', fontSize: 'calc(10px + 4pt)', whiteSpace: 'nowrap' }}>
                                {multiplierHint ?? 'on'}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </RoomLevelModifiers>
                )}

                <ScopeAccordionList>
                  {wallsIncluded && (
                    <ScopeAccordionRow
                      title="Walls"
                      expanded={wallsRowExpanded}
                      onToggle={() => setOpenWallsSection((prev) => ({ ...prev, [selectedRoom.roomId]: !wallsRowExpanded }))}
                      summary={
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>Mode: {selectedRoomMode}</span>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>Sq Ft: {toDisplayNumber(selectedRoomEffectiveSqFt)}</span>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>Paint: {wallPaintLabel}</span>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>Primer: {firstScope?.primeMode ?? 'NONE'}</span>
                          <span style={{ ...S.scopePill, color: selectedRoomIssueCount > 0 ? '#f9e2b7' : 'var(--v2-ink-2)' }}>
                            {selectedRoomIssueCount > 0 ? `${selectedRoomIssueCount} issue(s)` : 'Validated'}
                          </span>
                        </div>
                      }
                    >
                      <WallsScopePanel>
                        <Field label="Wall Mode">
                          <div style={{ display: 'flex', gap: 6 }}>
                            {(['RECT', 'SEG'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => switchRoomMode(selectedRoom.roomId, mode)}
                                style={{
                                  ...S.button,
                                  flex: 1,
                                  borderColor: selectedRoomMode === mode ? 'rgba(134,239,172,0.34)' : 'var(--v2-line)',
                                  background: selectedRoomMode === mode ? 'rgba(74,222,128,0.08)' : '#111111',
                                  color: selectedRoomMode === mode ? 'var(--v2-green-2)' : 'var(--v2-ink)',
                                }}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                        </Field>

              {/* Geometry */}
              <GeometryBlock>
                {selectedRoomMode === 'SEG' ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={S.mono}>SEG Mode Scopes</div>
                        <div style={{ fontSize: 'calc(16px + 4pt)', fontWeight: 700, marginTop: 6 }}>Segments</div>
                      </div>
                      <button type="button" style={S.button} onClick={() => addScope(selectedRoom.roomId)}>+ Add scope</button>
                    </div>
                    {selectedRoomScopes.map((scope, scopeIndex) => {
                      const scopeSegments = sortByPosition(segments.filter((seg) => seg.wallScopeId === scope.id))
                      const scopeEffectiveArea = displayedScopeEffectiveAreaById.get(scope.id) ?? null
                      return (
                        <div key={scope.id} style={{ border: '1px solid var(--v2-line)', borderRadius: 14, padding: 16, display: 'grid', gap: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <div style={S.mono}>Scope {scopeIndex + 1}</div>
                              <div style={{ fontSize: 'calc(16px + 4pt)', fontWeight: 700, marginTop: 4 }}>{scope.scopeName || 'SEG scope'} - {toDisplayNumber(scopeEffectiveArea)} sf</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button type="button" style={S.button} disabled={scopeIndex === 0} onClick={() => moveScope(selectedRoom.roomId, scope.id, -1)}>Up</button>
                              <button type="button" style={S.button} disabled={scopeIndex === selectedRoomScopes.length - 1} onClick={() => moveScope(selectedRoom.roomId, scope.id, 1)}>Down</button>
                              <button type="button" style={S.button} onClick={() => deleteScope(selectedRoom.roomId, scope.id)}>Delete</button>
                            </div>
                          </div>
                          <button type="button" style={S.button} onClick={() => addSegment(selectedRoom.roomId, scope.id)}>+ Add segment</button>
                          {scopeSegments.map((segment, segIdx) => {
                            const segmentEffectiveArea = displayedSegmentEffectiveAreaById.get(segment.id) ?? null
                            return (
                              <div key={segment.id} style={{ border: '1px solid var(--v2-line)', borderRadius: 12, padding: 14, background: '#111111', display: 'grid', gap: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                  <div>
                                    <div style={S.mono}>Segment {segIdx + 1}</div>
                                    <div style={{ fontWeight: 700, marginTop: 4 }}>{segment.segmentName || 'Unnamed'} - {toDisplayNumber(segmentEffectiveArea)} sf</div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button" style={S.button} disabled={segIdx === 0} onClick={() => moveSegment(scope.id, segment.id, -1)}>Up</button>
                                    <button type="button" style={S.button} disabled={segIdx === scopeSegments.length - 1} onClick={() => moveSegment(scope.id, segment.id, 1)}>Down</button>
                                    <button type="button" style={S.button} onClick={() => deleteSegment(scope.id, segment.id)}>Delete</button>
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }} className="walls-segment-grid">
                                  <Field label="Name"><input value={segment.segmentName} onChange={(e) => updateSegment(segment.id, { segmentName: e.target.value })} style={S.input} /></Field>
                                  <Field label="Include"><select value={segment.include} onChange={(e) => updateSegment(segment.id, { include: e.target.value as 'Y' | 'N' })} style={S.input}><option value="Y">Included</option><option value="N">Excluded</option></select></Field>
                                  <Field label="Shape"><select value={segment.shapeType} onChange={(e) => updateSegment(segment.id, { shapeType: e.target.value as WallSegmentShape })} style={S.input}><option value="RECTANGLE">Rectangle</option><option value="TRIANGLE">Triangle</option><option value="MANUAL">Manual</option></select></Field>
                                  <Field label="Qty"><input value={segment.quantity} onChange={(e) => updateSegment(segment.id, { quantity: e.target.value })} style={S.input} /></Field>
                                  <Field label="Width (in)"><input value={segment.widthIn} onChange={(e) => updateSegment(segment.id, { widthIn: e.target.value })} style={{ ...S.input, opacity: segment.shapeType === 'RECTANGLE' ? 1 : 0.5 }} disabled={segment.shapeType !== 'RECTANGLE'} /></Field>
                                  <Field label="Height (in)"><input value={segment.heightIn} onChange={(e) => updateSegment(segment.id, { heightIn: e.target.value })} style={{ ...S.input, opacity: segment.shapeType !== 'MANUAL' ? 1 : 0.5 }} disabled={segment.shapeType === 'MANUAL'} /></Field>
                                  <Field label="Base (in)"><input value={segment.baseIn} onChange={(e) => updateSegment(segment.id, { baseIn: e.target.value })} style={{ ...S.input, opacity: segment.shapeType === 'TRIANGLE' ? 1 : 0.5 }} disabled={segment.shapeType !== 'TRIANGLE'} /></Field>
                                  <Field label="Manual Area (sf)"><input value={segment.manualAreaSqFt} onChange={(e) => updateSegment(segment.id, { manualAreaSqFt: e.target.value })} style={{ ...S.input, opacity: segment.shapeType === 'MANUAL' ? 1 : 0.5 }} disabled={segment.shapeType !== 'MANUAL'} /></Field>
                                  <Field label="Doors"><input value={segment.standardDoorCount} onChange={(e) => updateSegment(segment.id, { standardDoorCount: e.target.value })} style={S.input} /></Field>
                                  <Field label="Windows"><input value={segment.standardWindowCount} onChange={(e) => updateSegment(segment.id, { standardWindowCount: e.target.value })} style={S.input} /></Field>
                                  <Field label="Area Override (sf)"><input value={segment.overrideAreaSqFt} onChange={(e) => updateSegment(segment.id, { overrideAreaSqFt: e.target.value })} style={S.input} /></Field>
                                </div>
                                <Field label="Notes"><textarea value={segment.notes} onChange={(e) => updateSegment(segment.id, { notes: e.target.value })} style={S.textarea} /></Field>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <>
                    {firstScope && (
                      <div className="geometry-secondary-grid">
                        <Field label="Doors">
                          <div style={S.stepper}>
                            <button type="button" className="stepper-btn" style={S.stepperBtn} onClick={() => updateScope(firstScope.id, { standardDoorCount: String(Math.max(0, (numberOrNull(firstScope.standardDoorCount) ?? 0) - 1)) })}>-</button>
                            <span style={S.stepperVal}>{firstScope.standardDoorCount || '0'}</span>
                            <button type="button" className="stepper-btn" style={S.stepperBtn} onClick={() => updateScope(firstScope.id, { standardDoorCount: String((numberOrNull(firstScope.standardDoorCount) ?? 0) + 1) })}>+</button>
                          </div>
                        </Field>
                        <Field label="Windows">
                          <div style={S.stepper}>
                            <button type="button" className="stepper-btn" style={S.stepperBtn} onClick={() => updateScope(firstScope.id, { standardWindowCount: String(Math.max(0, (numberOrNull(firstScope.standardWindowCount) ?? 0) - 1)) })}>-</button>
                            <span style={S.stepperVal}>{firstScope.standardWindowCount || '0'}</span>
                            <button type="button" className="stepper-btn" style={S.stepperBtn} onClick={() => updateScope(firstScope.id, { standardWindowCount: String((numberOrNull(firstScope.standardWindowCount) ?? 0) + 1) })}>+</button>
                          </div>
                        </Field>
                        <Field label="Coats">
                          <div style={{ display: 'flex', border: '1px solid var(--v2-line)', borderRadius: 9, overflow: 'hidden', height: 34 }}>
                            {[1, 2, 3].map((n) => {
                              const currentCoats = Math.max(1, Math.round(numberOrNull(firstScope.paintCoats) ?? 2))
                              const isActive = currentCoats === n
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => updateScope(firstScope.id, { paintCoats: String(n) })}
                                  style={{
                                    ...S.button,
                                    border: 'none',
                                    borderRadius: 0,
                                    borderRight: n < 3 ? '1px solid var(--v2-line)' : 'none',
                                    background: isActive ? 'rgba(74,222,128,0.12)' : 'transparent',
                                    color: isActive ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
                                    minWidth: 40,
                                    padding: '0 12px',
                                  }}
                                >
                                  {n}
                                </button>
                              )
                            })}
                          </div>
                        </Field>
                        <Field label="Height Factor">
                          <div style={{ ...S.input, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default', height: 34 }}>
                            <span>Standard</span>
                            <span style={{ ...S.mono, color: 'var(--v2-green-2)' }}>{firstScope.heightFactor ? `${firstScope.heightFactor}x` : '1.0x'}</span>
                          </div>
                        </Field>
                        <Field label="Wall Complexity">
                          <select value={selectedRoom.wallComplexityId} onChange={(e) => updateRoomComplexity(selectedRoom.roomId, e.target.value)} style={S.input}>
                            <option value="">Standard (1.0x)</option>
                            {catalogs.wall_complexity_types.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                        </Field>
                      </div>
                    )}
                  </>
                )}
              </GeometryBlock>

              {/* Paint Setup */}
              {firstScope && (
                <PaintSetup>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>Paint Setup</div>
                    <span style={{ ...S.mono, color: 'var(--v2-ink-3)' }}>from CAT_ProductionRates</span>
                  </div>
                  <div className="paint-setup-grid">
                    <Field label="Wall Condition / Rate">
                      <select value={selectedRoom.wallComplexityId} onChange={(e) => updateRoomComplexity(selectedRoom.roomId, e.target.value)} style={S.input}>
                        <option value="">Painted drywall - standard repaint</option>
                        {catalogs.wall_complexity_types.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Paint Override">
                      <select value={firstScope.paintProductId} onChange={(e) => updateScope(firstScope.id, { paintProductId: e.target.value })} style={S.input}>
                        <option value="">-- Use job default --</option>
                        {wallPaintOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Wall Color Slot">
                      <select value={firstScope.colorId} onChange={(e) => updateScope(firstScope.id, { colorId: e.target.value })} style={S.input}>
                        <option value="">-- select color --</option>
                        {catalogs.color_codes.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Primer Mode">
                    <div className="primer-mode-row">
                      {(['NONE', 'SPOT', 'FULL'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => updateScope(firstScope.id, { primeMode: mode })}
                          style={{ ...S.button, flex: 1, borderColor: firstScope.primeMode === mode ? 'rgba(134,239,172,0.34)' : 'var(--v2-line)', background: firstScope.primeMode === mode ? 'rgba(74,222,128,0.08)' : '#111111', color: firstScope.primeMode === mode ? 'var(--v2-green-2)' : 'var(--v2-ink)', minHeight: 32 }}
                        >
                          {mode === 'NONE' ? 'None' : mode === 'SPOT' ? 'Spot' : 'Full'}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {firstScope.primeMode === 'SPOT' && (
                    <Field label="Spot Primer %">
                      <input
                        value={firstScope.spotPrimePercent}
                        onChange={(e) => updateScope(firstScope.id, { spotPrimePercent: e.target.value })}
                        style={S.input}
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="0 - 100"
                      />
                    </Field>
                  )}
                </PaintSetup>
              )}

              {/* Advanced / Overrides */}
              <Advanced>
                <button type="button"
                  className="advanced-toggle"
                  onClick={() => setOpenAdvanced((prev) => ({ ...prev, [selectedRoom.roomId]: !prev[selectedRoom.roomId] }))}
                  style={{ background: 'none', border: 'none', color: 'var(--v2-ink-3)', fontSize: 'calc(12px + 4pt)', fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
                >
                  <span style={S.mono}>Advanced / Overrides</span>
                  <span style={{ fontSize: 'calc(10px + 4pt)' }}>{openAdvanced[selectedRoom.roomId] ? '^' : 'v'}</span>
                </button>
                {openAdvanced[selectedRoom.roomId] && firstScope && (
                  <div style={{ marginTop: 2, display: 'grid', gap: 10 }}>
                    <div className="advanced-grid">
                      <Field label="Include"><select value={firstScope.include} onChange={(e) => updateScope(firstScope.id, { include: e.target.value as 'Y' | 'N' })} style={S.input}><option value="Y">Included</option><option value="N">Excluded</option></select></Field>
                      <Field label="Scope Name"><input value={firstScope.scopeName} onChange={(e) => updateScope(firstScope.id, { scopeName: e.target.value })} style={S.input} /></Field>
                      <Field label="Height (in)"><input value={firstScope.heightIn} onChange={(e) => updateScope(firstScope.id, { heightIn: e.target.value })} style={S.input} /></Field>
                      <Field label="Perimeter (in)"><input value={firstScope.perimeterIn} onChange={(e) => updateScope(firstScope.id, { perimeterIn: e.target.value })} style={S.input} /></Field>
                      <Field label="Height Factor"><input value={firstScope.heightFactor} onChange={(e) => updateScope(firstScope.id, { heightFactor: e.target.value })} style={S.input} /></Field>
                      <Field label="Complexity Factor"><input value={firstScope.complexityFactor} readOnly style={{ ...S.input, opacity: 0.7, cursor: 'not-allowed' }} /></Field>
                      <Field label="Wall Flag Factor"><input value={firstScope.wallFlagFactor} readOnly style={{ ...S.input, opacity: 0.7, cursor: 'not-allowed' }} /></Field>
                      <Field label="Cut-In Top"><input value={firstScope.cutInTopFactor} onChange={(e) => updateScope(firstScope.id, { cutInTopFactor: e.target.value })} style={S.input} /></Field>
                      <Field label="Cut-In Bottom"><input value={firstScope.cutInBottomFactor} onChange={(e) => updateScope(firstScope.id, { cutInBottomFactor: e.target.value })} style={S.input} /></Field>
                    </div>
                    <Field label="Primer Product">
                      <select value={firstScope.primerProductId} onChange={(e) => updateScope(firstScope.id, { primerProductId: e.target.value })} style={S.input}>
                        <option value="">Select primer product</option>
                        {wallPrimerOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>
                    </Field>
                    <div>
                      <div style={{ ...S.mono, marginBottom: 6 }}>Overrides</div>
                      <div className="advanced-grid">
                        <Field label="Area Override (sf)"><input value={firstScope.overrideAreaSqFt} onChange={(e) => updateScope(firstScope.id, { overrideAreaSqFt: e.target.value })} style={S.input} /></Field>
                        <Field label="Paint Hours Override"><input value={firstScope.overridePaintHours} onChange={(e) => updateScope(firstScope.id, { overridePaintHours: e.target.value })} style={S.input} /></Field>
                        <Field label="Primer Hours Override"><input value={firstScope.overridePrimerHours} onChange={(e) => updateScope(firstScope.id, { overridePrimerHours: e.target.value })} style={S.input} /></Field>
                        <Field label="Paint Gallons Override"><input value={firstScope.overridePaintGallons} onChange={(e) => updateScope(firstScope.id, { overridePaintGallons: e.target.value })} style={S.input} /></Field>
                        <Field label="Primer Gallons Override"><input value={firstScope.overridePrimerGallons} onChange={(e) => updateScope(firstScope.id, { overridePrimerGallons: e.target.value })} style={S.input} /></Field>
                        <Field label="Supply Cost Override"><input value={firstScope.overrideSupplyCost} onChange={(e) => updateScope(firstScope.id, { overrideSupplyCost: e.target.value })} style={S.input} /></Field>
                        <Field label="Total Override"><input value={firstScope.overrideTotal} onChange={(e) => updateScope(firstScope.id, { overrideTotal: e.target.value })} style={S.input} /></Field>
                      </div>
                    </div>
                    <Field label="Scope Notes"><textarea value={firstScope.notes} onChange={(e) => updateScope(firstScope.id, { notes: e.target.value })} style={S.textarea} /></Field>
                  </div>
                )}
              </Advanced>

                      </WallsScopePanel>
                    </ScopeAccordionRow>
                  )}

                  {ceilingsIncluded && (
                    <ScopeAccordionRow
                      title="Ceilings"
                      expanded={ceilingsRowExpanded}
                      onToggle={() => setOpenCeilingSection((prev) => ({ ...prev, [selectedRoom.roomId]: !ceilingsRowExpanded }))}
                      summary={
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>Mode: {selectedRoomCeilingMode}</span>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>Sq Ft: {toDisplayNumber(selectedCeilingEffectiveSqFt)}</span>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>Paint: {ceilingPaintLabel}</span>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>Primer: {firstCeilingScope?.primeMode ?? 'NONE'}</span>
                          <span style={{ ...S.scopePill, color: selectedRoomIssueCount > 0 ? '#f9e2b7' : 'var(--v2-ink-2)' }}>
                            {selectedRoomIssueCount > 0 ? `${selectedRoomIssueCount} issue(s)` : 'Validated'}
                          </span>
                        </div>
                      }
                    >
                      <CeilingsScopePanel>
              <Advanced>
                <div style={{ ...S.mono, marginBottom: 6 }}>Ceiling Setup</div>
                <div style={{ display: 'grid', gap: 10, marginTop: 2 }}>

                    {/* Mode selector */}
                    <Field label="Ceiling Mode">
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['RECT', 'SEG'] as const).map((mode) => (
                          <button key={mode} type="button"
                            onClick={() => switchRoomCeilingMode(selectedRoom.roomId, mode)}
                            style={{ ...S.button, flex: 1, borderColor: selectedRoomCeilingMode === mode ? 'rgba(134,239,172,0.34)' : 'var(--v2-line)', background: selectedRoomCeilingMode === mode ? 'rgba(74,222,128,0.08)' : '#111111', color: selectedRoomCeilingMode === mode ? 'var(--v2-green-2)' : 'var(--v2-ink)' }}
                          >{mode}</button>
                        ))}
                      </div>
                    </Field>

                    {selectedRoomCeilingScopes.length === 0 && (
                      <button type="button" style={S.button} onClick={() => switchRoomCeilingMode(selectedRoom.roomId, 'RECT')}>
                        + Add ceiling scope
                      </button>
                    )}

                    {/* RECT mode */}
                    {selectedRoomCeilingMode === 'RECT' && firstCeilingScope && (() => {
                      const ceilLenSf = numberOrNull(firstCeilingScope.areaSf) ??
                        (() => { const L = numberOrNull(selectedRoom.lengthIn); const W = numberOrNull(selectedRoom.widthIn); return L && W ? (L * W) / 144 : null })()
                      return (
                        <>
                          <div className="geometry-primary-grid">
                            <Field label="Area Override (sf)">
                              <input value={firstCeilingScope.areaSf} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { areaSf: e.target.value })} style={S.input} type="number" min="0" placeholder="optional — uses room L×W" />
                            </Field>
                            <div className={ceilLenSf != null ? 'walksqft-box' : 'walksqft-box-empty'}>
                              <div style={S.mono}>Ceiling Sq Ft</div>
                              <div style={{ ...S.computedBig, color: ceilLenSf != null ? 'var(--v2-green-2)' : 'var(--v2-ink-3)' }}>{toDisplayNumber(ceilLenSf)}</div>
                            </div>
                          </div>
                          <div className="paint-setup-grid">
                            <Field label="Ceiling Type">
                              <select value={firstCeilingScope.ceilingTypeId} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { ceilingTypeId: e.target.value })} style={S.input}>
                                <option value="">Flat (1.0x)</option>
                                {catalogs.ceiling_types.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Paint Override">
                              <select value={firstCeilingScope.paintProductId} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { paintProductId: e.target.value })} style={S.input}>
                                <option value="">-- Use job default --</option>
                                {ceilingPaintOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Color Slot">
                              <select value={firstCeilingScope.colorId} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { colorId: e.target.value })} style={S.input}>
                                <option value="">-- select color --</option>
                                {catalogs.color_codes.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                              </select>
                            </Field>
                          </div>
                          <Field label="Primer Mode">
                            <div className="primer-mode-row">
                              {(['NONE', 'SPOT', 'FULL'] as const).map((mode) => (
                                <button key={mode} type="button"
                                  onClick={() => updateCeilingScope(firstCeilingScope.id, { primeMode: mode })}
                                  style={{ ...S.button, flex: 1, borderColor: firstCeilingScope.primeMode === mode ? 'rgba(134,239,172,0.34)' : 'var(--v2-line)', background: firstCeilingScope.primeMode === mode ? 'rgba(74,222,128,0.08)' : '#111111', color: firstCeilingScope.primeMode === mode ? 'var(--v2-green-2)' : 'var(--v2-ink)', minHeight: 32 }}
                                >{mode === 'NONE' ? 'None' : mode === 'SPOT' ? 'Spot' : 'Full'}</button>
                              ))}
                            </div>
                          </Field>
                          {firstCeilingScope.primeMode === 'SPOT' && (
                            <Field label="Spot Primer %">
                              <input value={firstCeilingScope.spotPrimePercent} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { spotPrimePercent: e.target.value })} style={S.input} type="number" min="0" max="100" />
                            </Field>
                          )}
                        </>
                      )
                    })()}

                    {/* SEG mode */}
                    {selectedRoomCeilingMode === 'SEG' && (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>Ceiling Scopes</div>
                          <button type="button" style={S.button} onClick={() => addCeilingScope(selectedRoom.roomId)}>+ Add scope</button>
                        </div>
                        {selectedRoomCeilingScopes.map((cScope, cScopeIdx) => {
                          const scopeSegs = sortByPosition(ceilingSegments.filter((seg) => seg.ceilingScopeId === cScope.id))
                          return (
                            <div key={cScope.id} style={{ border: '1px solid var(--v2-line)', borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div>
                                  <div style={S.mono}>Scope {cScopeIdx + 1}</div>
                                  <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700, marginTop: 3 }}>{cScope.scopeName || 'Ceiling scope'}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button type="button" style={S.button} disabled={cScopeIdx === 0} onClick={() => moveCeilingScope(selectedRoom.roomId, cScope.id, -1)}>Up</button>
                                  <button type="button" style={S.button} disabled={cScopeIdx === selectedRoomCeilingScopes.length - 1} onClick={() => moveCeilingScope(selectedRoom.roomId, cScope.id, 1)}>Down</button>
                                  <button type="button" style={S.button} onClick={() => deleteCeilingScope(selectedRoom.roomId, cScope.id)}>Delete</button>
                                </div>
                              </div>
                              <div className="paint-setup-grid">
                                <Field label="Ceiling Type">
                                  <select value={cScope.ceilingTypeId} onChange={(e) => updateCeilingScope(cScope.id, { ceilingTypeId: e.target.value })} style={S.input}>
                                    <option value="">Flat (1.0x)</option>
                                    {catalogs.ceiling_types.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                  </select>
                                </Field>
                                <Field label="Paint Override">
                                  <select value={cScope.paintProductId} onChange={(e) => updateCeilingScope(cScope.id, { paintProductId: e.target.value })} style={S.input}>
                                    <option value="">-- Use job default --</option>
                                    {ceilingPaintOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                  </select>
                                </Field>
                                <Field label="Color Slot">
                                  <select value={cScope.colorId} onChange={(e) => updateCeilingScope(cScope.id, { colorId: e.target.value })} style={S.input}>
                                    <option value="">-- select color --</option>
                                    {catalogs.color_codes.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                  </select>
                                </Field>
                              </div>
                              <button type="button" style={S.button} onClick={() => addCeilingSegment(selectedRoom.roomId, cScope.id)}>+ Add segment</button>
                              {scopeSegs.map((seg, segIdx) => (
                                <div key={seg.id} style={{ border: '1px solid var(--v2-line)', borderRadius: 12, padding: 14, background: '#111111', display: 'grid', gap: 12 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                    <div style={S.mono}>Segment {segIdx + 1} — {seg.segmentName || 'unnamed'}</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <button type="button" style={S.button} disabled={segIdx === 0} onClick={() => moveCeilingSegment(cScope.id, seg.id, -1)}>Up</button>
                                      <button type="button" style={S.button} disabled={segIdx === scopeSegs.length - 1} onClick={() => moveCeilingSegment(cScope.id, seg.id, 1)}>Down</button>
                                      <button type="button" style={S.button} onClick={() => deleteCeilingSegment(cScope.id, seg.id)}>Delete</button>
                                    </div>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }} className="walls-segment-grid">
                                    <Field label="Name"><input value={seg.segmentName} onChange={(e) => updateCeilingSegment(seg.id, { segmentName: e.target.value })} style={S.input} /></Field>
                                    <Field label="Include"><select value={seg.include} onChange={(e) => updateCeilingSegment(seg.id, { include: e.target.value as 'Y' | 'N' })} style={S.input}><option value="Y">Included</option><option value="N">Excluded</option></select></Field>
                                    <Field label="Shape"><select value={seg.shapeType} onChange={(e) => updateCeilingSegment(seg.id, { shapeType: e.target.value as CeilingSegmentShape })} style={S.input}><option value="RECTANGLE">Rectangle</option><option value="TRIANGLE">Triangle</option><option value="MANUAL">Manual</option></select></Field>
                                    <Field label="Qty"><input value={seg.quantity} onChange={(e) => updateCeilingSegment(seg.id, { quantity: e.target.value })} style={S.input} /></Field>
                                    <Field label="Width (in)"><input value={seg.widthIn} onChange={(e) => updateCeilingSegment(seg.id, { widthIn: e.target.value })} style={{ ...S.input, opacity: seg.shapeType === 'RECTANGLE' ? 1 : 0.5 }} disabled={seg.shapeType !== 'RECTANGLE'} /></Field>
                                    <Field label="Height (in)"><input value={seg.heightIn} onChange={(e) => updateCeilingSegment(seg.id, { heightIn: e.target.value })} style={{ ...S.input, opacity: seg.shapeType !== 'MANUAL' ? 1 : 0.5 }} disabled={seg.shapeType === 'MANUAL'} /></Field>
                                    <Field label="Base (in)"><input value={seg.baseIn} onChange={(e) => updateCeilingSegment(seg.id, { baseIn: e.target.value })} style={{ ...S.input, opacity: seg.shapeType === 'TRIANGLE' ? 1 : 0.5 }} disabled={seg.shapeType !== 'TRIANGLE'} /></Field>
                                    <Field label="Manual Area (sf)"><input value={seg.manualAreaSqFt} onChange={(e) => updateCeilingSegment(seg.id, { manualAreaSqFt: e.target.value })} style={{ ...S.input, opacity: seg.shapeType === 'MANUAL' ? 1 : 0.5 }} disabled={seg.shapeType !== 'MANUAL'} /></Field>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Ceiling Advanced / Overrides */}
                    {firstCeilingScope && (
                      <div style={{ border: '1px solid var(--v2-line)', borderRadius: 9, padding: 10 }}>
                        <button type="button"
                          className="advanced-toggle"
                          onClick={() => setOpenCeilingAdvanced((prev) => ({ ...prev, [selectedRoom.roomId]: !prev[selectedRoom.roomId] }))}
                          style={{ background: 'none', border: 'none', color: 'var(--v2-ink-3)', fontSize: 'calc(12px + 4pt)', fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}
                        >
                          <span style={S.mono}>Ceiling Overrides</span>
                          <span style={{ fontSize: 'calc(10px + 4pt)' }}>{openCeilingAdvanced[selectedRoom.roomId] ? '^' : 'v'}</span>
                        </button>
                        {openCeilingAdvanced[selectedRoom.roomId] && (
                          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                            <div className="advanced-grid">
                              <Field label="Include"><select value={firstCeilingScope.include} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { include: e.target.value as 'Y' | 'N' })} style={S.input}><option value="Y">Included</option><option value="N">Excluded</option></select></Field>
                              <Field label="Scope Name"><input value={firstCeilingScope.scopeName} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { scopeName: e.target.value })} style={S.input} /></Field>
                              <Field label="Height Factor"><input value={firstCeilingScope.heightFactor} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { heightFactor: e.target.value })} style={S.input} /></Field>
                              <Field label="Complexity Factor"><input value={firstCeilingScope.complexityFactor} readOnly style={{ ...S.input, opacity: 0.7, cursor: 'not-allowed' }} /></Field>
                              <Field label="Ceiling Flag Factor"><input value={firstCeilingScope.ceilingFlagFactor} readOnly style={{ ...S.input, opacity: 0.7, cursor: 'not-allowed' }} /></Field>
                              <Field label="Paint Coats"><input value={firstCeilingScope.paintCoats} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { paintCoats: e.target.value })} style={S.input} /></Field>
                            </div>
                            <div>
                              <div style={{ ...S.mono, marginBottom: 6 }}>Overrides</div>
                              <div className="advanced-grid">
                                <Field label="Area (sf)"><input value={firstCeilingScope.overrideAreaSqFt} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { overrideAreaSqFt: e.target.value })} style={S.input} /></Field>
                                <Field label="Paint Hrs"><input value={firstCeilingScope.overridePaintHours} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { overridePaintHours: e.target.value })} style={S.input} /></Field>
                                <Field label="Primer Hrs"><input value={firstCeilingScope.overridePrimerHours} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { overridePrimerHours: e.target.value })} style={S.input} /></Field>
                                <Field label="Paint Gal"><input value={firstCeilingScope.overridePaintGallons} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { overridePaintGallons: e.target.value })} style={S.input} /></Field>
                                <Field label="Primer Gal"><input value={firstCeilingScope.overridePrimerGallons} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { overridePrimerGallons: e.target.value })} style={S.input} /></Field>
                                <Field label="Supply Cost"><input value={firstCeilingScope.overrideSupplyCost} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { overrideSupplyCost: e.target.value })} style={S.input} /></Field>
                                <Field label="Total"><input value={firstCeilingScope.overrideTotal} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { overrideTotal: e.target.value })} style={S.input} /></Field>
                              </div>
                            </div>
                            <Field label="Notes"><textarea value={firstCeilingScope.notes} onChange={(e) => updateCeilingScope(firstCeilingScope.id, { notes: e.target.value })} style={S.textarea} /></Field>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
              </Advanced>

                      </CeilingsScopePanel>
                    </ScopeAccordionRow>
                  )}

                  {trimsIncluded && (
                    <ScopeAccordionRow
                      title="Trim"
                      expanded={trimsRowExpanded}
                      onToggle={() => setOpenTrimSection((prev) => ({ ...prev, [selectedRoom.roomId]: !trimsRowExpanded }))}
                      summary={
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>
                            Items: {selectedRoomTrimScopes.length}
                          </span>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>
                            Measure: {toDisplayNumber(selectedTrimMeasurement)}
                          </span>
                          <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>
                            Subtotal: {selectedTrimSubtotal == null ? '--' : `$${selectedTrimSubtotal.toFixed(2)}`}
                          </span>
                        </div>
                      }
                    >
                      <TrimScopePanel>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ ...S.mono, color: 'var(--v2-ink-3)' }}>
                            Dynamic trim items for this room
                          </div>
                          <button type="button" style={S.button} onClick={() => addTrimScope(selectedRoom.roomId)}>
                            + Add Trim Item
                          </button>
                        </div>
                        {selectedRoomTrimScopes.length === 0 && (
                          <div style={{ ...S.panel, color: 'var(--v2-ink-3)' }}>
                            Add a trim item to start trim scope inputs for this room.
                          </div>
                        )}
                        {selectedRoomTrimScopes.map((trimScope, trimIdx) => {
                          const typeMeta = catalogs.trim_items.find((item) => item.id === trimScope.trimTypeId)
                          const helperEligible = selectedRoomResolvedMode === 'RECT' && !!typeMeta?.helper_allowed
                          const rowMeasurement = trimScopeEffectiveMeasurementById.get(trimScope.id)
                          const rowSubtotal = trimScopeEffectiveTotalById.get(trimScope.id)
                          const rowModifierCount = [
                            trimScope.prepFactor,
                            trimScope.heightFactor,
                            trimScope.profileFactor,
                            trimScope.roomFlagFactor,
                            trimScope.maskingFactor,
                            trimScope.stairFactor,
                            trimScope.difficultFinishFactor,
                            trimScope.caulkFillFactor,
                          ].filter((value) => (numberOrNull(value) ?? 1) !== 1).length
                          return (
                            <div key={trimScope.id} style={{ border: '1px solid var(--v2-line)', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                <div>
                                  <div style={S.mono}>Trim Item {trimIdx + 1}</div>
                                  <div style={{ fontSize: 'calc(14px + 4pt)', fontWeight: 700, marginTop: 2 }}>
                                    {typeMeta?.label || trimScope.scopeName || 'Trim item'}
                                  </div>
                                  <div style={{ ...S.mono, marginTop: 3, color: 'var(--v2-ink-3)' }}>
                                    {trimScope.measurementMode === 'ROOM_HELPER' ? 'Helper' : 'Manual'} · {trimScope.unitType} · modifiers {rowModifierCount}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>
                                    {rowMeasurement == null ? '--' : toDisplayNumber(rowMeasurement)} {trimScope.unitType.toLowerCase()}
                                  </span>
                                  <span style={{ ...S.scopePill, color: 'var(--v2-ink-2)' }}>
                                    {rowSubtotal == null ? '--' : `$${rowSubtotal.toFixed(2)}`}
                                  </span>
                                  <button type="button" style={S.button} disabled={trimIdx === 0} onClick={() => moveTrimScope(selectedRoom.roomId, trimScope.id, -1)}>Up</button>
                                  <button type="button" style={S.button} disabled={trimIdx === selectedRoomTrimScopes.length - 1} onClick={() => moveTrimScope(selectedRoom.roomId, trimScope.id, 1)}>Down</button>
                                  <button type="button" style={S.button} onClick={() => deleteTrimScope(selectedRoom.roomId, trimScope.id)}>Delete</button>
                                </div>
                              </div>

                              <div className="paint-setup-grid">
                                <Field label="Trim Type">
                                  <select value={trimScope.trimTypeId} onChange={(e) => updateTrimType(trimScope.id, e.target.value)} style={S.input}>
                                    <option value="">-- select trim type --</option>
                                    {catalogs.trim_items.map((opt) => (
                                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                  </select>
                                </Field>
                                <Field label="Include">
                                  <select value={trimScope.include} onChange={(e) => updateTrimScope(trimScope.id, { include: e.target.value as 'Y' | 'N' })} style={S.input}>
                                    <option value="Y">Included</option>
                                    <option value="N">Excluded</option>
                                  </select>
                                </Field>
                                <Field label="Measurement Mode">
                                  <select
                                    value={trimScope.measurementMode}
                                    onChange={(e) => {
                                      const nextMode = e.target.value as TrimMeasurementMode
                                      updateTrimScope(trimScope.id, {
                                        measurementMode: nextMode,
                                        helperSource: nextMode === 'ROOM_HELPER' ? 'ROOM_PERIMETER' : '',
                                      })
                                    }}
                                    style={S.input}
                                  >
                                    <option value="MANUAL">MANUAL</option>
                                    <option value="ROOM_HELPER" disabled={!helperEligible}>ROOM_HELPER</option>
                                  </select>
                                </Field>
                                <Field label={`Measurement (${trimScope.unitType})`}>
                                  {trimScope.measurementMode === 'ROOM_HELPER' ? (
                                    <input value={trimScope.helperValue} onChange={(e) => updateTrimScope(trimScope.id, { helperValue: e.target.value })} style={S.input} placeholder="auto perimeter fallback" />
                                  ) : (
                                    <input value={trimScope.measurementValue} onChange={(e) => updateTrimScope(trimScope.id, { measurementValue: e.target.value })} style={S.input} type="number" min="0" />
                                  )}
                                </Field>
                              </div>

                              <div className="paint-setup-grid">
                                <Field label="Paint Override">
                                  <select value={trimScope.paintProductId} onChange={(e) => updateTrimScope(trimScope.id, { paintProductId: e.target.value })} style={S.input}>
                                    <option value="">-- Use job default --</option>
                                    {trimPaintOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                  </select>
                                </Field>
                                <Field label="Primer Override">
                                  <select value={trimScope.primerProductId} onChange={(e) => updateTrimScope(trimScope.id, { primerProductId: e.target.value })} style={S.input}>
                                    <option value="">-- Use job default --</option>
                                    {trimPrimerOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                  </select>
                                </Field>
                                <Field label="Color Slot">
                                  <select value={trimScope.colorId} onChange={(e) => updateTrimScope(trimScope.id, { colorId: e.target.value })} style={S.input}>
                                    <option value="">-- select color --</option>
                                    {catalogs.color_codes.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                  </select>
                                </Field>
                                <Field label="Primer Mode">
                                  <select value={trimScope.primeMode} onChange={(e) => updateTrimScope(trimScope.id, { primeMode: e.target.value as 'NONE' | 'SPOT' | 'FULL' })} style={S.input}>
                                    <option value="NONE">NONE</option>
                                    <option value="SPOT">SPOT</option>
                                    <option value="FULL">FULL</option>
                                  </select>
                                </Field>
                              </div>

                              <div className="advanced-grid">
                                <Field label="Prep"><input value={trimScope.prepFactor} onChange={(e) => updateTrimScope(trimScope.id, { prepFactor: e.target.value })} style={S.input} /></Field>
                                <Field label="Height"><input value={trimScope.heightFactor} onChange={(e) => updateTrimScope(trimScope.id, { heightFactor: e.target.value })} style={S.input} /></Field>
                                <Field label="Profile"><input value={trimScope.profileFactor} onChange={(e) => updateTrimScope(trimScope.id, { profileFactor: e.target.value })} style={S.input} /></Field>
                                <Field label="Room Flag"><input value={trimScope.roomFlagFactor} readOnly style={{ ...S.input, opacity: 0.7, cursor: 'not-allowed' }} /></Field>
                                <Field label="Masking"><input value={trimScope.maskingFactor} onChange={(e) => updateTrimScope(trimScope.id, { maskingFactor: e.target.value })} style={S.input} /></Field>
                                <Field label="Stair"><input value={trimScope.stairFactor} onChange={(e) => updateTrimScope(trimScope.id, { stairFactor: e.target.value })} style={S.input} /></Field>
                                <Field label="Finish"><input value={trimScope.difficultFinishFactor} onChange={(e) => updateTrimScope(trimScope.id, { difficultFinishFactor: e.target.value })} style={S.input} /></Field>
                                <Field label="Caulk/Fill"><input value={trimScope.caulkFillFactor} onChange={(e) => updateTrimScope(trimScope.id, { caulkFillFactor: e.target.value })} style={S.input} /></Field>
                              </div>

                              <div className="advanced-grid">
                                <Field label="Measure Override"><input value={trimScope.overrideMeasurement} onChange={(e) => updateTrimScope(trimScope.id, { overrideMeasurement: e.target.value })} style={S.input} /></Field>
                                <Field label="Hours Override"><input value={trimScope.overrideHours} onChange={(e) => updateTrimScope(trimScope.id, { overrideHours: e.target.value })} style={S.input} /></Field>
                                <Field label="Gallons Override"><input value={trimScope.overrideGallons} onChange={(e) => updateTrimScope(trimScope.id, { overrideGallons: e.target.value })} style={S.input} /></Field>
                                <Field label="Supply Override"><input value={trimScope.overrideSupplyCost} onChange={(e) => updateTrimScope(trimScope.id, { overrideSupplyCost: e.target.value })} style={S.input} /></Field>
                                <Field label="Line Total Override"><input value={trimScope.overrideTotal} onChange={(e) => updateTrimScope(trimScope.id, { overrideTotal: e.target.value })} style={S.input} /></Field>
                                <Field label="Description Override"><input value={trimScope.overrideDescription} onChange={(e) => updateTrimScope(trimScope.id, { overrideDescription: e.target.value })} style={S.input} /></Field>
                              </div>
                            </div>
                          )
                        })}
                      </TrimScopePanel>
                    </ScopeAccordionRow>
                  )}

                  {!wallsIncluded && !ceilingsIncluded && !trimsIncluded && (
                    <div style={{ ...S.panel, borderColor: 'var(--v2-line)', color: 'var(--v2-ink-3)' }}>
                      Enable at least one scope in the room header to start entering scope-specific details.
                    </div>
                  )}

                  {['Doors', 'Drywall repair'].map((label) => (
                    <section key={label} className='section-card section-card-compact' style={{ ...S.panel, display: 'grid', gap: 6, opacity: 0.78 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>{label}</span>
                        <span style={{ ...S.mono, color: 'var(--v2-ink-3)' }}>placeholder</span>
                      </div>
                      <div style={{ color: 'var(--v2-ink-3)', fontSize: 'calc(13px + 4pt)' }}>
                        Scope row reserved in this pass. Data-model controls are not enabled yet.
                      </div>
                    </section>
                  ))}
                </ScopeAccordionList>
              </div>
              <SummaryRail>
                <div style={S.mono}>Room Summary</div>
                <div className="summary-stack">
                  <div className="summary-card">
                    <div style={S.mono}>Room</div>
                    <div style={{ fontSize: 'calc(16px + 4pt)', fontWeight: 800, marginTop: 3 }}>{selectedRoom.roomId}</div>
                    <div style={{ fontSize: 'calc(13px + 4pt)', color: 'var(--v2-ink-2)', marginTop: 2 }}>{selectedRoom.roomName || 'Unnamed room'}</div>
                  </div>
                  <div className="summary-card">
                    <div style={S.mono}>Wall Mode</div>
                    <div style={{ fontSize: 'calc(14px + 4pt)', fontWeight: 700, marginTop: 3 }}>{selectedRoomMode}</div>
                  </div>
                  <div className="summary-card summary-card-accent">
                    <div style={S.mono}>Wall Sq Ft</div>
                    <div className="summary-kpi">{toDisplayNumber(selectedRoomEffectiveSqFt)}</div>
                  </div>
                  <div className="summary-card">
                    <div style={S.mono}>Effective Sq Ft</div>
                    <div style={{ fontSize: 'calc(18px + 4pt)', fontWeight: 800, marginTop: 2 }}>{toDisplayNumber(selectedScopeEffectiveSqFt)}</div>
                  </div>
                  <div className="summary-card">
                    <div style={S.mono}>Modifiers</div>
                    <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700, marginTop: 2 }}>{activeRoomFlagCount}</div>
                  </div>
                  <div className="summary-card">
                    <div style={S.mono}>Validation</div>
                    <div style={{ fontSize: 'calc(13px + 4pt)', color: validationIssues.length ? '#f9e2b7' : 'var(--v2-ink-2)', marginTop: 2 }}>
                      {validationIssues.length ? `${validationIssues.length} issue(s)` : 'No open issues'}
                    </div>
                  </div>
                  <div className="summary-card">
                    <div style={S.mono}>Running Total</div>
                    <div style={{ fontSize: 'calc(18px + 4pt)', fontWeight: 800, marginTop: 2 }}>{toDisplayNumber(totalEffectiveAreaSqFt)} sf</div>
                  </div>
                  <div className="summary-card">
                    <div style={S.mono}>Calculation State</div>
                    <div style={{ fontSize: 'calc(13px + 4pt)', color: calculationsStale ? '#f9e2b7' : 'var(--v2-ink-2)', marginTop: 2 }}>
                      {calculationsStale ? 'Live preview (not saved)' : 'Saved server values'}
                    </div>
                  </div>
                </div>
              </SummaryRail>
            </div>
          )}
        </main>
      </div>

      {/* FOOTER */}
      <div style={S.footer}>
        <div>
          <div style={S.mono}>Running total - {rooms.length} room{rooms.length !== 1 ? 's' : ''} - active scopes</div>
          <div style={{ fontSize: 'calc(24px + 4pt)', fontWeight: 800, letterSpacing: '-0.03em', marginTop: 4 }}>
            {toDisplayNumber(totalEffectiveAreaSqFt)} sf
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 'calc(13px + 4pt)', color: saveStatusColor }}>{saveStatusText}</div>
          <button type="button" className="v2-btn" onClick={() => void save()} disabled={saving || !dirty}
            style={{ ...S.button, opacity: saving || !dirty ? 0.5 : 1, cursor: saving || !dirty ? 'not-allowed' : 'pointer' }}>
            Save draft
          </button>
          <button type="button" className="v2-btn-primary" onClick={() => void save()} disabled={saving || !dirty}
            style={{ ...S.buttonPrimary, opacity: saving || !dirty ? 0.65 : 1, cursor: saving || !dirty ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save & continue ->'}
          </button>
        </div>
      </div>

      <style jsx global>{`
        button { transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease; }
        input, select, textarea { transition: border-color 0.12s ease, box-shadow 0.12s ease; }

        input:focus, select:focus, textarea:focus {
          outline: none !important;
          border-color: rgba(132,204,147,0.55) !important;
          box-shadow: 0 0 0 3px rgba(132,204,147,0.09) !important;
        }

        .v2-btn:not(:disabled):hover {
          border-color: rgba(255,255,255,0.18) !important;
          background: rgba(255,255,255,0.05) !important;
        }
        .v2-btn:not(:disabled):active {
          background: rgba(255,255,255,0.09) !important;
        }

        .v2-btn-primary:not(:disabled):hover {
          background: #9de8af !important;
          box-shadow: 0 0 22px rgba(132,204,147,0.35) !important;
        }
        .v2-btn-primary:not(:disabled):active {
          background: #78c98c !important;
        }

        .room-card:hover {
          border-color: rgba(132,204,147,0.22) !important;
          background: rgba(255,255,255,0.03) !important;
        }

        .flag-chip:hover {
          border-color: rgba(132,204,147,0.22) !important;
          background: rgba(255,255,255,0.06) !important;
          color: #fff !important;
        }
        .flag-chip-active {
          border-left: 2px solid rgba(132,204,147,0.52) !important;
          box-shadow: inset 0 0 0 1px rgba(132,204,147,0.12) !important;
        }

        .stepper-btn:hover { background: rgba(255,255,255,0.07) !important; }
        .stepper-btn:active { background: rgba(132,204,147,0.15) !important; }

        .walksqft-box {
          background: rgba(74,222,128,0.045) !important;
          border: 1px solid rgba(132,204,147,0.18) !important;
          border-radius: 12px !important;
          padding: 8px 12px !important;
        }
        .walksqft-box-empty {
          background: transparent !important;
          border: 1px solid var(--v2-line) !important;
          border-radius: 12px !important;
          padding: 8px 12px !important;
        }

        .mode-btn-active {
          box-shadow: inset 0 0 0 1px rgba(132,204,147,0.3), 0 0 12px rgba(132,204,147,0.1) !important;
        }

        .room-workspace {
          display: grid;
          grid-template-columns: minmax(0, 2.1fr) minmax(260px, 0.9fr);
          gap: 12px;
          align-items: start;
        }

        .room-main-col {
          display: grid;
          gap: 10px;
        }

        .room-setup-grid {
          display: grid;
          grid-template-columns: minmax(220px, 1.4fr) minmax(170px, 0.9fr) minmax(210px, 1fr) auto;
          gap: 8px;
          align-items: end;
        }

        .room-setup-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          min-height: 34px;
        }

        .geometry-primary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(160px, 0.9fr);
          gap: 8px;
          align-items: end;
        }

        .geometry-secondary-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          align-items: end;
        }

        .paint-setup-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          align-items: end;
        }

        .primer-mode-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }

        .modifier-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }

        .scope-chip-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .advanced-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .room-side-col {
          max-height: calc(100vh - 88px);
          overflow: auto;
        }

        .summary-stack {
          display: grid;
          gap: 6px;
        }

        .summary-card {
          border: 1px solid var(--v2-line);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.015);
          padding: 7px 9px;
        }

        .summary-card-accent {
          border-color: rgba(132, 204, 147, 0.22);
          background: rgba(74, 222, 128, 0.06);
        }

        .summary-kpi {
          margin-top: 2px;
          font-size: calc(22px + 4pt);
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--v2-green-2);
        }

        .section-card { position: relative; }
        .section-card-compact {
          padding: 10px !important;
        }
        .section-card-green {
          background:
            radial-gradient(150% 180% at 0% 0%, rgba(118,165,132,0.1) 0%, rgba(84,132,101,0.065) 28%, rgba(52,84,63,0.03) 52%, rgba(25,40,31,0.015) 68%, rgba(0,0,0,0) 100%),
            linear-gradient(180deg, rgba(10,20,15,0.94) 0%, rgba(9,14,12,0.93) 100%) !important;
          border-color: rgba(108,160,125,0.26) !important;
          box-shadow: inset 0 1px 0 rgba(142,188,157,0.08), 0 0 0 1px rgba(110,156,126,0.04);
        }
        .section-card::before {
          content: '';
          position: absolute;
          top: 16px; left: 0;
          width: 2px; height: 18px;
          background: rgba(132,204,147,0.3);
          border-radius: 0 2px 2px 0;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .section-card:focus-within::before { opacity: 1; }

        .advanced-toggle:hover { color: rgba(255,255,255,0.8) !important; }

        .add-room-card:hover {
          border-color: rgba(132,204,147,0.3) !important;
          color: #84cc93 !important;
          background: rgba(74,222,128,0.04) !important;
        }

        .scope-pill-active {
          box-shadow: 0 0 10px rgba(132,204,147,0.18) !important;
        }

        .dim-divider {
          height: 1px;
          border-top: 1px dashed rgba(120,165,136,0.2);
          margin-top: -1px;
          margin-bottom: 1px;
        }

        @media (max-width: 1280px) {
          .room-workspace {
            grid-template-columns: 1fr;
          }
          .room-side-col {
            position: static !important;
            top: auto !important;
            max-height: none;
          }
        }
        @media (max-width: 1100px) {
          .ace-v2-rooms-layout,
          .walls-v2-shell { grid-template-columns: 1fr !important; }
          .room-setup-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .geometry-secondary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .paint-setup-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .modifier-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .walls-room-grid, .walls-field-grid, .walls-segment-grid { grid-template-columns: 1fr !important; }
          .room-setup-grid,
          .geometry-primary-grid,
          .geometry-secondary-grid,
          .paint-setup-grid,
          .modifier-grid,
          .advanced-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ── Settings drawer ── */}
      {settingsOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 48, background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setSettingsOpen(false)}
          />
          <div
            style={{
              position:      'fixed',
              top:           0,
              right:         0,
              bottom:        0,
              width:         340,
              zIndex:        49,
              background:    'var(--v2-bg-2)',
              borderLeft:    '1px solid var(--v2-line)',
              overflowY:     'auto',
              padding:       '16px 18px',
              display:       'grid',
              gap:           20,
              alignContent:  'start',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 'calc(14px + 4pt)', letterSpacing: '-0.01em' }}>
                Estimate Settings
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--v2-ink-3)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Customer Info */}
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ ...S.mono, marginBottom: 2 }}>Customer Info</div>
              {[
                { label: 'Name',    key: 'name'    as const, type: 'text'  },
                { label: 'Email',   key: 'email'   as const, type: 'email' },
                { label: 'Phone',   key: 'phone'   as const, type: 'tel'   },
                { label: 'Address', key: 'address' as const, type: 'text'  },
              ].map(({ label, key, type }) => (
                <label key={key} style={S.label}>
                  <span style={{ fontSize: 'calc(10px + 4pt)', color: 'var(--v2-ink-3)', fontWeight: 600 }}>{label}</span>
                  <input
                    type={type}
                    value={customerDraft[key]}
                    onChange={(e) => setCustomerDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                    onBlur={() => saveCustomerDebounced(customerDraft)}
                    style={S.input}
                  />
                </label>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--v2-line)' }} />

            {/* Labor Day Policy */}
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={S.mono}>Labor Day Policy</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...jobSettingsDraft, laborDayEnabled: !jobSettingsDraft.laborDayEnabled }
                    setJobSettingsDraft(next)
                    savePolicyDebounced(next)
                  }}
                  style={{
                    width:        36,
                    height:       20,
                    borderRadius: 10,
                    background:   jobSettingsDraft.laborDayEnabled ? '#8ad39b' : '#333',
                    border:       'none',
                    position:     'relative',
                    cursor:       'pointer',
                    flexShrink:   0,
                  }}
                >
                  <span style={{
                    position:     'absolute',
                    top:          3,
                    left:         jobSettingsDraft.laborDayEnabled ? 19 : 3,
                    width:        14,
                    height:       14,
                    borderRadius: '50%',
                    background:   jobSettingsDraft.laborDayEnabled ? '#062410' : '#666',
                    transition:   'left 0.15s',
                    display:      'block',
                  }} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Hours / day',   key: 'dayhours'              as const },
                  { label: 'Round (hrs)',   key: 'roundingIncrementHours' as const },
                ].map(({ label, key }) => (
                  <label key={key} style={S.label}>
                    <span style={{ fontSize: 'calc(10px + 4pt)', color: 'var(--v2-ink-3)', fontWeight: 600 }}>{label}</span>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={jobSettingsDraft[key]}
                      onChange={(e) => {
                        const next = { ...jobSettingsDraft, [key]: Number(e.target.value) }
                        setJobSettingsDraft(next)
                        savePolicyDebounced(next)
                      }}
                      style={S.input}
                    />
                  </label>
                ))}
              </div>
              <label style={S.label}>
                <span style={{ fontSize: 'calc(10px + 4pt)', color: 'var(--v2-ink-3)', fontWeight: 600 }}>Labor rate ($/hr)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={jobSettingsDraft.laborRate}
                  onChange={(e) => {
                    const next = { ...jobSettingsDraft, laborRate: Number(e.target.value) }
                    setJobSettingsDraft(next)
                    savePolicyDebounced(next)
                  }}
                  style={S.input}
                />
              </label>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--v2-line)' }} />

            {/* Job Minimum */}
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={S.mono}>Job Minimum</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...jobSettingsDraft, jobMinEnabled: !jobSettingsDraft.jobMinEnabled }
                    setJobSettingsDraft(next)
                    savePolicyDebounced(next)
                  }}
                  style={{
                    width:        36,
                    height:       20,
                    borderRadius: 10,
                    background:   jobSettingsDraft.jobMinEnabled ? '#8ad39b' : '#333',
                    border:       'none',
                    position:     'relative',
                    cursor:       'pointer',
                    flexShrink:   0,
                  }}
                >
                  <span style={{
                    position:     'absolute',
                    top:          3,
                    left:         jobSettingsDraft.jobMinEnabled ? 19 : 3,
                    width:        14,
                    height:       14,
                    borderRadius: '50%',
                    background:   jobSettingsDraft.jobMinEnabled ? '#062410' : '#666',
                    transition:   'left 0.15s',
                    display:      'block',
                  }} />
                </button>
              </div>
              {jobSettingsDraft.jobMinEnabled && (
                <label style={S.label}>
                  <span style={{ fontSize: 'calc(10px + 4pt)', color: 'var(--v2-ink-3)', fontWeight: 600 }}>Minimum ($)</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={jobSettingsDraft.jobMinAmount}
                    onChange={(e) => {
                      const next = { ...jobSettingsDraft, jobMinAmount: Number(e.target.value) }
                      setJobSettingsDraft(next)
                      savePolicyDebounced(next)
                    }}
                    style={S.input}
                  />
                </label>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function buildSavePayload(
  rooms: RoomDraft[],
  scopes: WallScopeDraft[],
  segments: WallSegmentDraft[],
  roomFlags: RoomFlagDraft[],
  ceilingScopes: CeilingScopeDraft[],
  ceilingSegments: CeilingSegmentDraft[],
  trimScopes: TrimScopeDraft[]
) {
  const orderedRooms = sortByPosition(rooms).map((room, index) => ({
    id: room.id,
    room_id: room.roomId,
    room_name: room.roomName.trim(),
    notes: room.notes.trim() || null,
    position: index,
    length_in: numberOrNull(room.lengthIn),
    width_in: numberOrNull(room.widthIn),
    wallheight_in: numberOrNull(room.heightIn),
  }))

  const orderedScopes = orderedRooms.flatMap((room) =>
    sortByPosition(scopes.filter((scope) => scope.roomId === room.room_id)).map((scope, index) => {
      const scopeSegments = sortByPosition(segments.filter((segment) => segment.wallScopeId === scope.id))
      const derived = deriveScope(scope, scopeSegments)
      const overrideArea = numberOrNull(scope.overrideAreaSqFt)
      const overridePaintHours = numberOrNull(scope.overridePaintHours)
      const overridePrimerHours = numberOrNull(scope.overridePrimerHours)
      const overridePaintGallons = numberOrNull(scope.overridePaintGallons)
      const overridePrimerGallons = numberOrNull(scope.overridePrimerGallons)
      const overrideSupplyCost = numberOrNull(scope.overrideSupplyCost)
      const overrideTotal = numberOrNull(scope.overrideTotal)
      return {
        id: scope.id,
        room_id: scope.roomId,
        position: index,
        mode: scope.mode,
        include: scope.include,
        scope_name: scope.scopeName.trim() || null,
        color_id: scope.colorId.trim() || null,
        paint_product_id: scope.paintProductId.trim() || null,
        primer_product_id: scope.primerProductId.trim() || null,
        prime_mode: scope.primeMode,
        height_in: numberOrNull(scope.heightIn),
        perimeter_in: scope.mode === 'RECT' ? numberOrNull(scope.perimeterIn) : null,
        standard_door_count: scope.mode === 'RECT' ? numberOrNull(scope.standardDoorCount) : null,
        standard_window_count: scope.mode === 'RECT' ? numberOrNull(scope.standardWindowCount) : null,
        height_factor: numberOrNull(scope.heightFactor),
        complexity_factor: numberOrNull(scope.complexityFactor),
        wall_flag_factor: numberOrNull(scope.wallFlagFactor),
        cut_in_top_factor: numberOrNull(scope.cutInTopFactor),
        cut_in_bottom_factor: numberOrNull(scope.cutInBottomFactor),
        paint_coats: numberOrNull(scope.paintCoats),
        primer_coats: numberOrNull(scope.primerCoats),
        spot_prime_percent: numberOrNull(scope.spotPrimePercent),
        raw_area_sf: derived.rawArea,
        override_area_sf: overrideArea,
        effective_area_sf: derived.effectiveArea,
        raw_paint_hours: null,
        override_paint_hours: overridePaintHours,
        effective_paint_hours: null,
        raw_primer_hours: null,
        override_primer_hours: overridePrimerHours,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        override_paint_gallons: overridePaintGallons,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        override_primer_gallons: overridePrimerGallons,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        override_supply_cost: overrideSupplyCost,
        effective_supply_cost: null,
        raw_total: null,
        override_total: overrideTotal,
        effective_total: null,
        notes: scope.notes.trim() || null,
      }
    })
  )

  const scopeIdSet = new Set(orderedScopes.map((scope) => scope.id))
  const orderedSegments = orderedScopes.flatMap((scope) =>
    sortByPosition(segments.filter((segment) => segment.wallScopeId === scope.id && scopeIdSet.has(segment.wallScopeId))).map(
      (segment, index) => {
        const derived = deriveSegment(segment)
        return {
          id: segment.id,
          wall_scope_id: segment.wallScopeId,
          room_id: segment.roomId,
          position: index,
          segment_name: segment.segmentName.trim() || null,
          include: segment.include,
          shape_type: segment.shapeType,
          quantity: numberOrNull(segment.quantity),
          width_in: segment.shapeType === 'RECTANGLE' ? numberOrNull(segment.widthIn) : null,
          height_in: segment.shapeType !== 'MANUAL' ? numberOrNull(segment.heightIn) : null,
          base_in: segment.shapeType === 'TRIANGLE' ? numberOrNull(segment.baseIn) : null,
          manual_area_sf: segment.shapeType === 'MANUAL' ? numberOrNull(segment.manualAreaSqFt) : null,
          standard_door_count: numberOrNull(segment.standardDoorCount),
          standard_window_count: numberOrNull(segment.standardWindowCount),
          raw_area_sf: derived.rawArea,
          override_area_sf: numberOrNull(segment.overrideAreaSqFt),
          effective_area_sf: derived.effectiveArea,
          notes: segment.notes.trim() || null,
        }
      }
    )
  )

  const orderedRoomFlags = [...roomFlags]
    .sort((a, b) => a.roomId.localeCompare(b.roomId) || a.position - b.position)
    .map((flag) => ({
      id: flag.id,
      room_id: flag.roomId,
      flag_id: flag.flagId,
      position: flag.position,
      active: 'Y',
    }))

  const orderedCeilingScopes = orderedRooms.flatMap((room) =>
    sortByPosition(ceilingScopes.filter((scope) => scope.roomId === room.room_id)).map((scope, index) => ({
      id: scope.id,
      room_id: scope.roomId,
      position: index,
      mode: scope.mode,
      include: scope.include,
      scope_name: scope.scopeName.trim() || null,
      color_id: scope.colorId.trim() || null,
      paint_product_id: scope.paintProductId.trim() || null,
      primer_product_id: scope.primerProductId.trim() || null,
      prime_mode: scope.primeMode,
      spot_prime_percent: numberOrNull(scope.spotPrimePercent),
      ceiling_type_id: scope.ceilingTypeId.trim() || null,
      length_in: scope.mode === 'RECT' ? room.length_in : null,
      width_in: scope.mode === 'RECT' ? room.width_in : null,
      area_sf: numberOrNull(scope.areaSf),
      height_factor: numberOrNull(scope.heightFactor),
      complexity_factor: numberOrNull(scope.complexityFactor),
      ceiling_flag_factor: numberOrNull(scope.ceilingFlagFactor),
      paint_coats: numberOrNull(scope.paintCoats),
      primer_coats: numberOrNull(scope.primerCoats),
      override_area_sf: numberOrNull(scope.overrideAreaSqFt),
      override_paint_hours: numberOrNull(scope.overridePaintHours),
      override_primer_hours: numberOrNull(scope.overridePrimerHours),
      override_paint_gallons: numberOrNull(scope.overridePaintGallons),
      override_primer_gallons: numberOrNull(scope.overridePrimerGallons),
      override_supply_cost: numberOrNull(scope.overrideSupplyCost),
      override_total: numberOrNull(scope.overrideTotal),
      notes: scope.notes.trim() || null,
    }))
  )

  const ceilingScopeIdSet = new Set(orderedCeilingScopes.map((scope) => scope.id))
  const orderedCeilingSegments = orderedCeilingScopes.flatMap((scope) =>
    sortByPosition(
      ceilingSegments.filter((seg) => seg.ceilingScopeId === scope.id && ceilingScopeIdSet.has(seg.ceilingScopeId))
    ).map((seg, index) => ({
      id: seg.id,
      ceiling_scope_id: seg.ceilingScopeId,
      room_id: seg.roomId,
      position: index,
      segment_name: seg.segmentName.trim() || null,
      include: seg.include,
      shape_type: seg.shapeType,
      quantity: numberOrNull(seg.quantity),
      width_in: seg.shapeType === 'RECTANGLE' ? numberOrNull(seg.widthIn) : null,
      height_in: seg.shapeType !== 'MANUAL' ? numberOrNull(seg.heightIn) : null,
      base_in: seg.shapeType === 'TRIANGLE' ? numberOrNull(seg.baseIn) : null,
      manual_area_sf: seg.shapeType === 'MANUAL' ? numberOrNull(seg.manualAreaSqFt) : null,
      override_area_sf: numberOrNull(seg.overrideAreaSqFt),
      notes: seg.notes.trim() || null,
    }))
  )

  const orderedTrimScopes = orderedRooms.flatMap((room) =>
    sortByPosition(trimScopes.filter((scope) => scope.roomId === room.room_id)).map((scope, index) => ({
      id: scope.id,
      room_id: scope.roomId,
      position: index,
      include: scope.include,
      scope_name: scope.scopeName.trim() || null,
      trim_type_id: scope.trimTypeId.trim() || null,
      trim_family: scope.trimFamily.trim() || null,
      unit_type: scope.unitType,
      measurement_mode: scope.measurementMode,
      helper_source: scope.measurementMode === 'ROOM_HELPER' ? 'ROOM_PERIMETER' : null,
      measurement_value: scope.measurementMode === 'MANUAL' ? numberOrNull(scope.measurementValue) : null,
      helper_value: scope.measurementMode === 'ROOM_HELPER' ? numberOrNull(scope.helperValue) : null,
      color_id: scope.colorId.trim() || null,
      paint_product_id: scope.paintProductId.trim() || null,
      primer_product_id: scope.primerProductId.trim() || null,
      paint_enabled: scope.paintEnabled,
      prime_mode: scope.primeMode,
      spot_prime_percent: numberOrNull(scope.spotPrimePercent),
      production_rate_id: scope.productionRateId.trim() || null,
      prep_factor: numberOrNull(scope.prepFactor),
      height_factor: numberOrNull(scope.heightFactor),
      profile_factor: numberOrNull(scope.profileFactor),
      room_flag_factor: numberOrNull(scope.roomFlagFactor),
      masking_factor: numberOrNull(scope.maskingFactor),
      stair_factor: numberOrNull(scope.stairFactor),
      difficult_finish_factor: numberOrNull(scope.difficultFinishFactor),
      caulk_fill_factor: numberOrNull(scope.caulkFillFactor),
      paint_coats: numberOrNull(scope.paintCoats),
      primer_coats: numberOrNull(scope.primerCoats),
      override_measurement: numberOrNull(scope.overrideMeasurement),
      override_hours: numberOrNull(scope.overrideHours),
      override_gallons: numberOrNull(scope.overrideGallons),
      override_supply_cost: numberOrNull(scope.overrideSupplyCost),
      override_total: numberOrNull(scope.overrideTotal),
      override_description: scope.overrideDescription.trim() || null,
      notes: scope.notes.trim() || null,
    }))
  )

  return {
    rooms: orderedRooms,
    room_wall_scopes: orderedScopes,
    wall_segments: orderedSegments,
    room_flags: orderedRoomFlags,
    room_ceiling_scopes: orderedCeilingScopes,
    ceiling_scope_segments: orderedCeilingSegments,
    room_trim_scopes: orderedTrimScopes,
  }
}
