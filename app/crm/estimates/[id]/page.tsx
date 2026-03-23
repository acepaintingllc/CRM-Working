'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  Building2,
  Calculator,
  FileStack,
  FileText,
  Link2,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Shapes,
} from 'lucide-react'

type OutputApp = Record<string, string | number | null>

type EstimatePayload = {
  estimate: {
    id: string
    job_id: string
    customer_id: string
    status: string
    sheet_file_path?: string | null
    latest_output_json?: {
      output_app?: OutputApp
      engine_color_list?: EngineColorList | null
      updated_at?: string
    } | null
  }
  inputs: {
    jobsettings: Record<string, unknown> | null
    rooms: Record<string, unknown>[]
    segments: Record<string, unknown>[]
    ceiling_segments?: Record<string, unknown>[]
    rollers: Record<string, unknown>[]
    prejob: Record<string, unknown>[]
    trim_items?: Record<string, unknown>[]
  }
}

type CatalogOption = {
  id: string
  label: string
  active: 'Y' | 'N'
}

type PaintCatalogOption = CatalogOption & {
  type: string
  price_per_gal: number | null
  coverage_sqft_per_gal_per_coat: number | null
  notes: string | null
}

type CeilingTypeOption = CatalogOption & {
  labor_mult: number | null
  surcharge_per_sqft: number | null
  notes: string | null
}

type WallComplexityOption = CatalogOption & {
  labor_multiplier: number | null
  access_fee: number | null
}

type RollerCoverOption = CatalogOption & {
  scope: 'Wall' | 'Ceiling' | 'Other'
  size_in: number | null
  price_each: number | null
  notes: string | null
}

type TrimItemOption = CatalogOption & {
  unit: string | null
  notes: string | null
  default_qty?: number | null
  is_active?: boolean
  category?: string | null
  size?: string | null
}

type PreJobTripOption = CatalogOption & {
  rollup_scope?: string | null
  man_trip_name?: string | null
  task?: string | null
  trip_num?: number | null
  man_qty?: number | null
  man_hours_each?: number | null
  extra_supplies?: number | null
  category?: string | null
  trip_name?: string
  qty: number | null
  hours_each?: number | null
  laborrate?: number | null
  markup?: number | null
  notes: string | null
}

type MissingInputIssue = {
  tab: string
  header: string
  room_id?: string
  message: string
}

type EstimateCatalogsPayload = {
  spreadsheet_id: string
  schema_version: string
  schema_mismatch: boolean
  defaults: {
    override_labor_rate: number | null
    override_markup: number | null
    rounding_increment_hours: number | null
    dayhours: number | null
  }
  catalogs: {
    paint_products: PaintCatalogOption[]
    ceiling_types: CeilingTypeOption[]
    wall_complexity_types: WallComplexityOption[]
    color_codes: CatalogOption[]
    roller_covers: RollerCoverOption[]
    trim_items: TrimItemOption[]
    trim_menu_items?: TrimItemOption[]
    prejob_trips: PreJobTripOption[]
  }
}

type EngineColorList = {
  wall_colors?: {
    wall_color_id: string
    wall_sqft?: number | string | null
    roller_size_in_selected?: number | string | null
    covers_qty_selected?: number | string | null
  }[]
  ceiling_roller?: {
    roller_size_in?: number | string | null
    covers_qty?: number | string | null
  }
}

type JobSettingsDraft = {
  walls_paint_id: string
  ceiling_paint_id: string
  trim_paint_id: string
  primer_id: string
  walls_primer_id: string
  ceiling_primer_id: string
  trim_primer_id: string
  override_labor_rate: string
  override_markup: string
  rounding_increment_hours: string
  dayhours: string
  default_walls_prep_level: string
  default_ceiling_prep_level: string
  default_trim_prep_level: string
  walls_paint_gal_override: string
  ceiling_paint_gal_override: string
  primer_gal_override: string
  extra_supplies_walls: string
  extra_supplies_ceilings: string
  extra_supplies_trim: string
  trim_paint_qty: string
  trim_paint_uom: string
  trim_primer_qty: string
  trim_primer_uom: string
  notes: string
}

type RoomDraft = {
  id?: string
  room_id: string
  room_name: string
  mode: 'RECT' | 'SEG'
  length_in: string
  width_in: string
  wallheight_in: string
  ceilingheight_in: string
  ceilingsqft_override: string
  baseexclude_in: string
  walls_include: 'Y' | 'N'
  walls_primer: string
  walls_topcoats: string
  walls_prep_override: string
  walls_prep_level: string
  wall_sqft_override: string
  openings_sqft: string
  walls_notes: string
  ceiling_include: 'Y' | 'N'
  ceiling_primer: string
  ceiling_topcoats: string
  ceiling_prep_level: string
  ceiling_prep_override: string
  ceiling_height_surcharge: string
  trim_include: 'Y' | 'N'
  trim_primer: string
  trim_topcoats: string
  trim_prep_override: string
  doors_prep_override: string
  baseboard_primer_mode: string
  baseboard_spot_prime_pct: string
  baseboard_prep_override: string
  baseboard_type_id: string
  baseboard_lf: string
  baseboard_auto: 'Y' | 'N'
  crown_primer_mode: string
  crown_spot_prime_pct: string
  crown_prep_override: string
  crown_type_id: string
  crown_lf: string
  crown_auto: 'Y' | 'N'
  window_casing_primer_mode: string
  window_casing_spot_prime_pct: string
  window_casing_prep_override: string
  window_casing_type_id: string
  window_count: string
  door_casing_primer_mode: string
  door_casing_spot_prime_pct: string
  door_casing_prep_override: string
  door_casing_type_id: string
  door_casing_count: string
  door_primer_mode: string
  door_spot_prime_pct: string
  door_prep_override: string
  door_type_id: string
  door_paint_count: string
  door_sides: string
  door_count: string
  auto_calc_trim_perimeter: 'Y' | 'N'
  wall_color_id: string
  ceiling_type_id: string
}

type SegmentDraft = {
  id?: string
  room_id: string
  seg_no: string
  seglen_in: string
  seg_wallheight_in: string
  wall_complexity_type_id: string
  walls_calc_method: 'REGULAR' | 'PANEL'
  panel_length_in: string
  panel_height_bottom_in: string
  panel_height_top_in: string
  baseexclude_in: string
  wall_color_override_id: string
  wall_label: string
  notes: string
  active: 'Y' | 'N'
}

type CeilingSegmentDraft = {
  id?: string
  room_id: string
  seg_no: string
  length_in: string
  width_in: string
  ceiling_height_in: string
  notes: string
  active: 'Y' | 'N'
}

type PreJobDraft = {
  id?: string
  trip_num: string
  rollup_scope: string
  task_template_id: string
  task_name: string
  manual_task_name: string
  qty: string
  hours_each: string
  extra_supplies: string
  notes: string
  active: 'Y' | 'N'
}

type PreJobTaskDraft = {
  id: string
  mode: 'template' | 'manual'
  rollup_scope: 'Walls' | 'Ceilings' | 'Trim'
  task_template_id: string
  task_name: string
  manual_task_name: string
  qty: string
  hours_each: string
  extra_supplies: string
}

type PreJobTripDraft = {
  id: string
  trip_num: string
  notes: string
  tasks: PreJobTaskDraft[]
}

type RollerDraft = {
  id?: string
  scope: 'Wall' | 'Ceiling'
  wall_color_id: string
  wall_sqft?: number | string | null
  roller_size_in: string
  covers_qty: string
  notes: string
  active: 'Y' | 'N'
}

type TrimItemDraft = {
  room_id: string
  trim_menu_id: string
  qty: string
  coats?: string
  auto_calc?: 'Y' | 'N'
  primer_mode?: string
  spot_prime_pct?: string
  prep_level_override?: string
  door_sides?: string
  notes: string
}

type ExtraTrimDraft = {
  local_id: string
  room_id: string
  trim_menu_id: string
  qty: string
  coats: string
  auto_calc: 'Y' | 'N'
  primer_mode: string
  spot_prime_pct: string
  prep_level_override: string
  door_sides: string
  notes: string
}

const tabs = ['Job Settings', 'Rooms', 'Segments', 'Rollers', 'PreJob Trips', 'Summary & Final Adjustments'] as const
const tabIcons: Record<(typeof tabs)[number], LucideIcon> = {
  'Job Settings': SettingsIcon,
  Rooms: Building2,
  Segments: Shapes,
  Rollers: FileStack,
  'PreJob Trips': FileText,
  'Summary & Final Adjustments': Calculator,
}

function iconLabel(Icon: LucideIcon, label: string, size = 16) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

const emptyCatalogs: EstimateCatalogsPayload = {
  spreadsheet_id: '',
  schema_version: '',
  schema_mismatch: false,
  defaults: {
    override_labor_rate: null,
    override_markup: null,
    rounding_increment_hours: null,
    dayhours: null,
  },
  catalogs: {
    paint_products: [],
    ceiling_types: [],
    wall_complexity_types: [],
    color_codes: [],
    roller_covers: [],
    trim_items: [],
    trim_menu_items: [],
    prejob_trips: [],
  },
}

function toText(v: unknown) {
  return v == null ? '' : String(v)
}

function toNumString(v: unknown) {
  if (v == null || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : ''
}

function toYN(v: unknown, fallback: 'Y' | 'N' = 'N'): 'Y' | 'N' {
  return String(v ?? '').toUpperCase() === 'Y' ? 'Y' : fallback
}

function normalizePrimerMode(value: unknown): '' | 'Spot' | 'Full' {
  const v = toText(value).trim().toLowerCase()
  if (v === 'spot') return 'Spot'
  if (v === 'full' || v === 'yes' || v === 'y') return 'Full'
  return ''
}

function primerModeEnabled(value: unknown) {
  return normalizePrimerMode(value) !== ''
}

function normalizeColorId(v: string) {
  return v.toUpperCase().replace(/[^A-Z]/g, '')
}

function formatCurrency(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

function calcRectPerimeterLf(lengthIn: string, widthIn: string) {
  const l = Number(lengthIn)
  const w = Number(widthIn)
  if (!Number.isFinite(l) || !Number.isFinite(w)) return ''
  return String((2 * (l + w)) / 12)
}

function nextRoomId(rows: RoomDraft[]) {
  const used = new Set(rows.map((r) => r.room_id))
  let n = 1
  while (used.has(`R${String(n).padStart(3, '0')}`)) n += 1
  return `R${String(n).padStart(3, '0')}`
}

function paintOptionLabel(p: PaintCatalogOption) {
  const bits = [p.label]
  if (p.price_per_gal != null) bits.push(`$${p.price_per_gal}/gal`)
  if (p.coverage_sqft_per_gal_per_coat != null) bits.push(`${p.coverage_sqft_per_gal_per_coat} sqft/gal`)
  return bits.join(' - ')
}

function trimOptionLabel(item: TrimItemOption) {
  const unit = toText(item.unit).toUpperCase()
  return unit ? `${item.label} (${unit})` : item.label
}

function parseSpreadsheetIdFromSheetPath(path: string | null | undefined) {
  const raw = toText(path)
  if (!raw) return ''
  const filePathMatch = /sheet_([a-zA-Z0-9\-_]+)\.xlsx/.exec(raw)
  if (filePathMatch?.[1]) return filePathMatch[1]
  const urlMatch = /\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/.exec(raw)
  return urlMatch?.[1] ?? ''
}

function defaultCeilingTypeId(catalogs: EstimateCatalogsPayload) {
  const fromFlat = catalogs.catalogs.ceiling_types.find((r) => r.id.toUpperCase() === 'FLAT')
  if (fromFlat) return fromFlat.id
  return catalogs.catalogs.ceiling_types[0]?.id ?? ''
}

function defaultWallComplexityTypeId(catalogs: EstimateCatalogsPayload) {
  const standard = catalogs.catalogs.wall_complexity_types.find((r) => r.id.toUpperCase() === 'STANDARD')
  if (standard) return standard.id
  return catalogs.catalogs.wall_complexity_types[0]?.id ?? 'STANDARD'
}

function normalizeWallComplexityTypeId(
  value: unknown,
  catalogs: EstimateCatalogsPayload
) {
  const raw = toText(value).trim().toUpperCase()
  const available = new Set(
    catalogs.catalogs.wall_complexity_types.map((row) => row.id.toUpperCase())
  )
  if (!raw) return defaultWallComplexityTypeId(catalogs)
  if (available.size === 0) return raw
  return available.has(raw) ? raw : defaultWallComplexityTypeId(catalogs)
}

function normalizeWallsCalcMethod(value: unknown): SegmentDraft['walls_calc_method'] {
  const raw = toText(value).trim().toUpperCase()
  if (raw === 'PANEL') return 'PANEL'
  return 'REGULAR'
}

function trimCategoryFromOption(option: TrimItemOption) {
  const raw = toText(option.category)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (raw) {
    if (raw === 'windowcasing') return 'window_casing'
    if (raw === 'doorcasing') return 'door_casing'
    if (raw === 'baseboard') return 'baseboard'
    if (raw === 'crown') return 'crown'
    if (raw === 'door' || raw.startsWith('door')) return 'door'
    return raw
  }
  const label = `${option.id} ${option.label}`.toLowerCase()
  if (label.includes('window') && label.includes('casing')) return 'window_casing'
  if (label.includes('door') && label.includes('casing')) return 'door_casing'
  if (label.includes('baseboard') || label.includes('base board')) return 'baseboard'
  if (label.includes('crown')) return 'crown'
  if (label.includes('door')) return 'door'
  return ''
}

function trimSizeRank(option: TrimItemOption) {
  const raw = `${toText(option.size)} ${option.label}`.toLowerCase()
  if (raw.includes('large') || raw.includes('lg')) return 4
  if (raw.includes('medium')) return 3
  if (raw.includes('standard') || raw.includes('normal')) return 2
  if (raw.includes('6 panel') || raw.includes('6-panel')) return 5
  if (raw.includes('window') && !raw.includes('casing')) return 6
  if (raw.includes('flat')) return 1
  return 0
}

function trimOptionsByCategory(options: TrimItemOption[], category: string) {
  return options
    .filter((item) => item.is_active !== false && item.active !== 'N')
    .filter((item) => trimCategoryFromOption(item) === category)
    .sort((a, b) => trimSizeRank(a) - trimSizeRank(b) || a.label.localeCompare(b.label))
}

function firstTrimOptionByCategory(options: TrimItemOption[], category: string) {
  return trimOptionsByCategory(options, category)[0]?.id ?? ''
}

function normalizeJobSettings(row: Record<string, unknown> | null): JobSettingsDraft {
  const fallbackPrimerId = toText(row?.primer_id)
  return {
    walls_paint_id: toText(row?.walls_paint_id),
    ceiling_paint_id: toText(row?.ceiling_paint_id),
    trim_paint_id: toText(row?.trim_paint_id),
    primer_id: fallbackPrimerId,
    walls_primer_id: toText(row?.walls_primer_id || row?.wall_primer_product_id),
    ceiling_primer_id: toText(row?.ceiling_primer_id || row?.ceiling_primer_product_id),
    trim_primer_id: toText(row?.trim_primer_id || row?.trim_primer_product_id),
    override_labor_rate: toNumString(row?.override_labor_rate),
    override_markup: toNumString(row?.override_markup),
    rounding_increment_hours: toNumString(row?.rounding_increment_hours),
    dayhours: toNumString(row?.dayhours),
    default_walls_prep_level: toText(row?.default_walls_prep_level) || 'Light',
    default_ceiling_prep_level: toText(row?.default_ceiling_prep_level) || 'Light',
    default_trim_prep_level: toText(row?.default_trim_prep_level) || 'Light',
    walls_paint_gal_override: toNumString(row?.walls_paint_gal_override),
    ceiling_paint_gal_override: toNumString(row?.ceiling_paint_gal_override),
    primer_gal_override: toNumString(row?.primer_gal_override),
    extra_supplies_walls: toNumString(row?.extra_supplies_walls),
    extra_supplies_ceilings: toNumString(row?.extra_supplies_ceilings),
    extra_supplies_trim: toNumString(row?.extra_supplies_trim),
    trim_paint_qty: toNumString(row?.trim_paint_qty),
    trim_paint_uom: toText(row?.trim_paint_uom),
    trim_primer_qty: toNumString(row?.trim_primer_qty),
    trim_primer_uom: toText(row?.trim_primer_uom),
    notes: toText(row?.notes),
  }
}

function normalizeRoom(row: Record<string, unknown>, catalogs: EstimateCatalogsPayload): RoomDraft {
  const wallsInclude = toYN(row.walls_include, 'N')
  const ceilingInclude = toYN(row.ceiling_include, 'N')
  const trimInclude = toYN(row.trim_include, 'N')
  const wallColor = wallsInclude === 'Y' ? normalizeColorId(toText(row.wall_color_id)) : ''
  const defaultColor = catalogs.catalogs.color_codes[0]?.id ?? 'A'
  const trimOptions = (
    (catalogs.catalogs.trim_menu_items?.length
      ? catalogs.catalogs.trim_menu_items
      : catalogs.catalogs.trim_items) ?? []
  ).filter((item) => item.is_active !== false && item.active !== 'N')
  const legacyBase = toYN(row.paint_base, 'N') === 'Y'
  const legacyCrown = toYN(row.paint_crown, 'N') === 'Y'
  const legacyWindow = toYN(row.paint_window_casing, 'N') === 'Y'
  const legacyDoorCasing = toYN(row.paint_door_casing, 'N') === 'Y'
  const legacyDoors = toYN(row.paint_doors, 'N') === 'Y'
  const baseboardTypeId = toText(row.baseboard_type_id) || (legacyBase ? firstTrimOptionByCategory(trimOptions, 'baseboard') : '')
  const crownTypeId = toText(row.crown_type_id) || (legacyCrown ? firstTrimOptionByCategory(trimOptions, 'crown') : '')
  const windowTypeId =
    toText(row.window_casing_type_id) ||
    (legacyWindow ? firstTrimOptionByCategory(trimOptions, 'window_casing') : '')
  const doorCasingTypeId =
    toText(row.door_casing_type_id) ||
    (legacyDoorCasing ? firstTrimOptionByCategory(trimOptions, 'door_casing') : '')
  const doorTypeId =
    toText(row.door_type_id) ||
    (legacyDoors ? firstTrimOptionByCategory(trimOptions, 'door') : '')
  const legacyDoorCount = toNumString(row.door_count)
  return {
    id: toText(row.id) || undefined,
    room_id: toText(row.room_id) || '',
    room_name: toText(row.room_name),
    mode: toText(row.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT',
    length_in: toNumString(row.length_in),
    width_in: toNumString(row.width_in),
    wallheight_in: toNumString(row.wallheight_in),
    ceilingheight_in: toNumString(row.ceilingheight_in ?? row.wallheight_in),
    ceilingsqft_override: toNumString(row.ceilingsqft_override),
    baseexclude_in: toNumString(row.baseexclude_in),
    walls_include: wallsInclude,
    walls_primer: toText(row.walls_primer),
    walls_topcoats: toNumString(row.walls_topcoats) || (wallsInclude === 'Y' ? '2' : ''),
    walls_prep_override: toText(row.walls_prep_override),
    walls_prep_level: toText(row.walls_prep_level ?? row.walls_prep_override),
    wall_sqft_override: toNumString(row.wall_sqft_override),
    openings_sqft: toNumString(row.openings_sqft),
    walls_notes: toText(row.walls_notes),
    ceiling_include: ceilingInclude,
    ceiling_primer: toText(row.ceiling_primer),
    ceiling_topcoats: toNumString(row.ceiling_topcoats) || (ceilingInclude === 'Y' ? '2' : ''),
    ceiling_prep_level: toText(row.ceiling_prep_level || row.ceiling_prep_override),
    ceiling_prep_override: toText(row.ceiling_prep_override),
    ceiling_height_surcharge: toNumString(row.ceiling_height_surcharge),
    trim_include: trimInclude,
    trim_primer: normalizePrimerMode(row.trim_primer),
    trim_topcoats: toNumString(row.trim_topcoats) || (trimInclude === 'Y' ? '2' : ''),
    trim_prep_override: toText(row.trim_prep_override),
    doors_prep_override: toText(row.doors_prep_override || row.trim_prep_override),
    baseboard_primer_mode: '',
    baseboard_spot_prime_pct: '',
    baseboard_prep_override: '',
    baseboard_type_id: baseboardTypeId,
    baseboard_lf: toNumString(row.baseboard_lf),
    baseboard_auto: toYN(row.baseboard_auto, toYN(row.auto_calc_trim_perimeter, 'N')),
    crown_primer_mode: '',
    crown_spot_prime_pct: '',
    crown_prep_override: '',
    crown_type_id: crownTypeId,
    crown_lf: toNumString(row.crown_lf),
    crown_auto: toYN(row.crown_auto, toYN(row.auto_calc_trim_perimeter, 'N')),
    window_casing_primer_mode: '',
    window_casing_spot_prime_pct: '',
    window_casing_prep_override: '',
    window_casing_type_id: windowTypeId,
    window_count: toNumString(row.window_count),
    door_casing_primer_mode: '',
    door_casing_spot_prime_pct: '',
    door_casing_prep_override: '',
    door_casing_type_id: doorCasingTypeId,
    door_casing_count: toNumString(row.door_casing_count ?? legacyDoorCount),
    door_primer_mode: '',
    door_spot_prime_pct: '',
    door_prep_override: '',
    door_type_id: doorTypeId,
    door_paint_count: toNumString(row.door_paint_count ?? legacyDoorCount),
    door_sides: toNumString(row.door_sides) || (doorTypeId ? '1' : ''),
    door_count: legacyDoorCount,
    auto_calc_trim_perimeter: toYN(row.auto_calc_trim_perimeter, 'N'),
    wall_color_id: wallColor || defaultColor,
    ceiling_type_id: toText(row.ceiling_type_id) || (ceilingInclude === 'Y' ? defaultCeilingTypeId(catalogs) : ''),
  }
}

function normalizeSegment(row: Record<string, unknown>, catalogs: EstimateCatalogsPayload): SegmentDraft {
  return {
    id: toText(row.id) || undefined,
    room_id: toText(row.room_id),
    seg_no: toNumString(row.seg_no),
    seglen_in: toNumString(row.seglen_in),
    seg_wallheight_in: toNumString(row.seg_wallheight_in ?? row.segwallheight_in ?? row.seg_wall_height_in),
    wall_complexity_type_id: normalizeWallComplexityTypeId(row.wall_complexity_type_id, catalogs),
    walls_calc_method: normalizeWallsCalcMethod(
      row.walls_calc_method ?? row.wallscalcmethod ?? row.walls_calcmode ?? row.walls_calcmethod
    ),
    panel_length_in: toNumString(row.panel_length_in ?? row.length_in),
    panel_height_bottom_in: toNumString(
      row.panel_height_bottom_in ?? row.height_bottom_in ?? row.bottom_height_in
    ),
    panel_height_top_in: toNumString(
      row.panel_height_top_in ?? row.height_top_in ?? row.top_height_in
    ),
    baseexclude_in: toNumString(row.baseexclude_in),
    wall_color_override_id: normalizeColorId(toText(row.wall_color_override_id)),
    wall_label: toText(row.wall_label),
    notes: toText(row.notes),
    active: toYN(row.active, 'Y'),
  }
}

function normalizeCeilingSegment(row: Record<string, unknown>): CeilingSegmentDraft {
  return {
    id: toText(row.id) || undefined,
    room_id: toText(row.room_id),
    seg_no: toNumString(row.seg_no),
    length_in: toNumString(row.length_in),
    width_in: toNumString(row.width_in),
    ceiling_height_in: toNumString(
      row.ceiling_height_in ??
        row.ceilingheight_in ??
        row.height_in ??
        row.seg_ceiling_height_in ??
        row.segceilingheight_in
    ),
    notes: toText(row.notes),
    active: toYN(row.active, 'Y'),
  }
}

function normalizePreJob(row: Record<string, unknown>): PreJobDraft {
  return {
    id: toText(row.id) || undefined,
    trip_num: toNumString(row.trip_num),
    rollup_scope: toText(row.rollup_scope || row.category || 'Walls'),
    task_template_id: toText(row.task_template_id),
    task_name: toText(row.task_name || row.task_label || row.task),
    manual_task_name: toText(row.manual_task_name || row.man_trip_name),
    qty: toNumString(row.qty ?? row.man_qty),
    hours_each: toNumString(row.hours_each ?? row.man_hours_each),
    extra_supplies: toNumString(row.extra_supplies),
    notes: toText(row.notes),
    active: toYN(row.active, 'Y'),
  }
}

function normalizeTaskLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function toTripScope(value: string): PreJobTaskDraft['rollup_scope'] {
  const v = value.trim().toLowerCase()
  if (v === 'walls') return 'Walls'
  if (v === 'ceilings' || v === 'ceiling') return 'Ceilings'
  if (v === 'trim') return 'Trim'
  return 'Walls'
}

function groupPreJobTrips(
  rows: PreJobDraft[],
  templateTaskById: Map<string, string>,
  templateIdByLabel: Map<string, string>
): PreJobTripDraft[] {
  const grouped = new Map<string, PreJobTripDraft>()
  rows.forEach((row, idx) => {
    const tripKey = row.trip_num || String(idx + 1)
    if (!grouped.has(tripKey)) {
      grouped.set(tripKey, {
        id: `trip-${tripKey}-${idx}`,
        trip_num: tripKey,
        notes: row.notes || '',
        tasks: [],
      })
    }
    const trip = grouped.get(tripKey)!
    const rowTaskName = toText(row.task_name)
    const inferredTemplateId =
      !toText(row.task_template_id) && !toText(row.manual_task_name)
        ? templateIdByLabel.get(normalizeTaskLabel(rowTaskName)) || ''
        : ''
    const templateId = toText(row.task_template_id) || inferredTemplateId
    const templateTaskName = templateId ? toText(templateTaskById.get(templateId)) : ''
    const displayTaskName = rowTaskName || row.manual_task_name || templateTaskName
    trip.tasks.push({
      id: row.id || `task-${tripKey}-${idx}`,
      mode: templateId ? 'template' : 'manual',
      rollup_scope: toTripScope(row.rollup_scope),
      task_template_id: templateId || '',
      task_name: displayTaskName || '',
      manual_task_name: row.manual_task_name || '',
      qty: row.qty || '',
      hours_each: row.hours_each || '',
      extra_supplies: row.extra_supplies || '',
    })
  })

  return Array.from(grouped.values()).sort((a, b) => Number(a.trip_num) - Number(b.trip_num))
}

function flattenPreJobTrips(
  trips: PreJobTripDraft[],
  templateTaskById: Map<string, string>
): PreJobDraft[] {
  return trips.flatMap((trip) =>
    trip.tasks.map((task) => {
      const taskTemplateId = task.mode === 'template' ? task.task_template_id || '' : ''
      const templateTaskName = taskTemplateId ? toText(templateTaskById.get(taskTemplateId)) : ''
      const taskName =
        task.mode === 'template'
          ? task.task_name || task.manual_task_name || templateTaskName || ''
          : task.manual_task_name || task.task_name || ''

      return {
        trip_num: trip.trip_num,
        rollup_scope: task.rollup_scope,
        task_template_id: taskTemplateId,
        task_name: taskName,
        manual_task_name: task.mode === 'manual' ? taskName : '',
        qty: task.qty,
        hours_each: task.hours_each,
        extra_supplies: task.extra_supplies,
        notes: trip.notes || '',
        active: 'Y',
      }
    })
  )
}

function buildTrimItemsFromRooms(
  rooms: RoomDraft[],
  extraDoorRows: Record<string, ExtraTrimDraft[]>,
  extraDoorCasingRows: Record<string, ExtraTrimDraft[]>,
  extraWindowCasingRows: Record<string, ExtraTrimDraft[]>
): TrimItemDraft[] {
  const rows: TrimItemDraft[] = []
  const asNum = (v: string) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  rooms.forEach((room) => {
    if (room.trim_include !== 'Y') return
    const baseboardLf = asNum(room.baseboard_lf)
    const crownLf = asNum(room.crown_lf)
    const windowCount = asNum(room.window_count)
    const doorCasingCount = asNum(room.door_casing_count)
    const doorPaintCount = asNum(room.door_paint_count)
    const pushIf = (
      ok: boolean,
      trimMenuId: string,
      qty: number,
      notes = '',
      doorSides = '',
      coats = room.trim_topcoats || '',
      autoCalc: 'Y' | 'N' = 'N',
      primerMode = room.trim_primer || '',
      spotPrimePct = '',
      prepLevelOverride = room.trim_prep_override || ''
    ) => {
      if (!ok || !trimMenuId || qty <= 0) return
      const normalizedPrimerMode = normalizePrimerMode(primerMode)
      rows.push({
        room_id: room.room_id,
        trim_menu_id: trimMenuId,
        qty: String(qty),
        coats,
        auto_calc: autoCalc,
        primer_mode: normalizedPrimerMode,
        spot_prime_pct: normalizedPrimerMode === 'Spot' ? spotPrimePct : '',
        prep_level_override: prepLevelOverride,
        door_sides: doorSides,
        notes,
      })
    }
    const baseboardAutoCalc: 'Y' | 'N' =
      room.mode === 'RECT' && room.baseboard_auto === 'Y' ? 'Y' : 'N'
    const crownAutoCalc: 'Y' | 'N' = room.mode === 'RECT' && room.crown_auto === 'Y' ? 'Y' : 'N'
    pushIf(
      !!room.baseboard_type_id,
      room.baseboard_type_id,
      baseboardLf,
      '',
      '',
      room.trim_topcoats || '',
      baseboardAutoCalc,
      room.baseboard_primer_mode || room.trim_primer || '',
      room.baseboard_spot_prime_pct || '',
      room.baseboard_prep_override || room.trim_prep_override || ''
    )
    pushIf(
      !!room.crown_type_id,
      room.crown_type_id,
      crownLf,
      '',
      '',
      room.trim_topcoats || '',
      crownAutoCalc,
      room.crown_primer_mode || room.trim_primer || '',
      room.crown_spot_prime_pct || '',
      room.crown_prep_override || room.trim_prep_override || ''
    )
    pushIf(
      !!room.window_casing_type_id,
      room.window_casing_type_id,
      windowCount,
      '',
      '',
      room.trim_topcoats || '',
      'N',
      room.window_casing_primer_mode || room.trim_primer || '',
      room.window_casing_spot_prime_pct || '',
      room.window_casing_prep_override || room.trim_prep_override || ''
    )
    pushIf(
      !!room.door_casing_type_id,
      room.door_casing_type_id,
      doorCasingCount,
      '',
      '',
      room.trim_topcoats || '',
      'N',
      room.door_casing_primer_mode || room.trim_primer || '',
      room.door_casing_spot_prime_pct || '',
      room.door_casing_prep_override || room.trim_prep_override || ''
    )
    pushIf(
      !!room.door_type_id,
      room.door_type_id,
      doorPaintCount,
      '',
      room.door_sides || '1',
      room.trim_topcoats || '',
      'N',
      room.door_primer_mode || room.trim_primer || '',
      room.door_spot_prime_pct || '',
      room.door_prep_override || room.doors_prep_override || room.trim_prep_override || ''
    )
    const doorExtras = extraDoorRows[room.room_id] ?? []
    doorExtras.forEach((extra) => {
      const qty = asNum(extra.qty)
      pushIf(
        !!extra.trim_menu_id,
        extra.trim_menu_id,
        qty,
        extra.notes,
        extra.door_sides || '1',
        extra.coats || room.trim_topcoats || '',
        extra.auto_calc || 'N',
        extra.primer_mode || room.trim_primer || '',
        extra.spot_prime_pct || '',
        extra.prep_level_override ||
          room.door_prep_override ||
          room.doors_prep_override ||
          room.trim_prep_override ||
          ''
      )
    })
    const doorCasingExtras = extraDoorCasingRows[room.room_id] ?? []
    doorCasingExtras.forEach((extra) => {
      const qty = asNum(extra.qty)
      pushIf(
        !!extra.trim_menu_id,
        extra.trim_menu_id,
        qty,
        extra.notes,
        '',
        extra.coats || room.trim_topcoats || '',
        extra.auto_calc || 'N',
        extra.primer_mode || room.trim_primer || '',
        extra.spot_prime_pct || '',
        extra.prep_level_override ||
          room.door_casing_prep_override ||
          room.trim_prep_override ||
          ''
      )
    })
    const windowCasingExtras = extraWindowCasingRows[room.room_id] ?? []
    windowCasingExtras.forEach((extra) => {
      const qty = asNum(extra.qty)
      pushIf(
        !!extra.trim_menu_id,
        extra.trim_menu_id,
        qty,
        extra.notes,
        '',
        extra.coats || room.trim_topcoats || '',
        extra.auto_calc || 'N',
        extra.primer_mode || room.trim_primer || '',
        extra.spot_prime_pct || '',
        extra.prep_level_override ||
          room.window_casing_prep_override ||
          room.trim_prep_override ||
          ''
      )
    })
  })
  return rows
}

function buildRollersFromEngine(
  engine: EngineColorList | null | undefined,
  existingRows: Record<string, unknown>[],
  includeCeiling: boolean,
  roomWallColorIds: string[]
): RollerDraft[] {
  const existing = (existingRows ?? []).filter((row) => toYN(row.active, 'Y') === 'Y')
  const existingMap = new Map<string, Record<string, unknown>>(
    existing.map((row) => [
      `${toText(row.scope)}:${toText(row.wall_color_id)}`,
      row as Record<string, unknown>,
    ])
  )
  const engineWallMap = new Map(
    (engine?.wall_colors ?? [])
      .map((row) => [normalizeColorId(toText(row.wall_color_id)), row] as const)
      .filter(([id]) => !!id)
  )
  const wallColorIds = Array.from(new Set([...engineWallMap.keys(), ...roomWallColorIds]))
  const wallRows = wallColorIds.map((wallColorId) => {
    const key = `Wall:${wallColorId}`
    const prior = existingMap.get(key)
    const engineRow = engineWallMap.get(wallColorId)
    return {
      id: toText(prior?.id) || undefined,
      scope: 'Wall' as const,
      wall_color_id: wallColorId,
      wall_sqft: engineRow?.wall_sqft ?? null,
      roller_size_in: toNumString(prior?.roller_size_in ?? engineRow?.roller_size_in_selected),
      covers_qty: toNumString(prior?.covers_qty ?? engineRow?.covers_qty_selected),
      notes: toText(prior?.notes),
      active: 'Y' as const,
    }
  })
  if (!includeCeiling) {
    return wallRows
  }
  const ceilingExisting = existingMap.get('Ceiling:')
  const ceilingRow: RollerDraft = {
    id: toText(ceilingExisting?.id) || undefined,
    scope: 'Ceiling',
    wall_color_id: '',
    roller_size_in: toNumString(
      ceilingExisting?.roller_size_in ?? engine?.ceiling_roller?.roller_size_in
    ),
    covers_qty: toNumString(ceilingExisting?.covers_qty ?? engine?.ceiling_roller?.covers_qty),
    notes: toText(ceilingExisting?.notes),
    active: 'Y',
  }
  return [...wallRows, ceilingRow]
}

export default function EstimateEditorPage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const estimateId = Array.isArray(rawId) ? rawId[0] : rawId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missingInputs, setMissingInputs] = useState<MissingInputIssue[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Job Settings')
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [dirtyTick, setDirtyTick] = useState(0)
  const [estimate, setEstimate] = useState<EstimatePayload['estimate'] | null>(null)
  const [jobsettings, setJobsettings] = useState<JobSettingsDraft>(normalizeJobSettings(null))
  const [rooms, setRooms] = useState<RoomDraft[]>([])
  const [roomScopesOpen, setRoomScopesOpen] = useState<Record<string, { walls: boolean; ceilings: boolean; trim: boolean }>>({})
  const [segments, setSegments] = useState<SegmentDraft[]>([])
  const [ceilingSegments, setCeilingSegments] = useState<CeilingSegmentDraft[]>([])
  const [prejobTrips, setPrejobTrips] = useState<PreJobTripDraft[]>([])
  const [rollersDraft, setRollersDraft] = useState<RollerDraft[]>([])
  const [extraDoorRows, setExtraDoorRows] = useState<Record<string, ExtraTrimDraft[]>>({})
  const [extraDoorCasingRows, setExtraDoorCasingRows] = useState<Record<string, ExtraTrimDraft[]>>({})
  const [extraWindowCasingRows, setExtraWindowCasingRows] = useState<Record<string, ExtraTrimDraft[]>>({})
  const [catalogs, setCatalogs] = useState<EstimateCatalogsPayload>(emptyCatalogs)
  const [engineColorList, setEngineColorList] = useState<EngineColorList | null>(null)
  const [addSegmentRoom, setAddSegmentRoom] = useState('')
  const [addCeilingSegmentRoom, setAddCeilingSegmentRoom] = useState('')
  const [wallSegmentsOpen, setWallSegmentsOpen] = useState(true)
  const [ceilingSegmentsOpen, setCeilingSegmentsOpen] = useState(true)
  const [advancedAdjustmentsOpen, setAdvancedAdjustmentsOpen] = useState(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async (forceRefresh = false) => {
    if (!estimateId) return
    setLoading(true)
    setError(null)
    setMissingInputs([])

    const [estimateRes, catalogsRes, engineRes] = await Promise.all([
      authedFetch(`/api/estimates/${estimateId}`, { cache: 'no-store' }),
      authedFetch(
        `/api/estimates/${estimateId}/catalogs${forceRefresh ? '?refresh=1' : ''}`,
        { cache: 'no-store' }
      ),
      authedFetch(`/api/estimates/${estimateId}/engine-color-list`, { cache: 'no-store' }),
    ])

    const estimatePayload = (await estimateRes.json().catch(() => null)) as
      | EstimatePayload
      | { error?: string }
      | null
    if (!estimateRes.ok || !estimatePayload || !('estimate' in estimatePayload)) {
      setError((estimatePayload as { error?: string } | null)?.error ?? estimateRes.statusText)
      setLoading(false)
      return
    }

    const catalogsPayload = (await catalogsRes.json().catch(() => null)) as
      | EstimateCatalogsPayload
      | { error?: string }
      | null
    const nextCatalogs =
      catalogsRes.ok && catalogsPayload && 'catalogs' in catalogsPayload
        ? catalogsPayload
        : emptyCatalogs
    if (!catalogsRes.ok) {
      setError((catalogsPayload as { error?: string } | null)?.error ?? catalogsRes.statusText)
    }

    const enginePayload = (await engineRes.json().catch(() => null)) as
      | { engine_color_list?: EngineColorList | null }
      | { error?: string }
      | null
    const engine =
      engineRes.ok && enginePayload && 'engine_color_list' in enginePayload
        ? (enginePayload.engine_color_list ?? null)
        : (estimatePayload.estimate.latest_output_json?.engine_color_list ?? null)

    const normalizedRooms = estimatePayload.inputs.rooms.map((row) => normalizeRoom(row, nextCatalogs))
    const nextTrimMenuOptions = (
      (nextCatalogs.catalogs.trim_menu_items?.length
        ? nextCatalogs.catalogs.trim_menu_items
        : nextCatalogs.catalogs.trim_items) ?? []
    ).filter((item) => item.is_active !== false && item.active !== 'N')
    const doorTrimMenuIds = new Set(
      nextTrimMenuOptions
        .filter((item) => trimCategoryFromOption(item) === 'door')
        .map((item) => item.id)
    )
    const doorCasingTrimMenuIds = new Set(
      nextTrimMenuOptions
        .filter((item) => trimCategoryFromOption(item) === 'door_casing')
        .map((item) => item.id)
    )
    const windowCasingTrimMenuIds = new Set(
      nextTrimMenuOptions
        .filter((item) => trimCategoryFromOption(item) === 'window_casing')
        .map((item) => item.id)
    )
    const extrasDoorsByRoom: Record<string, ExtraTrimDraft[]> = {}
    const extrasDoorCasingByRoom: Record<string, ExtraTrimDraft[]> = {}
    const extrasWindowCasingByRoom: Record<string, ExtraTrimDraft[]> = {}
    ;(estimatePayload.inputs.trim_items ?? []).forEach((row, idx) => {
      const roomId = toText(row.room_id)
      const trimMenuId = toText(row.trim_menu_id)
      if (!roomId || !trimMenuId) return
      const room = normalizedRooms.find((r) => r.room_id === roomId)
      const primerMode = normalizePrimerMode(row.primer_mode)
      const spotPrimePct = toNumString(row.spot_prime_pct)
      const prepLevelOverride = toText(row.prep_level_override)
      if (doorTrimMenuIds.has(trimMenuId)) {
        if (room?.door_type_id && room.door_type_id === trimMenuId) {
          room.door_primer_mode = primerMode
          room.door_spot_prime_pct = spotPrimePct
          room.door_prep_override = prepLevelOverride
          return
        }
        if (!extrasDoorsByRoom[roomId]) extrasDoorsByRoom[roomId] = []
        extrasDoorsByRoom[roomId].push({
          local_id: `${roomId}-door-${trimMenuId}-${idx}`,
          room_id: roomId,
          trim_menu_id: trimMenuId,
          qty: toNumString(row.qty),
          coats: toNumString(row.coats),
          auto_calc: toYN(row.auto_calc, 'N'),
          primer_mode: primerMode,
          spot_prime_pct: spotPrimePct,
          prep_level_override: prepLevelOverride,
          door_sides: toNumString(row.door_sides) || '1',
          notes: toText(row.notes),
        })
        return
      }
      if (doorCasingTrimMenuIds.has(trimMenuId)) {
        if (room?.door_casing_type_id && room.door_casing_type_id === trimMenuId) {
          room.door_casing_primer_mode = primerMode
          room.door_casing_spot_prime_pct = spotPrimePct
          room.door_casing_prep_override = prepLevelOverride
          return
        }
        if (!extrasDoorCasingByRoom[roomId]) extrasDoorCasingByRoom[roomId] = []
        extrasDoorCasingByRoom[roomId].push({
          local_id: `${roomId}-door-casing-${trimMenuId}-${idx}`,
          room_id: roomId,
          trim_menu_id: trimMenuId,
          qty: toNumString(row.qty),
          coats: toNumString(row.coats),
          auto_calc: toYN(row.auto_calc, 'N'),
          primer_mode: primerMode,
          spot_prime_pct: spotPrimePct,
          prep_level_override: prepLevelOverride,
          door_sides: '',
          notes: toText(row.notes),
        })
        return
      }
      if (windowCasingTrimMenuIds.has(trimMenuId)) {
        if (room?.window_casing_type_id && room.window_casing_type_id === trimMenuId) {
          room.window_casing_primer_mode = primerMode
          room.window_casing_spot_prime_pct = spotPrimePct
          room.window_casing_prep_override = prepLevelOverride
          return
        }
        if (!extrasWindowCasingByRoom[roomId]) extrasWindowCasingByRoom[roomId] = []
        extrasWindowCasingByRoom[roomId].push({
          local_id: `${roomId}-window-casing-${trimMenuId}-${idx}`,
          room_id: roomId,
          trim_menu_id: trimMenuId,
          qty: toNumString(row.qty),
          coats: toNumString(row.coats),
          auto_calc: toYN(row.auto_calc, 'N'),
          primer_mode: primerMode,
          spot_prime_pct: spotPrimePct,
          prep_level_override: prepLevelOverride,
          door_sides: '',
          notes: toText(row.notes),
        })
        return
      }
      if (room?.baseboard_type_id && room.baseboard_type_id === trimMenuId) {
        room.baseboard_primer_mode = primerMode
        room.baseboard_spot_prime_pct = spotPrimePct
        room.baseboard_prep_override = prepLevelOverride
        return
      }
      if (room?.crown_type_id && room.crown_type_id === trimMenuId) {
        room.crown_primer_mode = primerMode
        room.crown_spot_prime_pct = spotPrimePct
        room.crown_prep_override = prepLevelOverride
      }
    })
    const hasCeilingsInRooms = normalizedRooms.some((r) => r.ceiling_include === 'Y')

    setCatalogs(nextCatalogs)
    setEstimate(estimatePayload.estimate)
    setEngineColorList(engine)
    const nextJobsettings = normalizeJobSettings(estimatePayload.inputs.jobsettings)
    if (!nextJobsettings.override_labor_rate && nextCatalogs.defaults.override_labor_rate != null) {
      nextJobsettings.override_labor_rate = String(nextCatalogs.defaults.override_labor_rate)
    }
    if (!nextJobsettings.override_markup && nextCatalogs.defaults.override_markup != null) {
      nextJobsettings.override_markup = String(nextCatalogs.defaults.override_markup)
    }
    if (
      !nextJobsettings.rounding_increment_hours &&
      nextCatalogs.defaults.rounding_increment_hours != null
    ) {
      nextJobsettings.rounding_increment_hours = String(nextCatalogs.defaults.rounding_increment_hours)
    }
    if (!nextJobsettings.dayhours && nextCatalogs.defaults.dayhours != null) {
      nextJobsettings.dayhours = String(nextCatalogs.defaults.dayhours)
    }
    if (!nextJobsettings.default_walls_prep_level) nextJobsettings.default_walls_prep_level = 'Light'
    if (!nextJobsettings.default_ceiling_prep_level) nextJobsettings.default_ceiling_prep_level = 'Light'
    if (!nextJobsettings.default_trim_prep_level) nextJobsettings.default_trim_prep_level = 'Light'
    const roomsWithPrepDefaults = normalizedRooms.map((room) => ({
      ...room,
      walls_prep_override:
        room.walls_prep_override ||
        (room.walls_include === 'Y' ? nextJobsettings.default_walls_prep_level : ''),
      walls_prep_level:
        room.walls_prep_level ||
        room.walls_prep_override ||
        (room.walls_include === 'Y' ? nextJobsettings.default_walls_prep_level : ''),
      ceiling_prep_override:
        room.ceiling_prep_override ||
        (room.ceiling_include === 'Y' ? nextJobsettings.default_ceiling_prep_level : ''),
      ceiling_prep_level:
        room.ceiling_prep_level ||
        room.ceiling_prep_override ||
        (room.ceiling_include === 'Y' ? nextJobsettings.default_ceiling_prep_level : ''),
      trim_prep_override:
        room.trim_prep_override ||
        (room.trim_include === 'Y' ? nextJobsettings.default_trim_prep_level : ''),
      doors_prep_override:
        room.doors_prep_override ||
        (room.trim_include === 'Y' ? nextJobsettings.default_trim_prep_level : ''),
    }))
    setJobsettings(nextJobsettings)
    setRooms(roomsWithPrepDefaults)
    setRoomScopesOpen(
      Object.fromEntries(
        roomsWithPrepDefaults.map((room) => [
          room.room_id,
          { walls: false, ceilings: false, trim: false },
        ])
      )
    )
    setExtraDoorRows(extrasDoorsByRoom)
    setExtraDoorCasingRows(extrasDoorCasingByRoom)
    setExtraWindowCasingRows(extrasWindowCasingByRoom)
    const normalizedSegments = estimatePayload.inputs.segments.map((row) =>
      normalizeSegment(row, nextCatalogs)
    )
    setSegments(normalizedSegments)
    const normalizedCeilingSegments = (estimatePayload.inputs.ceiling_segments ?? []).map((row) =>
      normalizeCeilingSegment(row)
    )
    setCeilingSegments(normalizedCeilingSegments)
    const templateTaskById = new Map(
      (nextCatalogs.catalogs.prejob_trips ?? []).map((option) => [
        option.id,
        (option.task || option.label || option.man_trip_name || option.trip_name || option.id).trim(),
      ])
    )
    const templateIdByLabel = new Map(
      (nextCatalogs.catalogs.prejob_trips ?? []).map((option) => [
        normalizeTaskLabel(
          (option.task || option.label || option.man_trip_name || option.trip_name || option.id).trim()
        ),
        option.id,
      ])
    )
    setPrejobTrips(
      groupPreJobTrips(
        estimatePayload.inputs.prejob.map((row) => normalizePreJob(row)),
        templateTaskById,
        templateIdByLabel
      )
    )
    setRollersDraft(
      buildRollersFromEngine(
        engine,
        estimatePayload.inputs.rollers,
        hasCeilingsInRooms,
        (() => {
          const roomIdsWithWalls = new Set(
            normalizedRooms
              .filter((room) => room.walls_include === 'Y')
              .map((room) => room.room_id)
          )
          const roomWallColors = normalizedRooms
            .filter((room) => room.walls_include === 'Y')
            .map((room) => normalizeColorId(room.wall_color_id))
            .filter(Boolean)
          const segmentOverrideColors = normalizedSegments
            .filter((seg) => toYN(seg.active, 'Y') === 'Y' && roomIdsWithWalls.has(seg.room_id))
            .map((seg) => normalizeColorId(seg.wall_color_override_id))
            .filter(Boolean)
          return Array.from(new Set([...roomWallColors, ...segmentOverrideColors]))
        })()
      )
    )
    setAddSegmentRoom('')
    setAddCeilingSegmentRoom('')

    setLoading(false)
    setLoadedOnce(true)
  }

  useEffect(() => {
    void load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId])

  const queueSave = () => {
    if (!loadedOnce) return
    setDirtyTick((v) => v + 1)
  }

  const trimMenuOptions = (
    (catalogs.catalogs.trim_menu_items?.length
      ? catalogs.catalogs.trim_menu_items
      : catalogs.catalogs.trim_items) ?? []
  ).filter((item) => item.is_active !== false && item.active !== 'N')
  const baseboardOptions = useMemo(() => trimOptionsByCategory(trimMenuOptions, 'baseboard'), [trimMenuOptions])
  const crownOptions = useMemo(() => trimOptionsByCategory(trimMenuOptions, 'crown'), [trimMenuOptions])
  const windowCasingOptions = useMemo(
    () => trimOptionsByCategory(trimMenuOptions, 'window_casing'),
    [trimMenuOptions]
  )
  const doorCasingOptions = useMemo(
    () => trimOptionsByCategory(trimMenuOptions, 'door_casing'),
    [trimMenuOptions]
  )
  const doorTypeOptions = useMemo(() => trimOptionsByCategory(trimMenuOptions, 'door'), [trimMenuOptions])
  const preJobTripOptions = useMemo(
    () =>
      (catalogs.catalogs.prejob_trips ?? [])
        .filter((row) => row.active !== 'N')
        .sort((a, b) => {
          const ac = (a.rollup_scope ?? a.category ?? '').localeCompare(b.rollup_scope ?? b.category ?? '')
          if (ac !== 0) return ac
          return (a.task ?? a.man_trip_name ?? a.trip_name ?? a.label).localeCompare(
            b.task ?? b.man_trip_name ?? b.trip_name ?? b.label
          )
        }),
    [catalogs.catalogs.prejob_trips]
  )
  const preJobTemplateTaskById = useMemo(
    () =>
      new Map(
        preJobTripOptions.map((option) => [
          option.id,
          (option.task || option.label || option.man_trip_name || option.trip_name || option.id).trim(),
        ])
      ),
    [preJobTripOptions]
  )
  const generatedTrimItems = useMemo(
    () => buildTrimItemsFromRooms(rooms, extraDoorRows, extraDoorCasingRows, extraWindowCasingRows),
    [rooms, extraDoorRows, extraDoorCasingRows, extraWindowCasingRows]
  )
  const buildJobsettingsForSave = useCallback(() => {
    const saveNeedsWallsPrimer = rooms.some((r) => {
      if (r.walls_include !== 'Y') return false
      const upper = r.walls_primer.trim().toUpperCase()
      return !!upper && upper !== 'NONE'
    })
    const saveNeedsCeilingPrimer = rooms.some((r) => {
      if (r.ceiling_include !== 'Y') return false
      const upper = r.ceiling_primer.trim().toUpperCase()
      return !!upper && upper !== 'NONE'
    })
    const saveNeedsTrimPrimer = generatedTrimItems.some((row) => primerModeEnabled(row.primer_mode))
    const wallsPrimerId = saveNeedsWallsPrimer ? jobsettings.walls_primer_id : ''
    const ceilingPrimerId = saveNeedsCeilingPrimer ? jobsettings.ceiling_primer_id : ''
    const trimPrimerId = saveNeedsTrimPrimer ? jobsettings.trim_primer_id : ''
    return {
      ...jobsettings,
      walls_primer_id: wallsPrimerId,
      ceiling_primer_id: ceilingPrimerId,
      trim_primer_id: trimPrimerId,
      primer_id: wallsPrimerId || ceilingPrimerId || trimPrimerId || jobsettings.primer_id,
    }
  }, [generatedTrimItems, jobsettings, rooms])

  useEffect(() => {
    if (!loadedOnce || !estimate) return
    if (dirtyTick < 1) return
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveTimerRef.current = null
      setSaving(true)
      const res = await authedFetch(`/api/estimates/${estimate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobsettings: buildJobsettingsForSave(),
          rooms,
          segments,
          ceiling_segments: ceilingSegments,
          trim_items: generatedTrimItems,
          rollers: rollersDraft.filter(
            (row) => row.scope === 'Wall' || rooms.some((room) => room.ceiling_include === 'Y')
          ),
          prejob: flattenPreJobTrips(prejobTrips, preJobTemplateTaskById),
        }),
      })
      const payload = await res.json().catch(() => null)
      setSaving(false)
      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        setMissingInputs([])
        return
      }
      setNotice(`Saved ${new Date().toLocaleTimeString()}`)
      setTimeout(() => setNotice(null), 1200)
    }, 650)
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [
    dirtyTick,
    loadedOnce,
    estimate,
    jobsettings,
    rooms,
    segments,
    ceilingSegments,
    generatedTrimItems,
    rollersDraft,
    prejobTrips,
    preJobTemplateTaskById,
    buildJobsettingsForSave,
  ])

  const outputs = (estimate?.latest_output_json?.output_app ?? {}) as OutputApp
  const workbookSpreadsheetId =
    parseSpreadsheetIdFromSheetPath(estimate?.sheet_file_path) || catalogs.spreadsheet_id
  const workbookUrl = workbookSpreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(workbookSpreadsheetId)}/edit`
    : ''
  const hasWalls = rooms.some((r) => r.walls_include === 'Y')
  const hasCeilings = rooms.some((r) => r.ceiling_include === 'Y')
  const wallColorIdsForRollers = useMemo(() => {
    const roomIdsWithWalls = new Set(
      rooms.filter((room) => room.walls_include === 'Y').map((room) => room.room_id)
    )
    const roomWallColors = rooms
      .filter((room) => room.walls_include === 'Y')
      .map((room) => normalizeColorId(room.wall_color_id))
      .filter(Boolean)
    const segmentOverrideColors = segments
      .filter((seg) => toYN(seg.active, 'Y') === 'Y' && roomIdsWithWalls.has(seg.room_id))
      .map((seg) => normalizeColorId(seg.wall_color_override_id))
      .filter(Boolean)
    return Array.from(new Set([...roomWallColors, ...segmentOverrideColors]))
  }, [rooms, segments])
  const hasTrim = rooms.some((r) => r.trim_include === 'Y')
  const needsWallsPrimerProduct = rooms.some((r) => {
    if (r.walls_include !== 'Y') return false
    const upper = r.walls_primer.trim().toUpperCase()
    return !!upper && upper !== 'NONE'
  })
  const needsCeilingPrimerProduct = rooms.some((r) => {
    if (r.ceiling_include !== 'Y') return false
    const upper = r.ceiling_primer.trim().toUpperCase()
    return !!upper && upper !== 'NONE'
  })
  const needsTrimPrimerProduct = generatedTrimItems.some((row) => primerModeEnabled(row.primer_mode))
  const needsTrimPrimer = needsTrimPrimerProduct
  const showSegments = useMemo(
    () =>
      rooms.some((r) => r.mode === 'SEG') ||
      segments.length > 0 ||
      ceilingSegments.length > 0,
    [rooms, segments, ceilingSegments]
  )
  const segRooms = useMemo(
    () => rooms.filter((r) => r.mode === 'SEG' && r.walls_include === 'Y'),
    [rooms]
  )
  const ceilingSegmentRooms = useMemo(
    () => rooms.filter((r) => r.mode === 'SEG' && r.ceiling_include === 'Y'),
    [rooms]
  )

  useEffect(() => {
    setRollersDraft((prev) => {
      const wallSqftByColor = new Map(
        (engineColorList?.wall_colors ?? [])
          .map((row) => [normalizeColorId(toText(row.wall_color_id)), row.wall_sqft] as const)
          .filter(([id]) => !!id)
      )
      const priorWallMap = new Map(
        prev
          .filter((row) => row.scope === 'Wall')
          .map((row) => [normalizeColorId(row.wall_color_id), row] as const)
      )
      const nextWallRows = wallColorIdsForRollers.map((colorId) => {
        const prior = priorWallMap.get(colorId)
        if (prior) {
          return {
            ...prior,
            wall_sqft: prior.wall_sqft ?? wallSqftByColor.get(colorId) ?? null,
          }
        }
        return {
          scope: 'Wall' as const,
          wall_color_id: colorId,
          wall_sqft: wallSqftByColor.get(colorId) ?? null,
          roller_size_in: '',
          covers_qty: '1',
          notes: '',
          active: 'Y' as const,
        }
      })

      const withoutCeiling = prev.filter((row) => row.scope === 'Ceiling')
      if (!hasCeilings) return nextWallRows
      const existingCeiling = prev.find((row) => row.scope === 'Ceiling')
      if (existingCeiling) return [...nextWallRows, ...withoutCeiling]
      return [
        ...nextWallRows,
        {
          scope: 'Ceiling',
          wall_color_id: '',
          roller_size_in: toNumString(engineColorList?.ceiling_roller?.roller_size_in),
          covers_qty: toNumString(engineColorList?.ceiling_roller?.covers_qty) || '1',
          notes: '',
          active: 'Y',
        },
      ]
    })
  }, [
    engineColorList?.ceiling_roller?.covers_qty,
    engineColorList?.ceiling_roller?.roller_size_in,
    engineColorList?.wall_colors,
    hasCeilings,
    wallColorIdsForRollers,
  ])

  const missingSettings: string[] = []
  if (hasWalls && !jobsettings.walls_paint_id) {
    missingSettings.push('Select a wall paint product.')
  }
  if (hasCeilings && !jobsettings.ceiling_paint_id) {
    missingSettings.push('Select a ceiling paint product.')
  }
  if (hasTrim && !jobsettings.trim_paint_id) {
    missingSettings.push('Select a trim paint product.')
  }
  if (hasTrim && (!jobsettings.trim_paint_qty || !jobsettings.trim_paint_uom)) {
    missingSettings.push('Set Trim Paint qty and unit (Gallon/Quart).')
  }
  if (needsTrimPrimer && (!jobsettings.trim_primer_qty || !jobsettings.trim_primer_uom)) {
    missingSettings.push('Set Trim Primer qty and unit (Gallon/Quart).')
  }
  if (needsWallsPrimerProduct && !jobsettings.walls_primer_id) {
    missingSettings.push('Select a wall primer product.')
  }
  if (needsCeilingPrimerProduct && !jobsettings.ceiling_primer_id) {
    missingSettings.push('Select a ceiling primer product.')
  }
  if (needsTrimPrimerProduct && !jobsettings.trim_primer_id) {
    missingSettings.push('Select a trim primer product.')
  }

  const wallPaintOptions = catalogs.catalogs.paint_products.filter(
    (p) => p.type.toLowerCase() === 'wall'
  )
  const ceilingPaintOptions = catalogs.catalogs.paint_products.filter(
    (p) => p.type.toLowerCase() === 'ceiling'
  )
  const trimPaintOptions = catalogs.catalogs.paint_products.filter(
    (p) => p.type.toLowerCase() === 'trim'
  )
  const primerPaintOptions = catalogs.catalogs.paint_products.filter(
    (p) => p.type.toLowerCase() === 'primer'
  )
  const wallRollerSizes = ['9', '14', '18']
  const ceilingRollerSizes = ['9', '14', '18']

  const saveJobSettings = (key: keyof JobSettingsDraft, value: string) => {
    if (key === 'default_walls_prep_level') {
      const prevDefault = jobsettings.default_walls_prep_level
      setRooms((prev) =>
        prev.map((room) => {
          if (room.walls_include !== 'Y') return room
          if (!room.walls_prep_override || room.walls_prep_override === prevDefault) {
            return { ...room, walls_prep_override: value, walls_prep_level: value }
          }
          return room
        })
      )
    }
    if (key === 'default_ceiling_prep_level') {
      const prevDefault = jobsettings.default_ceiling_prep_level
      setRooms((prev) =>
        prev.map((room) => {
          if (room.ceiling_include !== 'Y') return room
          if (!room.ceiling_prep_override || room.ceiling_prep_override === prevDefault) {
            return { ...room, ceiling_prep_override: value, ceiling_prep_level: value }
          }
          return room
        })
      )
    }
    if (key === 'default_trim_prep_level') {
      const prevDefault = jobsettings.default_trim_prep_level
      setRooms((prev) =>
        prev.map((room) => {
          if (room.trim_include !== 'Y') return room
          if (!room.trim_prep_override || room.trim_prep_override === prevDefault) {
            return { ...room, trim_prep_override: value }
          }
          return room
        })
      )
    }
    setJobsettings((prev) => ({ ...prev, [key]: value }))
    queueSave()
  }

  const addRoom = () => {
    const roomId = nextRoomId(rooms)
    const colorDefault = catalogs.catalogs.color_codes[0]?.id ?? 'A'
    const newRoom: RoomDraft = {
      room_id: roomId,
      room_name: '',
      mode: 'RECT',
      length_in: '',
      width_in: '',
      wallheight_in: '',
      ceilingheight_in: '',
      ceilingsqft_override: '',
      baseexclude_in: '',
      walls_include: 'N',
      walls_primer: '',
      walls_topcoats: '',
      walls_prep_override: '',
      walls_prep_level: '',
      wall_sqft_override: '',
      openings_sqft: '',
      walls_notes: '',
      ceiling_include: 'N',
      ceiling_primer: '',
      ceiling_topcoats: '',
      ceiling_prep_level: jobsettings.default_ceiling_prep_level,
      ceiling_prep_override: jobsettings.default_ceiling_prep_level,
      ceiling_height_surcharge: '',
      trim_include: 'N',
      trim_primer: '',
      trim_topcoats: '',
      trim_prep_override: jobsettings.default_trim_prep_level,
      doors_prep_override: jobsettings.default_trim_prep_level,
      baseboard_primer_mode: '',
      baseboard_spot_prime_pct: '',
      baseboard_prep_override: '',
      baseboard_type_id: '',
      baseboard_lf: '',
      baseboard_auto: 'N',
      crown_primer_mode: '',
      crown_spot_prime_pct: '',
      crown_prep_override: '',
      crown_type_id: '',
      crown_lf: '',
      crown_auto: 'N',
      window_casing_primer_mode: '',
      window_casing_spot_prime_pct: '',
      window_casing_prep_override: '',
      window_casing_type_id: '',
      window_count: '',
      door_casing_primer_mode: '',
      door_casing_spot_prime_pct: '',
      door_casing_prep_override: '',
      door_casing_type_id: '',
      door_casing_count: '',
      door_primer_mode: '',
      door_spot_prime_pct: '',
      door_prep_override: '',
      door_type_id: '',
      door_paint_count: '',
      door_sides: '',
      door_count: '',
      auto_calc_trim_perimeter: 'N',
      wall_color_id: colorDefault,
      ceiling_type_id: '',
    }
    setRooms((prev) => [newRoom, ...prev])
    setRoomScopesOpen((prev) => ({
      ...prev,
      [newRoom.room_id]: { walls: false, ceilings: false, trim: false },
    }))
    queueSave()
  }

  const updateRoom = (index: number, patch: Partial<RoomDraft>) => {
    const roomIdForClear = rooms[index]?.room_id
    setRooms((prev) =>
      prev.map((room, i) => {
        if (i !== index) return room
        const next = { ...room, ...patch }
        if ('wallheight_in' in patch) {
          next.ceilingheight_in = next.wallheight_in
        }
        if ('mode' in patch && patch.mode === 'SEG') {
          next.length_in = ''
          next.width_in = ''
          next.baseexclude_in = ''
          next.baseboard_auto = 'N'
          next.crown_auto = 'N'
          next.auto_calc_trim_perimeter = 'N'
        }
        if ('walls_include' in patch && patch.walls_include === 'N') {
          next.wall_color_id = ''
          next.walls_topcoats = ''
          next.walls_prep_override = ''
          next.walls_prep_level = ''
          next.wall_sqft_override = ''
          next.openings_sqft = ''
          next.walls_notes = ''
        } else if ('walls_include' in patch && patch.walls_include === 'Y' && !next.walls_prep_override) {
          next.walls_prep_override = jobsettings.default_walls_prep_level
          next.walls_prep_level = jobsettings.default_walls_prep_level
          if (!next.walls_topcoats) next.walls_topcoats = '2'
        }
        if ('walls_prep_override' in patch) {
          next.walls_prep_level = patch.walls_prep_override ?? ''
        }
        if ('ceiling_include' in patch) {
          if (patch.ceiling_include === 'N') {
            next.ceiling_type_id = ''
            next.ceiling_topcoats = ''
            next.ceilingsqft_override = ''
            next.ceiling_prep_level = ''
            next.ceiling_prep_override = ''
          } else if (!next.ceiling_type_id) {
            next.ceiling_type_id = defaultCeilingTypeId(catalogs)
            if (!next.ceiling_prep_override) {
              next.ceiling_prep_level = jobsettings.default_ceiling_prep_level
              next.ceiling_prep_override = jobsettings.default_ceiling_prep_level
            }
            if (!next.ceiling_topcoats) next.ceiling_topcoats = '2'
          } else if (!next.ceiling_topcoats) {
            next.ceiling_topcoats = '2'
          }
        }
        if ('ceiling_prep_override' in patch) {
          next.ceiling_prep_level = patch.ceiling_prep_override ?? ''
        }
        if ('trim_include' in patch && patch.trim_include === 'N') {
          next.baseboard_type_id = ''
          next.baseboard_lf = ''
          next.baseboard_auto = 'N'
          next.baseboard_primer_mode = ''
          next.baseboard_spot_prime_pct = ''
          next.baseboard_prep_override = ''
          next.crown_primer_mode = ''
          next.crown_spot_prime_pct = ''
          next.crown_prep_override = ''
          next.window_casing_primer_mode = ''
          next.window_casing_spot_prime_pct = ''
          next.window_casing_prep_override = ''
          next.door_casing_primer_mode = ''
          next.door_casing_spot_prime_pct = ''
          next.door_casing_prep_override = ''
          next.door_primer_mode = ''
          next.door_spot_prime_pct = ''
          next.door_prep_override = ''
          next.window_casing_type_id = ''
          next.window_count = ''
          next.door_casing_type_id = ''
          next.door_casing_count = ''
          next.door_type_id = ''
          next.door_paint_count = ''
          next.door_sides = ''
          next.door_count = ''
          next.auto_calc_trim_perimeter = 'N'
          next.trim_prep_override = ''
          next.doors_prep_override = ''
        } else if ('trim_include' in patch && patch.trim_include === 'Y') {
          if (!next.trim_prep_override) next.trim_prep_override = jobsettings.default_trim_prep_level
          if (!next.doors_prep_override) next.doors_prep_override = jobsettings.default_trim_prep_level
          if (!next.trim_topcoats) next.trim_topcoats = '2'
        }
        if ('baseboard_type_id' in patch && !patch.baseboard_type_id) {
          next.baseboard_lf = ''
          next.baseboard_auto = 'N'
        }
        if ('crown_type_id' in patch && !patch.crown_type_id) {
          next.crown_lf = ''
          next.crown_auto = 'N'
        }
        if ('window_casing_type_id' in patch && !patch.window_casing_type_id) {
          next.window_count = ''
        }
        if ('door_casing_type_id' in patch && !patch.door_casing_type_id) {
          next.door_casing_count = ''
        }
        if ('door_type_id' in patch && !patch.door_type_id) {
          next.door_paint_count = ''
          next.door_sides = ''
        }
        if ('door_type_id' in patch && patch.door_type_id && !next.door_sides) {
          next.door_sides = '1'
        }
        if ('door_type_id' in patch && patch.door_type_id && !next.trim_topcoats) {
          next.trim_topcoats = '2'
        }
        if (
          next.trim_include === 'Y' &&
          next.mode === 'RECT' &&
          (next.baseboard_auto === 'Y' || next.crown_auto === 'Y') &&
          (('length_in' in patch && patch.length_in != null) ||
            ('width_in' in patch && patch.width_in != null) ||
            ('baseboard_auto' in patch && patch.baseboard_auto === 'Y') ||
            ('crown_auto' in patch && patch.crown_auto === 'Y') ||
            ('mode' in patch && patch.mode === 'RECT'))
        ) {
          const perimeterLf = calcRectPerimeterLf(next.length_in, next.width_in)
          if (next.baseboard_auto === 'Y') {
            next.baseboard_lf = perimeterLf
          }
          if (next.crown_auto === 'Y') {
            next.crown_lf = perimeterLf
          }
        }
        if (next.mode !== 'RECT') {
          next.baseboard_auto = 'N'
          next.crown_auto = 'N'
        }
        next.auto_calc_trim_perimeter =
          next.mode === 'RECT' && (next.baseboard_auto === 'Y' || next.crown_auto === 'Y')
            ? 'Y'
            : 'N'
        next.door_count = next.door_casing_count || next.door_paint_count || ''
        return next
      })
    )
    if (patch.trim_include === 'N' && roomIdForClear) {
      setExtraDoorRows((prev) => ({ ...prev, [roomIdForClear]: [] }))
      setExtraDoorCasingRows((prev) => ({ ...prev, [roomIdForClear]: [] }))
      setExtraWindowCasingRows((prev) => ({ ...prev, [roomIdForClear]: [] }))
    }
    queueSave()
  }

  const toggleTrimComponent = (
    index: number,
    component: 'baseboard' | 'crown' | 'window_casing' | 'door_casing' | 'door',
    checked: boolean
  ) => {
    const room = rooms[index]
    if (!room) return
    if (component === 'baseboard') {
      updateRoom(index, checked ? { baseboard_type_id: baseboardOptions[0]?.id ?? '' } : { baseboard_type_id: '' })
      return
    }
    if (component === 'crown') {
      updateRoom(index, checked ? { crown_type_id: crownOptions[0]?.id ?? '' } : { crown_type_id: '' })
      return
    }
    if (component === 'window_casing') {
      updateRoom(index, checked ? { window_casing_type_id: windowCasingOptions[0]?.id ?? '' } : { window_casing_type_id: '' })
      if (!checked) {
        setExtraWindowCasingRows((prev) => ({ ...prev, [room.room_id]: [] }))
      }
      return
    }
    if (component === 'door_casing') {
      updateRoom(index, checked ? { door_casing_type_id: doorCasingOptions[0]?.id ?? '' } : { door_casing_type_id: '' })
      if (!checked) {
        setExtraDoorCasingRows((prev) => ({ ...prev, [room.room_id]: [] }))
      }
      return
    }
    if (checked) {
      updateRoom(index, { door_type_id: doorTypeOptions[0]?.id ?? '', door_sides: '1' })
      return
    }
    updateRoom(index, { door_type_id: '', door_sides: '' })
    setExtraDoorRows((prev) => ({ ...prev, [room.room_id]: [] }))
  }

  const addDoorTypeRow = (roomId: string) => {
    setExtraDoorRows((prev) => ({
      ...prev,
      [roomId]: [
        ...(prev[roomId] ?? []),
        {
          local_id: `${roomId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          room_id: roomId,
          trim_menu_id: '',
          qty: '',
          coats: '',
          auto_calc: 'N',
          primer_mode: '',
          spot_prime_pct: '',
          prep_level_override: '',
          door_sides: '1',
          notes: '',
        },
      ],
    }))
    queueSave()
  }

  const updateDoorTypeRow = (roomId: string, localId: string, patch: Partial<ExtraTrimDraft>) => {
    setExtraDoorRows((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? []).map((row) => (row.local_id === localId ? { ...row, ...patch } : row)),
    }))
    queueSave()
  }

  const removeDoorTypeRow = (roomId: string, localId: string) => {
    setExtraDoorRows((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? []).filter((row) => row.local_id !== localId),
    }))
    queueSave()
  }

  const addDoorCasingTypeRow = (roomId: string) => {
    setExtraDoorCasingRows((prev) => ({
      ...prev,
      [roomId]: [
        ...(prev[roomId] ?? []),
        {
          local_id: `${roomId}-door-casing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          room_id: roomId,
          trim_menu_id: '',
          qty: '',
          coats: '',
          auto_calc: 'N',
          primer_mode: '',
          spot_prime_pct: '',
          prep_level_override: '',
          door_sides: '',
          notes: '',
        },
      ],
    }))
    queueSave()
  }

  const updateDoorCasingTypeRow = (roomId: string, localId: string, patch: Partial<ExtraTrimDraft>) => {
    setExtraDoorCasingRows((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? []).map((row) => (row.local_id === localId ? { ...row, ...patch } : row)),
    }))
    queueSave()
  }

  const removeDoorCasingTypeRow = (roomId: string, localId: string) => {
    setExtraDoorCasingRows((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? []).filter((row) => row.local_id !== localId),
    }))
    queueSave()
  }

  const addWindowCasingTypeRow = (roomId: string) => {
    setExtraWindowCasingRows((prev) => ({
      ...prev,
      [roomId]: [
        ...(prev[roomId] ?? []),
        {
          local_id: `${roomId}-window-casing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          room_id: roomId,
          trim_menu_id: '',
          qty: '',
          coats: '',
          auto_calc: 'N',
          primer_mode: '',
          spot_prime_pct: '',
          prep_level_override: '',
          door_sides: '',
          notes: '',
        },
      ],
    }))
    queueSave()
  }

  const updateWindowCasingTypeRow = (roomId: string, localId: string, patch: Partial<ExtraTrimDraft>) => {
    setExtraWindowCasingRows((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? []).map((row) => (row.local_id === localId ? { ...row, ...patch } : row)),
    }))
    queueSave()
  }

  const removeWindowCasingTypeRow = (roomId: string, localId: string) => {
    setExtraWindowCasingRows((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? []).filter((row) => row.local_id !== localId),
    }))
    queueSave()
  }

  const removeRoom = (index: number) => {
    const roomId = rooms[index]?.room_id
    setRooms((prev) => prev.filter((_, i) => i !== index))
    if (roomId) {
      setSegments((prev) => prev.filter((s) => s.room_id !== roomId))
      setCeilingSegments((prev) => prev.filter((s) => s.room_id !== roomId))
      setExtraDoorRows((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      setExtraDoorCasingRows((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      setExtraWindowCasingRows((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      setRoomScopesOpen((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
    }
    queueSave()
  }

  const duplicateRoom = (index: number) => {
    const source = rooms[index]
    if (!source) return
    const copy: RoomDraft = {
      ...source,
      id: undefined,
      room_id: nextRoomId(rooms),
      room_name: source.room_name ? `${source.room_name} Copy` : '',
    }
    setRooms((prev) => [...prev, copy])
    setRoomScopesOpen((prev) => ({
      ...prev,
      [copy.room_id]: prev[source.room_id] ?? { walls: false, ceilings: false, trim: false },
    }))
    setExtraDoorRows((prev) => ({
      ...prev,
      [copy.room_id]: (prev[source.room_id] ?? []).map((row, idx) => ({
        ...row,
        local_id: `${copy.room_id}-copy-${idx}-${Date.now()}`,
        room_id: copy.room_id,
      })),
    }))
    setExtraDoorCasingRows((prev) => ({
      ...prev,
      [copy.room_id]: (prev[source.room_id] ?? []).map((row, idx) => ({
        ...row,
        local_id: `${copy.room_id}-door-casing-copy-${idx}-${Date.now()}`,
        room_id: copy.room_id,
      })),
    }))
    setExtraWindowCasingRows((prev) => ({
      ...prev,
      [copy.room_id]: (prev[source.room_id] ?? []).map((row, idx) => ({
        ...row,
        local_id: `${copy.room_id}-window-casing-copy-${idx}-${Date.now()}`,
        room_id: copy.room_id,
      })),
    }))
    queueSave()
  }

  const moveRoom = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rooms.length) return
    setRooms((prev) => {
      const next = [...prev]
      const [row] = next.splice(index, 1)
      next.splice(target, 0, row)
      return next
    })
    queueSave()
  }

  const addSegmentToRoom = () => {
    if (!addSegmentRoom) return
    const roomSegments = segments.filter((s) => s.room_id === addSegmentRoom)
    const usedSegNos = new Set(
      roomSegments
        .map((row) => Number(row.seg_no))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
    let nextSegNo = 1
    while (usedSegNos.has(nextSegNo)) nextSegNo += 1
    const firstSegmentInRoom = roomSegments.reduce<SegmentDraft | null>((first, row) => {
      const rowSegNo = Number(row.seg_no)
      const firstSegNo = first ? Number(first.seg_no) : Number.NaN
      if (!first) return row
      if (!Number.isFinite(rowSegNo)) return first
      if (!Number.isFinite(firstSegNo)) return row
      return rowSegNo < firstSegNo ? row : first
    }, null)
    const defaultComplexity = firstSegmentInRoom
      ? normalizeWallComplexityTypeId(firstSegmentInRoom.wall_complexity_type_id, catalogs)
      : defaultWallComplexityTypeId(catalogs)
    const defaultCalcMethod = firstSegmentInRoom
      ? normalizeWallsCalcMethod(firstSegmentInRoom.walls_calc_method)
      : 'REGULAR'
    setSegments((prev) => [
      {
        room_id: addSegmentRoom,
        seg_no: String(nextSegNo),
        seglen_in: '',
        seg_wallheight_in: '',
        wall_complexity_type_id: defaultComplexity,
        walls_calc_method: defaultCalcMethod,
        panel_length_in: '',
        panel_height_bottom_in: '',
        panel_height_top_in: '',
        baseexclude_in: '',
        wall_color_override_id: '',
        wall_label: '',
        notes: '',
        active: 'Y',
      },
      ...prev,
    ])
    queueSave()
  }

  const updateSegment = (index: number, patch: Partial<SegmentDraft>) => {
    setSegments((prev) =>
      {
        return prev.map((row, i) => {
          if (i !== index) return row
          const next = { ...row, ...patch }
          if ('room_id' in patch && patch.room_id && patch.room_id !== row.room_id) {
            const sameRoom = prev.filter((seg, segIndex) => segIndex !== i && seg.room_id === patch.room_id)
            const usedSegNos = new Set(
              sameRoom
                .map((seg) => Number(seg.seg_no))
                .filter((n) => Number.isFinite(n) && n > 0)
            )
            let nextSegNo = 1
            while (usedSegNos.has(nextSegNo)) nextSegNo += 1
            next.seg_no = String(nextSegNo)
            // Moving a segment to a different room should start with a clean row
            // so room-specific dimensions/notes are not accidentally copied over.
            next.seglen_in = ''
            next.seg_wallheight_in = ''
            next.wall_complexity_type_id = defaultWallComplexityTypeId(catalogs)
            next.walls_calc_method = 'REGULAR'
            next.panel_length_in = ''
            next.panel_height_bottom_in = ''
            next.panel_height_top_in = ''
            next.baseexclude_in = ''
            next.wall_color_override_id = ''
            next.wall_label = ''
            next.notes = ''
            const targetRoom = rooms.find((r) => r.room_id === patch.room_id)
            if (targetRoom?.trim_include !== 'Y') {
              next.baseexclude_in = ''
            }
          }
          if ('wall_complexity_type_id' in patch) {
            next.wall_complexity_type_id = normalizeWallComplexityTypeId(
              patch.wall_complexity_type_id,
              catalogs
            )
          }
          if ('walls_calc_method' in patch) {
            next.walls_calc_method = normalizeWallsCalcMethod(patch.walls_calc_method)
            if (next.walls_calc_method === 'PANEL') {
              next.seglen_in = ''
              next.seg_wallheight_in = ''
              next.baseexclude_in = ''
            } else {
              next.panel_length_in = ''
              next.panel_height_bottom_in = ''
              next.panel_height_top_in = ''
            }
          }
          return next
        })
      }
    )
    queueSave()
  }

  const removeSegment = (index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index))
    queueSave()
  }

  const addCeilingSegmentToRoom = () => {
    if (!addCeilingSegmentRoom) return
    const roomSegments = ceilingSegments.filter((s) => s.room_id === addCeilingSegmentRoom)
    const maxSeg = roomSegments.reduce((max, row) => {
      const n = Number(row.seg_no)
      return Number.isFinite(n) ? Math.max(max, n) : max
    }, 0)
    setCeilingSegments((prev) => [
      {
        room_id: addCeilingSegmentRoom,
        seg_no: String(maxSeg + 1),
        length_in: '',
        width_in: '',
        ceiling_height_in: '',
        notes: '',
        active: 'Y',
      },
      ...prev,
    ])
    queueSave()
  }

  const updateCeilingSegment = (index: number, patch: Partial<CeilingSegmentDraft>) => {
    setCeilingSegments((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row
        const next = { ...row, ...patch }
        if ('room_id' in patch && patch.room_id && patch.room_id !== row.room_id) {
          const sameRoom = prev.filter((seg, segIndex) => segIndex !== i && seg.room_id === patch.room_id)
          const maxSeg = sameRoom.reduce((max, seg) => {
            const n = Number(seg.seg_no)
            return Number.isFinite(n) ? Math.max(max, n) : max
          }, 0)
          next.seg_no = String(maxSeg + 1)
          // Same behavior as wall segments: room switch should not copy dimensions/notes across rooms.
          next.length_in = ''
          next.width_in = ''
          next.ceiling_height_in = ''
          next.notes = ''
        }
        return next
      })
    )
    queueSave()
  }

  const removeCeilingSegment = (index: number) => {
    setCeilingSegments((prev) => prev.filter((_, i) => i !== index))
    queueSave()
  }

  const toggleRoomScope = (roomId: string, scope: 'walls' | 'ceilings' | 'trim') => {
    setRoomScopesOpen((prev) => ({
      ...prev,
      [roomId]: {
        walls: prev[roomId]?.walls ?? false,
        ceilings: prev[roomId]?.ceilings ?? false,
        trim: prev[roomId]?.trim ?? false,
        [scope]: !(prev[roomId]?.[scope] ?? false),
      },
    }))
  }

  const addPrejobTrip = () => {
    setPrejobTrips((prev) => [
      ...prev,
      {
        id: `trip-${Date.now()}-${prev.length}`,
        trip_num: String(prev.length + 1),
        notes: '',
        tasks: [
          {
            id: `task-${Date.now()}-0`,
            mode: 'template',
            rollup_scope: 'Walls',
            task_template_id: '',
            task_name: '',
            manual_task_name: '',
            qty: '1',
            hours_each: '',
            extra_supplies: '',
          },
        ],
      },
    ])
    queueSave()
  }

  const removePrejobTrip = (tripIndex: number) => {
    setPrejobTrips((prev) =>
      prev
        .filter((_, i) => i !== tripIndex)
        .map((trip, idx) => ({ ...trip, trip_num: String(idx + 1) }))
    )
    queueSave()
  }

  const updatePrejobTrip = (tripIndex: number, patch: Partial<PreJobTripDraft>) => {
    setPrejobTrips((prev) => prev.map((trip, i) => (i === tripIndex ? { ...trip, ...patch } : trip)))
    queueSave()
  }

  const addPrejobTask = (tripIndex: number) => {
    setPrejobTrips((prev) =>
      prev.map((trip, i) =>
        i === tripIndex
          ? {
              ...trip,
              tasks: [
                ...trip.tasks,
                {
                  id: `task-${Date.now()}-${trip.tasks.length}`,
                  mode: 'template',
                  rollup_scope: 'Walls',
                  task_template_id: '',
                  task_name: '',
                  manual_task_name: '',
                  qty: '1',
                  hours_each: '',
                  extra_supplies: '',
                },
              ],
            }
          : trip
      )
    )
    queueSave()
  }

  const updatePrejobTask = (tripIndex: number, taskIndex: number, patch: Partial<PreJobTaskDraft>) => {
    setPrejobTrips((prev) =>
      prev.map((trip, i) =>
        i === tripIndex
          ? {
              ...trip,
              tasks: trip.tasks.map((task, j) => {
                if (j !== taskIndex) return task
                const next = { ...task, ...patch }
                if ('mode' in patch && patch.mode === 'template') {
                  // Keep selected task label for sheet lookup/display even in template mode.
                }
                if ('mode' in patch && patch.mode === 'manual') {
                  next.task_template_id = ''
                  next.task_name = next.manual_task_name
                }
                return next
              }),
            }
          : trip
      )
    )
    queueSave()
  }

  const removePrejobTask = (tripIndex: number, taskIndex: number) => {
    setPrejobTrips((prev) =>
      prev.map((trip, i) =>
        i === tripIndex ? { ...trip, tasks: trip.tasks.filter((_, j) => j !== taskIndex) } : trip
      )
    )
    queueSave()
  }

  const updateRoller = (index: number, patch: Partial<RollerDraft>) => {
    setRollersDraft((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    queueSave()
  }

  const clientValidationIssues = () => {
    const issues: string[] = []
    rooms.forEach((room) => {
      const trimPerimeterAutoCalc =
        room.trim_include === 'Y' &&
        room.mode === 'RECT' &&
        (room.baseboard_auto === 'Y' || room.crown_auto === 'Y')
      if (room.walls_include === 'Y') {
        if (!room.wall_color_id) issues.push(`${room.room_id}: wall color is required when Walls=Include`)
        if (room.mode === 'RECT' && !room.wallheight_in) {
          issues.push(`${room.room_id}: wall height is required for RECT wall mode`)
        }
        if (room.mode === 'SEG' && !room.wallheight_in) {
          const missingSegmentHeights = segments.some((seg) => {
            if (seg.room_id !== room.room_id) return false
            if (toYN(seg.active, 'Y') !== 'Y') return false
            if (normalizeWallsCalcMethod(seg.walls_calc_method) === 'PANEL') return false
            return !(Number(seg.seg_wallheight_in) > 0)
          })
          if (missingSegmentHeights) {
            issues.push(
              `${room.room_id}: each active regular segment needs Seg Wall Height when room wall height is blank`
            )
          }
        }
        const wallSqftOverride = Number(room.wall_sqft_override || '')
        const hasOverrideSqft = Number.isFinite(wallSqftOverride) && wallSqftOverride >= 0
        const rectCanCalc = room.mode === 'RECT' && !!room.length_in && !!room.width_in && !!room.wallheight_in
        const segHasCalc =
          room.mode === 'SEG' &&
          segments.some((seg) => {
            if (seg.room_id !== room.room_id) return false
            if (toYN(seg.active, 'Y') !== 'Y') return false
            if (normalizeWallsCalcMethod(seg.walls_calc_method) === 'PANEL') {
              const panelLength = Number(seg.panel_length_in)
              const panelBottom = Number(seg.panel_height_bottom_in)
              const panelTop = Number(seg.panel_height_top_in)
              return panelLength > 0 && panelBottom > 0 && panelTop > 0
            }
            if (!(Number(seg.seglen_in) > 0)) return false
            return Number(seg.seg_wallheight_in) > 0 || !!room.wallheight_in
          })
        if (!hasOverrideSqft && !rectCanCalc && !segHasCalc) {
          issues.push(`${room.room_id}: wall sqft needs dimensions/segments or an override`)
        }
        const openings = Number(room.openings_sqft || '')
        if (Number.isFinite(openings) && openings < 0) {
          issues.push(`${room.room_id}: openings sqft cannot be negative`)
        }
        if (Number.isFinite(wallSqftOverride) && wallSqftOverride < 0) {
          issues.push(`${room.room_id}: wall sqft override cannot be negative`)
        }
        if (
          Number.isFinite(openings) &&
          openings >= 0 &&
          Number.isFinite(wallSqftOverride) &&
          wallSqftOverride >= 0 &&
          openings > wallSqftOverride
        ) {
          issues.push(`${room.room_id}: openings sqft cannot exceed wall sqft override`)
        }
      }
      if (room.ceiling_include === 'Y') {
        if (!room.ceiling_type_id) issues.push(`${room.room_id}: ceiling type is required when Ceilings=Include`)
        const activeCeilingSegmentsInRoom = ceilingSegments.filter(
          (seg) => seg.room_id === room.room_id && toYN(seg.active, 'Y') === 'Y'
        )
        const allActiveCeilingSegmentsHaveHeight =
          activeCeilingSegmentsInRoom.length > 0 &&
          activeCeilingSegmentsInRoom.every((seg) => Number(seg.ceiling_height_in) > 0)
        const needsRoomCeilingHeight =
          room.mode !== 'SEG' || !allActiveCeilingSegmentsHaveHeight
        if (needsRoomCeilingHeight && !room.ceilingheight_in) {
          issues.push(
            `${room.room_id}: ceiling height is required unless every active ceiling segment has a height override`
          )
        }
        const canCalcCeilingSqft = room.mode === 'RECT' && !!room.length_in && !!room.width_in
        const segCanCalcCeilingSqft =
          room.mode === 'SEG' &&
          ceilingSegments.some(
            (seg) =>
              seg.room_id === room.room_id && Number(seg.length_in) > 0 && Number(seg.width_in) > 0
          )
        if (!room.ceilingsqft_override && !canCalcCeilingSqft && !segCanCalcCeilingSqft) {
          issues.push(`${room.room_id}: ceiling sqft needs dimensions/segments or an override`)
        }
      }
      if (trimPerimeterAutoCalc && (!room.length_in || !room.width_in)) {
        issues.push(
          `${room.room_id}: length and width are required when trim auto-calc perimeter is enabled`
        )
      }
    })
    generatedTrimItems.forEach((row, idx) => {
      if (normalizePrimerMode(row.primer_mode) !== 'Spot') return
      const pct = Number(row.spot_prime_pct || '')
      if (!Number.isFinite(pct) || pct <= 0) {
        const trimId = (row.trim_menu_id || '').trim()
        const roomId = (row.room_id || '').trim()
        issues.push(
          `${roomId || 'Room'} ${trimId ? `(${trimId}) ` : ''}trim item ${idx + 1}: Spot % is required and must be greater than 0 when Primer Mode is Spot`
        )
      }
    })
    if (hasTrim) {
      if (!jobsettings.trim_paint_qty || !jobsettings.trim_paint_uom) {
        issues.push('Trim Paint qty and unit are required on Summary when Trim is included')
      }
      if (needsTrimPrimer && (!jobsettings.trim_primer_qty || !jobsettings.trim_primer_uom)) {
        issues.push('Trim Primer qty and unit are required on Summary when Trim is included')
      }
    }
    if (needsWallsPrimerProduct && !jobsettings.walls_primer_id) {
      issues.push('Wall primer product is required on Summary when wall primer mode is enabled')
    }
    if (needsCeilingPrimerProduct && !jobsettings.ceiling_primer_id) {
      issues.push('Ceiling primer product is required on Summary when ceiling primer mode is enabled')
    }
    if (needsTrimPrimerProduct && !jobsettings.trim_primer_id) {
      issues.push('Trim primer product is required on Summary when trim primer mode is enabled')
    }
    return issues
  }

  const runRecalc = async (createNewSheet = false) => {
    if (!estimate) return
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    setRecalculating(true)
    setError(null)
    setMissingInputs([])
    const issues = clientValidationIssues()
    if (issues.length) {
      setRecalculating(false)
      setError(issues[0])
      setMissingInputs(
        issues.map((message) => ({ tab: 'UI Validation', header: 'required', message }))
      )
      return
    }
    const saveRes = await authedFetch(`/api/estimates/${estimate.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobsettings: buildJobsettingsForSave(),
        rooms,
        segments,
        trim_items: generatedTrimItems,
        rollers: rollersDraft.filter(
          (row) => row.scope === 'Wall' || rooms.some((room) => room.ceiling_include === 'Y')
        ),
        prejob: flattenPreJobTrips(prejobTrips, preJobTemplateTaskById),
      }),
    })
    if (!saveRes.ok) {
      const saveErr = await saveRes.json().catch(() => null)
      setError(saveErr?.error ?? saveRes.statusText)
      setMissingInputs([])
      setRecalculating(false)
      return
    }
    const recalcPath = createNewSheet
      ? `/api/estimates/${estimate.id}/recalculate?new_sheet=1`
      : `/api/estimates/${estimate.id}/recalculate`
    const res = await authedFetch(recalcPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobsettings: buildJobsettingsForSave(),
        rooms,
        segments,
        ceiling_segments: ceilingSegments,
        trim_items: generatedTrimItems,
        rollers: rollersDraft.filter(
          (row) => row.scope === 'Wall' || rooms.some((room) => room.ceiling_include === 'Y')
        ),
        prejob: flattenPreJobTrips(prejobTrips, preJobTemplateTaskById),
      }),
    })
    const body = await res.json().catch(() => null)
    setRecalculating(false)
    if (!res.ok) {
      setError(body?.error ?? res.statusText)
      setMissingInputs(Array.isArray(body?.missing_inputs) ? body.missing_inputs : [])
      return
    }
    await load()
    setNotice(createNewSheet ? 'Created new sheet and recalculated' : 'Recalculated')
    setTimeout(() => setNotice(null), 1400)
  }

  if (loading)
    return (
      <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
        <div className="mx-auto max-w-6xl px-4 text-sm text-gray-600 md:px-6">Loading...</div>
      </div>
    )
  if (!estimate)
    return (
      <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
        <div className="mx-auto max-w-6xl px-4 text-sm text-red-700 md:px-6">
          {error ?? 'Estimate not found'}
        </div>
      </div>
    )

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto max-w-[1320px] px-4 md:px-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Estimate Intake</h1>
            <div style={{ marginTop: 4, color: '#6b7280', fontSize: 13 }}>
              Job: {estimate.job_id} | {saving ? 'Saving...' : notice ?? 'Idle'}
            </div>
            {catalogs.schema_mismatch && (
              <div style={{ marginTop: 6, color: '#991b1b', fontSize: 12 }}>
                Catalog schema mismatch detected. Recalculate/write may be blocked until template versions align.
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void load(true)}
              style={btnGhost}
              type="button"
              disabled={loading || recalculating}
            >
              {iconLabel(RefreshCw, 'Refresh constants')}
            </button>
            <button
              onClick={() => void runRecalc(true)}
              disabled={recalculating}
              style={btnGhost}
              type="button"
            >
              {iconLabel(Plus, 'Create new sheet + recalc')}
            </button>
            <button onClick={() => void runRecalc()} disabled={recalculating} style={btnPrimary}>
              {recalculating ? 'Recalculating...' : iconLabel(Calculator, 'Recalculate Estimate')}
            </button>
            <Link href="/crm/estimates" style={btnGhost}>
              {iconLabel(ArrowLeft, 'Back')}
            </Link>
          </div>
        </div>
        {error && <div className="mb-2 rounded-xl border border-red-200 bg-white p-3 text-sm text-red-700">{error}</div>}
        {missingInputs.length > 0 && (
          <div
            style={{
              marginBottom: 10,
              border: '1px solid #fca5a5',
              background: '#fef2f2',
              borderRadius: 10,
              padding: 10,
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 800, color: '#991b1b', fontSize: 12 }}>
              Recalculate blocked. Fill required fields:
            </div>
            {missingInputs.map((item, idx) => (
              <div key={`${item.tab}-${item.header}-${item.room_id ?? ''}-${idx}`} style={{ fontSize: 12, color: '#7f1d1d' }}>
                - [{item.tab}] {item.room_id ? `(${item.room_id}) ` : ''}{item.message || item.header}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {tabs.map((tab) => {
            if (tab === 'Segments' && !showSegments) return null
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: activeTab === tab ? '1px solid #111' : '1px solid #d1d5db',
                  background: activeTab === tab ? '#111' : '#fff',
                  color: activeTab === tab ? '#fff' : '#111',
                  fontWeight: 800,
                  fontSize: 12,
                  boxShadow: activeTab === tab ? '0 4px 14px rgba(17,24,39,0.12)' : 'none',
                }}
              >
                {iconLabel(tabIcons[tab], tab, 14)}
              </button>
            )
          })}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        {activeTab === 'Job Settings' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <div style={labelStyle}>Labor Rate Override ($/hr)</div>
                <input
                  value={jobsettings.override_labor_rate}
                  onChange={(e) => saveJobSettings('override_labor_rate', e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <div style={labelStyle}>Markup Override (multiplier)</div>
                <input
                  value={jobsettings.override_markup}
                  onChange={(e) => saveJobSettings('override_markup', e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <div style={labelStyle}>Rounding Increment (hours)</div>
                <input
                  value={jobsettings.rounding_increment_hours}
                  onChange={(e) => saveJobSettings('rounding_increment_hours', e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <div style={labelStyle}>Workday Hours</div>
                <input
                  value={jobsettings.dayhours}
                  onChange={(e) => saveJobSettings('dayhours', e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 4 }}>
              <div style={labelStyle}>Notes</div>
              <textarea
                value={jobsettings.notes}
                onChange={(e) => saveJobSettings('notes', e.target.value)}
                style={{ ...inputStyle, minHeight: 80 }}
              />
            </label>
          </div>
        )}

        {activeTab === 'Rooms' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Default Prep Levels</div>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 4 }}>
                  <div style={labelStyle}>Walls Default Prep Level</div>
                  <select
                    value={jobsettings.default_walls_prep_level || ''}
                    onChange={(e) => saveJobSettings('default_walls_prep_level', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Light">Light</option>
                    <option value="Medium">Medium</option>
                    <option value="Heavy">Heavy</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  <div style={labelStyle}>Ceilings Default Prep Level</div>
                  <select
                    value={jobsettings.default_ceiling_prep_level || ''}
                    onChange={(e) => saveJobSettings('default_ceiling_prep_level', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Light">Light</option>
                    <option value="Medium">Medium</option>
                    <option value="Heavy">Heavy</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  <div style={labelStyle}>Trim Default Prep Level</div>
                  <select
                    value={jobsettings.default_trim_prep_level || ''}
                    onChange={(e) => saveJobSettings('default_trim_prep_level', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Light">Light</option>
                    <option value="Medium">Medium</option>
                    <option value="Heavy">Heavy</option>
                  </select>
                </label>
              </div>
            </div>

            <button onClick={addRoom} style={{ ...btnPrimary, justifySelf: 'start', padding: '10px 16px' }}>
              {iconLabel(Plus, 'Add Room', 14)}
            </button>

            {rooms.map((room, index) => {
              const trimPerimeterAutoCalc =
                room.trim_include === 'Y' &&
                room.mode === 'RECT' &&
                (room.baseboard_auto === 'Y' || room.crown_auto === 'Y')
              const needsRectDims =
                room.mode === 'RECT' &&
                (room.walls_include === 'Y' || room.ceiling_include === 'Y' || trimPerimeterAutoCalc)
              const needsRectCeilingDims = room.ceiling_include === 'Y' && room.mode === 'RECT'
              const roomWarnings: string[] = []
              const baseboardSelected = !!room.baseboard_type_id
              const crownSelected = !!room.crown_type_id
              const windowCasingExtras = extraWindowCasingRows[room.room_id] ?? []
              const doorCasingExtras = extraDoorCasingRows[room.room_id] ?? []
              const windowCasingSelected = !!room.window_casing_type_id || windowCasingExtras.length > 0
              const doorCasingSelected = !!room.door_casing_type_id || doorCasingExtras.length > 0
              const doorExtras = extraDoorRows[room.room_id] ?? []
              const doorsSelected = !!room.door_type_id || doorExtras.length > 0
              if (!room.room_name.trim()) roomWarnings.push('Room name is recommended.')
              if (needsRectDims && (!room.length_in || !room.width_in)) {
                roomWarnings.push('Length and width are recommended for RECT mode.')
              }
              if (room.walls_include === 'Y' && !room.wall_color_id) {
                roomWarnings.push('Wall color is recommended when walls are included.')
              }
              if (room.ceiling_include === 'Y' && !room.ceiling_type_id) {
                roomWarnings.push('Ceiling type is recommended when ceilings are included.')
              }
              if (needsRectCeilingDims && (!room.length_in || !room.width_in)) {
                roomWarnings.push('Ceiling length and width are recommended for RECT ceiling mode.')
              }
              if (
                room.ceiling_include === 'Y' &&
                room.mode === 'SEG' &&
                !ceilingSegments.some(
                  (seg) =>
                    seg.room_id === room.room_id && Number(seg.length_in) > 0 && Number(seg.width_in) > 0
                )
              ) {
                roomWarnings.push('Add at least one ceiling segment with length and width for SEG ceiling mode.')
              }
              return (
                <div key={room.room_id || index} style={roomCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 800 }}>
                      {room.room_name || 'Untitled Room'} <span style={{ color: '#6b7280' }}>({room.room_id})</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => moveRoom(index, -1)} style={btnGhost} disabled={index === 0}>
                        Up
                      </button>
                      <button onClick={() => moveRoom(index, 1)} style={btnGhost} disabled={index === rooms.length - 1}>
                        Down
                      </button>
                      <button onClick={() => duplicateRoom(index)} style={btnGhost}>
                        Duplicate
                      </button>
                      <button onClick={() => removeRoom(index)} style={btnDanger}>
                        Remove
                      </button>
                    </div>
                  </div>

                  {roomWarnings.length > 0 && (
                    <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 8 }}>
                      {roomWarnings.map((msg) => (
                        <div key={msg}>- {msg}</div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Room Name</div>
                      <input value={room.room_name} onChange={(e) => updateRoom(index, { room_name: e.target.value })} style={inputStyle} />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Room ID (Auto)</div>
                      <input value={room.room_id} readOnly style={{ ...inputStyle, background: '#f9fafb' }} />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Wall Geometry Mode</div>
                      <select value={room.mode} onChange={(e) => updateRoom(index, { mode: e.target.value as 'RECT' | 'SEG' })} style={inputStyle}>
                        <option value="RECT">Rectangle</option>
                        <option value="SEG">Segmented</option>
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Height (in)</div>
                      <input value={room.wallheight_in} onChange={(e) => updateRoom(index, { wallheight_in: e.target.value })} style={inputStyle} />
                    </label>
                    {room.mode === 'RECT' && (
                      <>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Length (in)</div>
                          <input value={room.length_in} onChange={(e) => updateRoom(index, { length_in: e.target.value })} style={inputStyle} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Width (in)</div>
                          <input value={room.width_in} onChange={(e) => updateRoom(index, { width_in: e.target.value })} style={inputStyle} />
                        </label>
                      </>
                    )}
                    {room.mode === 'SEG' && (
                      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#4b5563' }}>
                        This room uses segmented walls. Add segments in the Segments tab.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <label style={chipLabel}>
                      Walls
                      <input
                        type="checkbox"
                        checked={room.walls_include === 'Y'}
                        onChange={(e) => updateRoom(index, { walls_include: e.target.checked ? 'Y' : 'N' })}
                      />
                    </label>
                    <label style={chipLabel}>
                      Ceilings
                      <input
                        type="checkbox"
                        checked={room.ceiling_include === 'Y'}
                        onChange={(e) => updateRoom(index, { ceiling_include: e.target.checked ? 'Y' : 'N' })}
                      />
                    </label>
                    <label style={chipLabel}>
                      Trim
                      <input
                        type="checkbox"
                        checked={room.trim_include === 'Y'}
                        onChange={(e) => updateRoom(index, { trim_include: e.target.checked ? 'Y' : 'N' })}
                      />
                    </label>
                  </div>

                  {room.walls_include === 'Y' && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <button type="button" style={btnGhost} onClick={() => toggleRoomScope(room.room_id, 'walls')}>
                        {roomScopesOpen[room.room_id]?.walls ? 'Hide Walls' : 'Show Walls'}
                      </button>
                      {roomScopesOpen[room.room_id]?.walls && (
                        <div style={{ display: 'grid', gap: 8, alignItems: 'start', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Wall Color ID</div>
                        <select value={room.wall_color_id} onChange={(e) => updateRoom(index, { wall_color_id: normalizeColorId(e.target.value) })} style={inputStyle}>
                          <option value="">Select color</option>
                          {catalogs.catalogs.color_codes.map((color) => (
                            <option key={color.id} value={color.id}>
                              {color.id} - {color.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Walls Primer</div>
                        <select
                          value={room.walls_primer || 'None'}
                          onChange={(e) => updateRoom(index, { walls_primer: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="None">None</option>
                          <option value="Spot">Spot</option>
                          <option value="Full">Full</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Wall Topcoats</div>
                        <select value={room.walls_topcoats || ''} onChange={(e) => updateRoom(index, { walls_topcoats: e.target.value })} style={inputStyle}>
                          <option value="">Select</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Walls Prep Override</div>
                        <select
                          value={room.walls_prep_override || ''}
                          onChange={(e) =>
                            updateRoom(index, {
                              walls_prep_override: e.target.value,
                              walls_prep_level: e.target.value,
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="">{jobsettings.default_walls_prep_level ? `Use room default (${jobsettings.default_walls_prep_level})` : 'Use sheet default'}</option>
                          <option value="Light">Light</option>
                          <option value="Medium">Medium</option>
                          <option value="Heavy">Heavy</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Wall SqFt Override</div>
                        <input
                          value={room.wall_sqft_override}
                          onChange={(e) => updateRoom(index, { wall_sqft_override: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Openings SqFt</div>
                        <input
                          value={room.openings_sqft}
                          onChange={(e) => updateRoom(index, { openings_sqft: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 4, gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Walls Notes</div>
                        <input
                          value={room.walls_notes}
                          onChange={(e) => updateRoom(index, { walls_notes: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                        </div>
                      )}
                    </div>
                  )}

                  {room.ceiling_include === 'Y' && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <button type="button" style={btnGhost} onClick={() => toggleRoomScope(room.room_id, 'ceilings')}>
                        {roomScopesOpen[room.room_id]?.ceilings ? 'Hide Ceilings' : 'Show Ceilings'}
                      </button>
                      {roomScopesOpen[room.room_id]?.ceilings && (
                        <div style={{ display: 'grid', gap: 8, alignItems: 'start', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Ceiling Type</div>
                        <select value={room.ceiling_type_id} onChange={(e) => updateRoom(index, { ceiling_type_id: e.target.value })} style={inputStyle}>
                          <option value="">Select type</option>
                          <option value="FLAT">Flat</option>
                          <option value="VAULT">Vault</option>
                          <option value="TRAY">Tray</option>
                          <option value="COFFERED">Coffered</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Ceiling Primer</div>
                        <select
                          value={room.ceiling_primer || 'None'}
                          onChange={(e) => updateRoom(index, { ceiling_primer: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="None">None</option>
                          <option value="Spot">Spot</option>
                          <option value="Full">Full</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Ceiling Topcoats</div>
                        <select value={room.ceiling_topcoats || ''} onChange={(e) => updateRoom(index, { ceiling_topcoats: e.target.value })} style={inputStyle}>
                          <option value="">Select</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Ceiling Prep Override</div>
                        <select
                          value={room.ceiling_prep_override || ''}
                          onChange={(e) => updateRoom(index, { ceiling_prep_override: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">{jobsettings.default_ceiling_prep_level ? `Use room default (${jobsettings.default_ceiling_prep_level})` : 'Use sheet default'}</option>
                          <option value="Light">Light</option>
                          <option value="Medium">Medium</option>
                          <option value="Heavy">Heavy</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Ceiling SqFt Override</div>
                        <input value={room.ceilingsqft_override} onChange={(e) => updateRoom(index, { ceilingsqft_override: e.target.value })} style={inputStyle} />
                      </label>
                      {room.mode === 'SEG' && (
                        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#4b5563' }}>
                          This room uses segmented ceilings. Add ceiling segments in the Segments tab.
                        </div>
                      )}
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Ceiling Crown Check</div>
                        <select
                          value={room.crown_type_id ? 'Y' : 'N'}
                          onChange={(e) =>
                            updateRoom(index, {
                              crown_type_id: e.target.value === 'Y' ? room.crown_type_id || crownOptions[0]?.id || '' : '',
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="N">No</option>
                          <option value="Y">Yes</option>
                        </select>
                      </label>
                        </div>
                      )}
                    </div>
                  )}

                  {room.trim_include === 'Y' && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <button type="button" style={btnGhost} onClick={() => toggleRoomScope(room.room_id, 'trim')}>
                        {roomScopesOpen[room.room_id]?.trim ? 'Hide Trim' : 'Show Trim'}
                      </button>
                      {roomScopesOpen[room.room_id]?.trim && (
                        <div style={{ display: 'grid', gap: 8, alignItems: 'start', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Default Primer Mode</div>
                        <select
                          value={room.trim_primer || ''}
                          onChange={(e) => updateRoom(index, { trim_primer: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">None</option>
                          <option value="Spot">Spot</option>
                          <option value="Full">Full</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Trim Topcoats</div>
                        <select value={room.trim_topcoats || ''} onChange={(e) => updateRoom(index, { trim_topcoats: e.target.value })} style={inputStyle}>
                          <option value="">Select</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Prep Level Override</div>
                        <select
                          value={room.trim_prep_override || ''}
                          onChange={(e) => updateRoom(index, { trim_prep_override: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">
                            {jobsettings.default_trim_prep_level
                              ? `Use room default (${jobsettings.default_trim_prep_level})`
                              : 'Use room default (Light)'}
                          </option>
                          <option value="Light">Light</option>
                          <option value="Medium">Medium</option>
                          <option value="Heavy">Heavy</option>
                        </select>
                      </label>
                      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#6b7280' }}>
                        These choices map to Trim Menu IDs in the spreadsheet (Constants).
                      </div>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={baseboardSelected}
                            onChange={(e) => toggleTrimComponent(index, 'baseboard', e.target.checked)}
                          />
                          Baseboard
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={crownSelected}
                            onChange={(e) => toggleTrimComponent(index, 'crown', e.target.checked)}
                          />
                          Crown
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={windowCasingSelected}
                            onChange={(e) => toggleTrimComponent(index, 'window_casing', e.target.checked)}
                          />
                          Window Casing
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={doorCasingSelected}
                            onChange={(e) => toggleTrimComponent(index, 'door_casing', e.target.checked)}
                          />
                          Door Casing
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={doorsSelected}
                            onChange={(e) => toggleTrimComponent(index, 'door', e.target.checked)}
                          />
                          Doors
                        </label>
                      </div>

                      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', alignItems: 'start' }}>
                        {baseboardSelected && (
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
                          <div style={{ ...labelStyle, color: '#111' }}>Baseboard</div>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Type</div>
                            <select
                              value={room.baseboard_type_id}
                              onChange={(e) => updateRoom(index, { baseboard_type_id: e.target.value })}
                              style={inputStyle}
                              disabled={!room.baseboard_type_id}
                            >
                              <option value="">Select type</option>
                              {baseboardOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {trimOptionLabel(option)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Qty (LF)</div>
                            <input
                              value={room.baseboard_lf}
                              onChange={(e) => updateRoom(index, { baseboard_lf: e.target.value })}
                              style={inputStyle}
                              disabled={!room.baseboard_type_id || (room.mode === 'RECT' && room.baseboard_auto === 'Y')}
                            />
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, minHeight: 24 }}>
                            <input
                              type="checkbox"
                              checked={room.baseboard_auto === 'Y'}
                              disabled={room.mode !== 'RECT'}
                              onChange={(e) => updateRoom(index, { baseboard_auto: e.target.checked ? 'Y' : 'N' })}
                            />
                            Auto-calc from perimeter
                          </label>
                          <details style={{ gridColumn: '1 / -1' }}>
                            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#374151' }}>Prime/Prep</summary>
                            <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Primer Mode</div>
                                <select
                                  value={room.baseboard_primer_mode || ''}
                                  onChange={(e) =>
                                    updateRoom(index, {
                                      baseboard_primer_mode: e.target.value,
                                      baseboard_spot_prime_pct: e.target.value === 'Spot' ? room.baseboard_spot_prime_pct : '',
                                    })
                                  }
                                  style={inputStyle}
                                  disabled={!room.baseboard_type_id}
                                >
                                  <option value="">Default ({room.trim_primer || 'None'})</option>
                                  <option value="Spot">Spot</option>
                                  <option value="Full">Full</option>
                                </select>
                              </label>
                              {(room.baseboard_primer_mode || room.trim_primer) === 'Spot' && (
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <div style={labelStyle}>Spot %</div>
                                  <input
                                    value={room.baseboard_spot_prime_pct}
                                    onChange={(e) => updateRoom(index, { baseboard_spot_prime_pct: e.target.value })}
                                    style={inputStyle}
                                    disabled={!room.baseboard_type_id}
                                  />
                                </label>
                              )}
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Prep Override</div>
                                <select
                                  value={room.baseboard_prep_override || ''}
                                  onChange={(e) => updateRoom(index, { baseboard_prep_override: e.target.value })}
                                  style={inputStyle}
                                  disabled={!room.baseboard_type_id}
                                >
                                  <option value="">Default ({room.trim_prep_override || 'None'})</option>
                                  <option value="Light">Light</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Heavy">Heavy</option>
                                </select>
                              </label>
                            </div>
                          </details>
                        </div>
                        )}

                        {crownSelected && (
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
                          <div style={{ ...labelStyle, color: '#111' }}>Crown</div>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Type</div>
                            <select
                              value={room.crown_type_id}
                              onChange={(e) => updateRoom(index, { crown_type_id: e.target.value })}
                              style={inputStyle}
                              disabled={!room.crown_type_id}
                            >
                              <option value="">Select type</option>
                              {crownOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {trimOptionLabel(option)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Qty (LF)</div>
                            <input
                              value={room.crown_lf}
                              onChange={(e) => updateRoom(index, { crown_lf: e.target.value })}
                              style={inputStyle}
                              disabled={!room.crown_type_id || (room.mode === 'RECT' && room.crown_auto === 'Y')}
                            />
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, minHeight: 24 }}>
                            <input
                              type="checkbox"
                              checked={room.crown_auto === 'Y'}
                              disabled={room.mode !== 'RECT'}
                              onChange={(e) => updateRoom(index, { crown_auto: e.target.checked ? 'Y' : 'N' })}
                            />
                            Auto-calc from perimeter
                          </label>
                          <details style={{ gridColumn: '1 / -1' }}>
                            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#374151' }}>Prime/Prep</summary>
                            <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Primer Mode</div>
                                <select
                                  value={room.crown_primer_mode || ''}
                                  onChange={(e) =>
                                    updateRoom(index, {
                                      crown_primer_mode: e.target.value,
                                      crown_spot_prime_pct: e.target.value === 'Spot' ? room.crown_spot_prime_pct : '',
                                    })
                                  }
                                  style={inputStyle}
                                  disabled={!room.crown_type_id}
                                >
                                  <option value="">Default ({room.trim_primer || 'None'})</option>
                                  <option value="Spot">Spot</option>
                                  <option value="Full">Full</option>
                                </select>
                              </label>
                              {(room.crown_primer_mode || room.trim_primer) === 'Spot' && (
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <div style={labelStyle}>Spot %</div>
                                  <input
                                    value={room.crown_spot_prime_pct}
                                    onChange={(e) => updateRoom(index, { crown_spot_prime_pct: e.target.value })}
                                    style={inputStyle}
                                    disabled={!room.crown_type_id}
                                  />
                                </label>
                              )}
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Prep Override</div>
                                <select
                                  value={room.crown_prep_override || ''}
                                  onChange={(e) => updateRoom(index, { crown_prep_override: e.target.value })}
                                  style={inputStyle}
                                  disabled={!room.crown_type_id}
                                >
                                  <option value="">Default ({room.trim_prep_override || 'None'})</option>
                                  <option value="Light">Light</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Heavy">Heavy</option>
                                </select>
                              </label>
                            </div>
                          </details>
                        </div>
                        )}

                        {windowCasingSelected && (
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
                          <div style={{ ...labelStyle, color: '#111' }}>Window Casing</div>
                          <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 120px', alignItems: 'end' }}>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Type</div>
                              <select
                                value={room.window_casing_type_id}
                                onChange={(e) => updateRoom(index, { window_casing_type_id: e.target.value })}
                                style={inputStyle}
                                disabled={!room.window_casing_type_id}
                              >
                                <option value="">Select type</option>
                                {windowCasingOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {trimOptionLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Qty (EA)</div>
                              <input
                                value={room.window_count}
                                onChange={(e) => updateRoom(index, { window_count: e.target.value })}
                                style={inputStyle}
                                disabled={!room.window_casing_type_id}
                              />
                            </label>
                          </div>
                          <details style={{ gridColumn: '1 / -1' }}>
                            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#374151' }}>Prime/Prep</summary>
                            <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Primer Mode</div>
                                <select
                                  value={room.window_casing_primer_mode || ''}
                                  onChange={(e) =>
                                    updateRoom(index, {
                                      window_casing_primer_mode: e.target.value,
                                      window_casing_spot_prime_pct:
                                        e.target.value === 'Spot' ? room.window_casing_spot_prime_pct : '',
                                    })
                                  }
                                  style={inputStyle}
                                  disabled={!room.window_casing_type_id}
                                >
                                  <option value="">Default ({room.trim_primer || 'None'})</option>
                                  <option value="Spot">Spot</option>
                                  <option value="Full">Full</option>
                                </select>
                              </label>
                              {(room.window_casing_primer_mode || room.trim_primer) === 'Spot' && (
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <div style={labelStyle}>Spot %</div>
                                  <input
                                    value={room.window_casing_spot_prime_pct}
                                    onChange={(e) => updateRoom(index, { window_casing_spot_prime_pct: e.target.value })}
                                    style={inputStyle}
                                    disabled={!room.window_casing_type_id}
                                  />
                                </label>
                              )}
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Prep Override</div>
                                <select
                                  value={room.window_casing_prep_override || ''}
                                  onChange={(e) => updateRoom(index, { window_casing_prep_override: e.target.value })}
                                  style={inputStyle}
                                  disabled={!room.window_casing_type_id}
                                >
                                  <option value="">Default ({room.trim_prep_override || 'None'})</option>
                                  <option value="Light">Light</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Heavy">Heavy</option>
                                </select>
                              </label>
                            </div>
                          </details>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {windowCasingExtras.map((extra, extraIndex) => (
                              <div key={extra.local_id} style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 120px auto', alignItems: 'end' }}>
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <div style={labelStyle}>Window Casing Type {extraIndex + 2}</div>
                                  <select
                                    value={extra.trim_menu_id}
                                    onChange={(e) => updateWindowCasingTypeRow(room.room_id, extra.local_id, { trim_menu_id: e.target.value })}
                                    style={inputStyle}
                                  >
                                    <option value="">Select</option>
                                    {windowCasingOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {trimOptionLabel(option)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <div style={labelStyle}>Qty (EA)</div>
                                  <input
                                    value={extra.qty}
                                    onChange={(e) => updateWindowCasingTypeRow(room.room_id, extra.local_id, { qty: e.target.value })}
                                    style={inputStyle}
                                    disabled={!extra.trim_menu_id}
                                  />
                                </label>
                                <button onClick={() => removeWindowCasingTypeRow(room.room_id, extra.local_id)} style={btnDanger}>
                                  Remove
                                </button>
                              </div>
                            ))}
                            {windowCasingSelected && (
                              <button onClick={() => addWindowCasingTypeRow(room.room_id)} style={btnGhost}>
                                + Add Window Casing Type
                              </button>
                            )}
                          </div>
                        </div>
                        )}

                        {doorCasingSelected && (
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
                          <div style={{ ...labelStyle, color: '#111' }}>Door Casing</div>
                          <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 120px', alignItems: 'end' }}>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Type</div>
                              <select
                                value={room.door_casing_type_id}
                                onChange={(e) => updateRoom(index, { door_casing_type_id: e.target.value })}
                                style={inputStyle}
                                disabled={!room.door_casing_type_id}
                              >
                                <option value="">Select type</option>
                                {doorCasingOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {trimOptionLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Qty (EA)</div>
                              <input
                                value={room.door_casing_count}
                                onChange={(e) => updateRoom(index, { door_casing_count: e.target.value })}
                                style={inputStyle}
                                disabled={!room.door_casing_type_id}
                              />
                            </label>
                          </div>
                          <details style={{ gridColumn: '1 / -1' }}>
                            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#374151' }}>Prime/Prep</summary>
                            <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Primer Mode</div>
                                <select
                                  value={room.door_casing_primer_mode || ''}
                                  onChange={(e) =>
                                    updateRoom(index, {
                                      door_casing_primer_mode: e.target.value,
                                      door_casing_spot_prime_pct:
                                        e.target.value === 'Spot' ? room.door_casing_spot_prime_pct : '',
                                    })
                                  }
                                  style={inputStyle}
                                  disabled={!room.door_casing_type_id}
                                >
                                  <option value="">Default ({room.trim_primer || 'None'})</option>
                                  <option value="Spot">Spot</option>
                                  <option value="Full">Full</option>
                                </select>
                              </label>
                              {(room.door_casing_primer_mode || room.trim_primer) === 'Spot' && (
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <div style={labelStyle}>Spot %</div>
                                  <input
                                    value={room.door_casing_spot_prime_pct}
                                    onChange={(e) => updateRoom(index, { door_casing_spot_prime_pct: e.target.value })}
                                    style={inputStyle}
                                    disabled={!room.door_casing_type_id}
                                  />
                                </label>
                              )}
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Prep Override</div>
                                <select
                                  value={room.door_casing_prep_override || ''}
                                  onChange={(e) => updateRoom(index, { door_casing_prep_override: e.target.value })}
                                  style={inputStyle}
                                  disabled={!room.door_casing_type_id}
                                >
                                  <option value="">Default ({room.trim_prep_override || 'None'})</option>
                                  <option value="Light">Light</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Heavy">Heavy</option>
                                </select>
                              </label>
                            </div>
                          </details>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {doorCasingExtras.map((extra, extraIndex) => (
                              <div key={extra.local_id} style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 120px auto', alignItems: 'end' }}>
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <div style={labelStyle}>Door Casing Type {extraIndex + 2}</div>
                                  <select
                                    value={extra.trim_menu_id}
                                    onChange={(e) => updateDoorCasingTypeRow(room.room_id, extra.local_id, { trim_menu_id: e.target.value })}
                                    style={inputStyle}
                                  >
                                    <option value="">Select</option>
                                    {doorCasingOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {trimOptionLabel(option)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <div style={labelStyle}>Qty (EA)</div>
                                  <input
                                    value={extra.qty}
                                    onChange={(e) => updateDoorCasingTypeRow(room.room_id, extra.local_id, { qty: e.target.value })}
                                    style={inputStyle}
                                    disabled={!extra.trim_menu_id}
                                  />
                                </label>
                                <button onClick={() => removeDoorCasingTypeRow(room.room_id, extra.local_id)} style={btnDanger}>
                                  Remove
                                </button>
                              </div>
                            ))}
                            {doorCasingSelected && (
                              <button onClick={() => addDoorCasingTypeRow(room.room_id)} style={btnGhost}>
                                + Add Door Casing Type
                              </button>
                            )}
                          </div>
                        </div>
                        )}

                        {doorsSelected && (
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
                          <div style={{ ...labelStyle, color: '#111' }}>Doors</div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'end', flexWrap: 'wrap' }}>
                            <label style={{ display: 'grid', gap: 4, flex: '1 1 260px', minWidth: 220 }}>
                              <div style={labelStyle}>Type</div>
                              <select
                                value={room.door_type_id}
                                onChange={(e) => updateRoom(index, { door_type_id: e.target.value })}
                                style={{ ...inputStyle, width: 'fit-content', minWidth: 220, maxWidth: '100%' }}
                                disabled={!room.door_type_id}
                              >
                                <option value="">Select type</option>
                                {doorTypeOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {trimOptionLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: 'grid', gap: 4, flex: '0 0 120px' }}>
                              <div style={labelStyle}>Qty (EA)</div>
                              <input
                                value={room.door_paint_count}
                                onChange={(e) => updateRoom(index, { door_paint_count: e.target.value })}
                                style={inputStyle}
                                disabled={!room.door_type_id}
                              />
                            </label>
                            <label style={{ display: 'grid', gap: 4, flex: '0 0 150px' }}>
                              <div style={labelStyle}>Door Coverage</div>
                              <select
                                value={room.door_sides || '1'}
                                onChange={(e) => updateRoom(index, { door_sides: e.target.value })}
                                style={{ ...inputStyle, width: 'fit-content', minWidth: 180, maxWidth: '100%' }}
                                disabled={!room.door_type_id}
                              >
                                <option value="0.5">0.5 (one side)</option>
                                <option value="1">1.0 (whole door)</option>
                              </select>
                            </label>
                          </div>
                          <details style={{ gridColumn: '1 / -1' }}>
                            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#374151' }}>Prime/Prep</summary>
                            <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Primer Mode</div>
                                <select
                                  value={room.door_primer_mode || ''}
                                  onChange={(e) =>
                                    updateRoom(index, {
                                      door_primer_mode: e.target.value,
                                      door_spot_prime_pct: e.target.value === 'Spot' ? room.door_spot_prime_pct : '',
                                    })
                                  }
                                  style={inputStyle}
                                  disabled={!room.door_type_id}
                                >
                                  <option value="">Default ({room.trim_primer || 'None'})</option>
                                  <option value="Spot">Spot</option>
                                  <option value="Full">Full</option>
                                </select>
                              </label>
                              {(room.door_primer_mode || room.trim_primer) === 'Spot' && (
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <div style={labelStyle}>Spot %</div>
                                  <input
                                    value={room.door_spot_prime_pct}
                                    onChange={(e) => updateRoom(index, { door_spot_prime_pct: e.target.value })}
                                    style={inputStyle}
                                    disabled={!room.door_type_id}
                                  />
                                </label>
                              )}
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Prep Override</div>
                                <select
                                  value={room.door_prep_override || room.doors_prep_override || ''}
                                  onChange={(e) => updateRoom(index, { door_prep_override: e.target.value })}
                                  style={inputStyle}
                                  disabled={!room.door_type_id}
                                >
                                  <option value="">Default ({room.doors_prep_override || room.trim_prep_override || 'None'})</option>
                                  <option value="Light">Light</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Heavy">Heavy</option>
                                </select>
                              </label>
                            </div>
                          </details>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {doorExtras.map((extra, extraIndex) => (
                              <div key={extra.local_id} style={{ display: 'flex', gap: 6, alignItems: 'end', flexWrap: 'wrap' }}>
                                <label style={{ display: 'grid', gap: 4, flex: '1 1 260px', minWidth: 220 }}>
                                  <div style={labelStyle}>Door Type {extraIndex + 2}</div>
                                  <select
                                    value={extra.trim_menu_id}
                                    onChange={(e) => updateDoorTypeRow(room.room_id, extra.local_id, { trim_menu_id: e.target.value })}
                                    style={{ ...inputStyle, width: 'fit-content', minWidth: 220, maxWidth: '100%' }}
                                  >
                                    <option value="">Select</option>
                                    {doorTypeOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {trimOptionLabel(option)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label style={{ display: 'grid', gap: 4, flex: '0 0 120px' }}>
                                  <div style={labelStyle}>Qty (EA)</div>
                                  <input
                                    value={extra.qty}
                                    onChange={(e) => updateDoorTypeRow(room.room_id, extra.local_id, { qty: e.target.value })}
                                    style={inputStyle}
                                    disabled={!extra.trim_menu_id}
                                  />
                                </label>
                                <label style={{ display: 'grid', gap: 4, flex: '0 0 150px' }}>
                                  <div style={labelStyle}>Door Coverage</div>
                                  <select
                                    value={extra.door_sides || '1'}
                                    onChange={(e) => updateDoorTypeRow(room.room_id, extra.local_id, { door_sides: e.target.value })}
                                    style={inputStyle}
                                    disabled={!extra.trim_menu_id}
                                  >
                                    <option value="0.5">0.5</option>
                                    <option value="1">1.0</option>
                                  </select>
                                </label>
                                <button onClick={() => removeDoorTypeRow(room.room_id, extra.local_id)} style={{ ...btnDanger, flex: '0 0 auto' }}>
                                  Remove
                                </button>
                                <details style={{ gridColumn: '1 / -1' }}>
                                  <summary style={{ cursor: 'pointer', fontSize: 12, color: '#374151' }}>Prime/Prep</summary>
                                  <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                                    <label style={{ display: 'grid', gap: 4 }}>
                                      <div style={labelStyle}>Primer Mode</div>
                                      <select
                                        value={extra.primer_mode || ''}
                                        onChange={(e) =>
                                          updateDoorTypeRow(room.room_id, extra.local_id, {
                                            primer_mode: e.target.value,
                                            spot_prime_pct: e.target.value === 'Spot' ? extra.spot_prime_pct : '',
                                          })
                                        }
                                        style={inputStyle}
                                        disabled={!extra.trim_menu_id}
                                      >
                                        <option value="">Default ({room.door_primer_mode || room.trim_primer || 'None'})</option>
                                        <option value="Spot">Spot</option>
                                        <option value="Full">Full</option>
                                      </select>
                                    </label>
                                    {(extra.primer_mode || room.door_primer_mode || room.trim_primer) === 'Spot' && (
                                      <label style={{ display: 'grid', gap: 4 }}>
                                        <div style={labelStyle}>Spot %</div>
                                        <input
                                          value={extra.spot_prime_pct}
                                          onChange={(e) =>
                                            updateDoorTypeRow(room.room_id, extra.local_id, { spot_prime_pct: e.target.value })
                                          }
                                          style={inputStyle}
                                          disabled={!extra.trim_menu_id}
                                        />
                                      </label>
                                    )}
                                    <label style={{ display: 'grid', gap: 4 }}>
                                      <div style={labelStyle}>Prep Override</div>
                                      <select
                                        value={extra.prep_level_override || ''}
                                        onChange={(e) =>
                                          updateDoorTypeRow(room.room_id, extra.local_id, { prep_level_override: e.target.value })
                                        }
                                        style={inputStyle}
                                        disabled={!extra.trim_menu_id}
                                      >
                                        <option value="">Default ({room.door_prep_override || room.doors_prep_override || room.trim_prep_override || 'None'})</option>
                                        <option value="Light">Light</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Heavy">Heavy</option>
                                      </select>
                                    </label>
                                  </div>
                                </details>
                              </div>
                            ))}
                            {doorsSelected && (
                              <button onClick={() => addDoorTypeRow(room.room_id)} style={btnGhost}>
                                + Add Door Type
                              </button>
                            )}
                          </div>
                        </div>
                        )}
                      </div>

                      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#6b7280', overflowWrap: 'anywhere' }}>
                        Trim items map to sheet Trim Menu IDs from Constants: {generatedTrimItems
                          .filter((item) => item.room_id === room.room_id)
                          .map((item) => item.trim_menu_id)
                          .filter(Boolean)
                          .join(', ') || 'none selected yet'}
                      </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

          </div>
        )}

        {activeTab === 'Segments' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#4b5563' }}>
              If a room is set to Segmented, add segments here; wall sqft will be calculated from segments and height.
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 10 }}>
              <button
                type="button"
                style={{ ...btnGhost, justifySelf: 'start' }}
                onClick={() =>
                  setWallSegmentsOpen((v) => {
                    const next = !v
                    if (next) setAddSegmentRoom('')
                    return next
                  })
                }
              >
                {wallSegmentsOpen ? 'Hide Wall Segments' : 'Show Wall Segments'}
              </button>
              {wallSegmentsOpen && (
                <>
                  <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr auto' }}>
                    <select value={addSegmentRoom} onChange={(e) => setAddSegmentRoom(e.target.value)} style={inputStyle}>
                      <option value="">Select room</option>
                      {segRooms.map((room) => (
                        <option key={room.room_id} value={room.room_id}>
                          {room.room_name || room.room_id} ({room.room_id})
                        </option>
                      ))}
                    </select>
                    <button onClick={addSegmentToRoom} style={btnGhost} disabled={!addSegmentRoom}>
                      {iconLabel(Plus, 'Add Segment to Room', 14)}
                    </button>
                  </div>

                  {segments.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>No segment rows yet.</div>
                  ) : (
                    segments
                      .map((row, index) => ({ row, index }))
                      .filter(({ row }) => !addSegmentRoom || row.room_id === addSegmentRoom)
                      .map(({ row, index }) => {
                      const needsWallLabel = !!row.wall_color_override_id && !row.wall_label.trim()
                      const rowRoom = rooms.find((r) => r.room_id === row.room_id)
                      const isPanelCalc = normalizeWallsCalcMethod(row.walls_calc_method) === 'PANEL'
                      const showBaseExclude = rowRoom?.trim_include === 'Y'
                      return (
                        <div key={`${row.room_id}-${row.seg_no}-${index}`} style={roomCardStyle}>
                          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Room</div>
                              <select
                                value={row.room_id}
                                onChange={(e) => updateSegment(index, { room_id: e.target.value })}
                                style={inputStyle}
                              >
                                <option value="">Select room</option>
                                {segRooms.map((room) => (
                                  <option key={room.room_id} value={room.room_id}>
                                    {room.room_name || room.room_id} ({room.room_id})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Segment # (Auto)</div>
                              <input value={row.seg_no} readOnly style={{ ...inputStyle, background: '#f9fafb' }} />
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Complexity Type</div>
                              <select
                                value={normalizeWallComplexityTypeId(row.wall_complexity_type_id, catalogs)}
                                onChange={(e) =>
                                  updateSegment(index, { wall_complexity_type_id: e.target.value })
                                }
                                style={inputStyle}
                              >
                                {(catalogs.catalogs.wall_complexity_types.length
                                  ? catalogs.catalogs.wall_complexity_types
                                  : [{ id: 'STANDARD', label: 'Standard', active: 'Y', labor_multiplier: null, access_fee: null }]
                                ).map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Walls Calc Method</div>
                              <select
                                value={normalizeWallsCalcMethod(row.walls_calc_method)}
                                onChange={(e) => updateSegment(index, { walls_calc_method: normalizeWallsCalcMethod(e.target.value) })}
                                style={inputStyle}
                              >
                                <option value="REGULAR">Regular Segment</option>
                                <option value="PANEL">Panel</option>
                              </select>
                            </label>
                            {!isPanelCalc && (
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Segment Length (in)</div>
                                <input value={row.seglen_in} onChange={(e) => updateSegment(index, { seglen_in: e.target.value })} style={inputStyle} />
                              </label>
                            )}
                            {isPanelCalc && (
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Panel Length (in)</div>
                                <input value={row.panel_length_in} onChange={(e) => updateSegment(index, { panel_length_in: e.target.value })} style={inputStyle} />
                              </label>
                            )}
                            {isPanelCalc && (
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Height Bottom (in)</div>
                                <input value={row.panel_height_bottom_in} onChange={(e) => updateSegment(index, { panel_height_bottom_in: e.target.value })} style={inputStyle} />
                              </label>
                            )}
                            {isPanelCalc && (
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Height Top (in)</div>
                                <input value={row.panel_height_top_in} onChange={(e) => updateSegment(index, { panel_height_top_in: e.target.value })} style={inputStyle} />
                              </label>
                            )}
                            {!isPanelCalc && (
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Seg Wall Height (in, optional)</div>
                                <input
                                  value={row.seg_wallheight_in}
                                  onChange={(e) => updateSegment(index, { seg_wallheight_in: e.target.value })}
                                  placeholder={rowRoom?.wallheight_in ? `Fallback room height: ${rowRoom.wallheight_in}` : 'Uses room wall height'}
                                  style={inputStyle}
                                />
                              </label>
                            )}
                            {!isPanelCalc && showBaseExclude && (
                              <label style={{ display: 'grid', gap: 4 }}>
                                <div style={labelStyle}>Base Exclude (in)</div>
                                <input value={row.baseexclude_in} onChange={(e) => updateSegment(index, { baseexclude_in: e.target.value })} style={inputStyle} />
                              </label>
                            )}
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Wall Color Override</div>
                              <select
                                value={row.wall_color_override_id}
                                onChange={(e) =>
                                  updateSegment(index, { wall_color_override_id: normalizeColorId(e.target.value) })
                                }
                                style={inputStyle}
                              >
                                <option value="">None</option>
                                {catalogs.catalogs.color_codes.map((color) => (
                                  <option key={color.id} value={color.id}>
                                    {color.id} - {color.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={labelStyle}>Wall Label (for accent walls)</div>
                              <input value={row.wall_label} onChange={(e) => updateSegment(index, { wall_label: e.target.value })} style={inputStyle} />
                            </label>
                          </div>
                          {needsWallLabel && (
                            <div style={{ color: '#92400e', fontSize: 12 }}>
                              Add a wall label when using a color override so the wall is identifiable later.
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => removeSegment(index)} style={btnDanger}>
                              Remove Segment
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </>
              )}
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 10 }}>
              <button
                type="button"
                style={{ ...btnGhost, justifySelf: 'start' }}
                onClick={() =>
                  setCeilingSegmentsOpen((v) => {
                    const next = !v
                    if (next) setAddCeilingSegmentRoom('')
                    return next
                  })
                }
              >
                {ceilingSegmentsOpen ? 'Hide Ceiling Segments' : 'Show Ceiling Segments'}
              </button>
              {ceilingSegmentsOpen && (
                <>
                  <div style={{ fontWeight: 800 }}>Ceiling Segments</div>
                  <div style={{ fontSize: 12, color: '#4b5563' }}>
                    INPUT_CeilingSegments rows for ceiling geometry.
                  </div>
                  <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr auto' }}>
                    <select
                      value={addCeilingSegmentRoom}
                      onChange={(e) => setAddCeilingSegmentRoom(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select room</option>
                      {ceilingSegmentRooms.map((room) => (
                        <option key={room.room_id} value={room.room_id}>
                          {room.room_name || room.room_id} ({room.room_id})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={addCeilingSegmentToRoom}
                      style={btnGhost}
                      disabled={!addCeilingSegmentRoom}
                    >
                      {iconLabel(Plus, 'Add Ceiling Segment', 14)}
                    </button>
                  </div>

                  {ceilingSegments.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>No ceiling segment rows yet.</div>
                  ) : (
                    ceilingSegments
                      .map((row, index) => ({ row, index }))
                      .filter(({ row }) => !addCeilingSegmentRoom || row.room_id === addCeilingSegmentRoom)
                      .map(({ row, index }) => {
                      const rowRoom = rooms.find((r) => r.room_id === row.room_id)
                      return (
                      <div key={`cseg-${row.room_id}-${row.seg_no}-${index}`} style={roomCardStyle}>
                        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Room</div>
                            <select
                              value={row.room_id}
                              onChange={(e) => updateCeilingSegment(index, { room_id: e.target.value })}
                              style={inputStyle}
                            >
                              <option value="">Select room</option>
                              {ceilingSegmentRooms.map((room) => (
                                <option key={room.room_id} value={room.room_id}>
                                  {room.room_name || room.room_id} ({room.room_id})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Seg # (Auto)</div>
                            <input value={row.seg_no} readOnly style={{ ...inputStyle, background: '#f9fafb' }} />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Length_in</div>
                            <input
                              value={row.length_in}
                              onChange={(e) => updateCeilingSegment(index, { length_in: e.target.value })}
                              style={inputStyle}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Width_in</div>
                            <input
                              value={row.width_in}
                              onChange={(e) => updateCeilingSegment(index, { width_in: e.target.value })}
                              style={inputStyle}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Ceiling Height (in, optional)</div>
                            <input
                              value={row.ceiling_height_in ?? ''}
                              onChange={(e) => updateCeilingSegment(index, { ceiling_height_in: e.target.value })}
                              placeholder={rowRoom?.ceilingheight_in ? `Fallback room height: ${rowRoom.ceilingheight_in}` : 'Uses room ceiling height'}
                              style={inputStyle}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Active</div>
                            <select
                              value={row.active}
                              onChange={(e) => updateCeilingSegment(index, { active: toYN(e.target.value, 'Y') })}
                              style={inputStyle}
                            >
                              <option value="Y">Y</option>
                              <option value="N">N</option>
                            </select>
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Notes</div>
                            <input
                              value={row.notes}
                              onChange={(e) => updateCeilingSegment(index, { notes: e.target.value })}
                              style={inputStyle}
                            />
                          </label>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button onClick={() => removeCeilingSegment(index)} style={btnDanger}>
                            Remove Ceiling Segment
                          </button>
                        </div>
                      </div>
                    )})
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Rollers' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {(!engineColorList || (engineColorList.wall_colors ?? []).length === 0) && (
              <div style={{ color: '#6b7280' }}>
                Run Recalculate to load ENGINE_ColorList wall colors for roller selection.
              </div>
            )}

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Walls Rollers</div>
              {rollersDraft.filter((row) => row.scope === 'Wall').length === 0 && (
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  Add wall colors in Rooms (Walls Include = Y) to generate roller rows.
                </div>
              )}
              {rollersDraft
                .filter((row) => row.scope === 'Wall')
                .map((row, index) => {
                  const actualIndex = rollersDraft.findIndex(
                    (candidate) =>
                      candidate.scope === row.scope && candidate.wall_color_id === row.wall_color_id
                  )
                  return (
                    <div
                      key={`${row.scope}-${row.wall_color_id}-${index}`}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 10,
                        padding: 10,
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        Color {row.wall_color_id} (Wall sqft: {row.wall_sqft ?? '-'})
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Roller Size</div>
                        <select
                          value={row.roller_size_in}
                          onChange={(e) => updateRoller(actualIndex, { roller_size_in: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">Size</option>
                          {wallRollerSizes.map((size) => (
                            <option key={size} value={size}>
                              {size} in
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Number of Rollers</div>
                        <input
                          value={row.covers_qty}
                          onChange={(e) => updateRoller(actualIndex, { covers_qty: e.target.value })}
                          placeholder="1"
                          style={inputStyle}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Notes</div>
                        <input
                          value={row.notes}
                          onChange={(e) => updateRoller(actualIndex, { notes: e.target.value })}
                          placeholder="Notes (optional)"
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  )
                })}
            </div>

            {hasCeilings && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Ceiling Roller</div>
                {rollersDraft
                  .filter((row) => row.scope === 'Ceiling')
                  .map((row, index) => {
                    const actualIndex = rollersDraft.findIndex((candidate) => candidate.scope === 'Ceiling')
                    return (
                      <div
                        key={`${row.scope}-${index}`}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 10,
                          padding: 10,
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Ceiling</div>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Roller Size</div>
                          <select
                            value={row.roller_size_in}
                            onChange={(e) => updateRoller(actualIndex, { roller_size_in: e.target.value })}
                            style={inputStyle}
                          >
                            <option value="">Size</option>
                            {ceilingRollerSizes.map((size) => (
                              <option key={size} value={size}>
                                {size} in
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Number of Rollers</div>
                          <input
                            value={row.covers_qty}
                            onChange={(e) => updateRoller(actualIndex, { covers_qty: e.target.value })}
                            placeholder="1"
                            style={inputStyle}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Notes</div>
                          <input
                            value={row.notes}
                            onChange={(e) => updateRoller(actualIndex, { notes: e.target.value })}
                            placeholder="Notes (optional)"
                            style={inputStyle}
                          />
                        </label>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'PreJob Trips' && (
          <div style={{ display: 'grid', gap: 10 }}>
            {prejobTrips.map((trip, tripIndex) => (
              <div key={trip.id} style={roomCardStyle}>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <div style={labelStyle}>Trip #</div>
                    <input value={trip.trip_num} readOnly style={{ ...inputStyle, background: '#f9fafb' }} />
                  </label>
                  <label style={{ display: 'grid', gap: 4, gridColumn: '1 / -1' }}>
                    <div style={labelStyle}>Trip Notes</div>
                    <input
                      value={trip.notes}
                      onChange={(e) => updatePrejobTrip(tripIndex, { notes: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {trip.tasks.length === 0 && (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>No tasks yet. Add a task for this trip.</div>
                  )}
                  {trip.tasks.map((task, taskIndex) => (
                    <div key={task.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'grid', gap: 8 }}>
                      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Trip #</div>
                          <input value={trip.trip_num} readOnly style={{ ...inputStyle, background: '#f9fafb' }} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Entry Type</div>
                          <select
                            value={task.mode}
                            onChange={(e) =>
                              updatePrejobTask(tripIndex, taskIndex, {
                                mode: e.target.value as 'template' | 'manual',
                              })
                            }
                            style={inputStyle}
                          >
                            <option value="template">Template</option>
                            <option value="manual">Manual</option>
                          </select>
                        </label>
                        {task.mode === 'manual' && (
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Rollup Scope</div>
                            <select
                              value={task.rollup_scope}
                              onChange={(e) =>
                                updatePrejobTask(tripIndex, taskIndex, {
                                  rollup_scope: e.target.value as PreJobTaskDraft['rollup_scope'],
                                })
                              }
                              style={inputStyle}
                            >
                              <option value="Walls">Walls</option>
                              <option value="Ceilings">Ceilings</option>
                              <option value="Trim">Trim</option>
                            </select>
                          </label>
                        )}
                        {task.mode === 'template' ? (
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Task Name (from CAT_PreJobTrips)</div>
                          <select
                            value={task.task_template_id}
                            onChange={(e) => {
                              const selectedId = e.target.value
                              const selected = preJobTripOptions.find((opt) => opt.id === selectedId)
                              const selectedText = (e.target.selectedOptions?.[0]?.text || '').trim()
                              updatePrejobTask(tripIndex, taskIndex, {
                                task_template_id: selectedId,
                                task_name:
                                  selected?.task ||
                                  selectedText ||
                                  selected?.label ||
                                  selected?.man_trip_name ||
                                  selected?.trip_name ||
                                  '',
                                manual_task_name: '',
                                rollup_scope: toTripScope(selected?.rollup_scope || task.rollup_scope),
                              })
                            }}
                            style={inputStyle}
                          >
                            <option value="">Select task</option>
                            {preJobTripOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {(option.task || option.label || option.man_trip_name || option.trip_name || option.id).trim()}
                              </option>
                            ))}
                          </select>
                        </label>
                        ) : (
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Manual Trip/Task Name</div>
                          <input
                            value={task.manual_task_name}
                            onChange={(e) =>
                              updatePrejobTask(tripIndex, taskIndex, {
                                manual_task_name: e.target.value,
                                task_name: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </label>
                        )}
                        <label style={{ display: 'grid', gap: 4 }}>
                          <div style={labelStyle}>Qty</div>
                          <input value={task.qty} onChange={(e) => updatePrejobTask(tripIndex, taskIndex, { qty: e.target.value })} style={inputStyle} />
                        </label>
                        {task.mode === 'manual' && (
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Hours each</div>
                            <input value={task.hours_each} onChange={(e) => updatePrejobTask(tripIndex, taskIndex, { hours_each: e.target.value })} style={inputStyle} />
                          </label>
                        )}
                        {task.mode === 'manual' && (
                          <label style={{ display: 'grid', gap: 4 }}>
                            <div style={labelStyle}>Extra supplies $</div>
                            <input
                              value={task.extra_supplies}
                              onChange={(e) => updatePrejobTask(tripIndex, taskIndex, { extra_supplies: e.target.value })}
                              style={inputStyle}
                            />
                          </label>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => removePrejobTask(tripIndex, taskIndex)} style={btnDanger}>
                          Remove Task
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => addPrejobTask(tripIndex)} style={btnGhost}>
                      {iconLabel(Plus, 'Add Task', 14)}
                    </button>
                    <div style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
                      Choose Template or Manual for each task.
                    </div>
                    <button onClick={() => removePrejobTrip(tripIndex)} style={btnDanger}>
                      Remove Trip
                    </button>
                  </div>
              </div>
            ))}
            <button onClick={addPrejobTrip} style={btnGhost}>
              {iconLabel(Plus, 'Add Pre-Job Trip', 14)}
            </button>
          </div>
        )}

        {activeTab === 'Summary & Final Adjustments' && (
          <div style={{ display: 'grid', gap: 10 }}>
            {workbookUrl && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <a href={workbookUrl} target="_blank" rel="noreferrer" style={btnGhost}>
                  {iconLabel(Link2, 'Open Workbook', 14)}
                </a>
              </div>
            )}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Paint Product Selection</div>
              {missingSettings.length > 0 && (
                <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Missing selections</div>
                  {missingSettings.map((msg) => (
                    <div key={msg} style={{ fontSize: 12, color: '#92400e' }}>
                      - {msg}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                {hasWalls && (
                  <label style={{ display: 'grid', gap: 4 }}>
                    <div style={labelStyle}>Walls Paint Product {hasWalls ? '(Required)' : '(Optional)'}</div>
                    <select
                      value={jobsettings.walls_paint_id}
                      onChange={(e) => saveJobSettings('walls_paint_id', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select wall product</option>
                      {wallPaintOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {paintOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {hasCeilings && (
                  <label style={{ display: 'grid', gap: 4 }}>
                    <div style={labelStyle}>Ceiling Paint Product {hasCeilings ? '(Required)' : '(Optional)'}</div>
                    <select
                      value={jobsettings.ceiling_paint_id}
                      onChange={(e) => saveJobSettings('ceiling_paint_id', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select ceiling product</option>
                      {ceilingPaintOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {paintOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {hasTrim && (
                  <label style={{ display: 'grid', gap: 4 }}>
                    <div style={labelStyle}>Trim Paint Product {hasTrim ? '(Required)' : '(Optional)'}</div>
                    <select
                      value={jobsettings.trim_paint_id}
                      onChange={(e) => saveJobSettings('trim_paint_id', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select trim product</option>
                      {trimPaintOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {paintOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {needsWallsPrimerProduct && (
                  <label style={{ display: 'grid', gap: 4 }}>
                    <div style={labelStyle}>Wall Primer Product (Required)</div>
                    <select
                      value={jobsettings.walls_primer_id}
                      onChange={(e) => saveJobSettings('walls_primer_id', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select wall primer</option>
                      {primerPaintOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {paintOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {needsCeilingPrimerProduct && (
                  <label style={{ display: 'grid', gap: 4 }}>
                    <div style={labelStyle}>Ceiling Primer Product (Required)</div>
                    <select
                      value={jobsettings.ceiling_primer_id}
                      onChange={(e) => saveJobSettings('ceiling_primer_id', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select ceiling primer</option>
                      {primerPaintOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {paintOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {needsTrimPrimerProduct && (
                  <label style={{ display: 'grid', gap: 4 }}>
                    <div style={labelStyle}>Trim Primer Product (Required)</div>
                    <select
                      value={jobsettings.trim_primer_id}
                      onChange={(e) => saveJobSettings('trim_primer_id', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select trim primer</option>
                      {primerPaintOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {paintOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {hasTrim && (
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, display: 'grid', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Trim Material Inputs (Required when Trim is included)</div>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Trim Paint</div>
                      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '220px 150px', justifyContent: 'start' }}>
                        <input
                          value={jobsettings.trim_paint_qty}
                          onChange={(e) => saveJobSettings('trim_paint_qty', e.target.value)}
                          placeholder="Qty"
                          style={{ ...inputStyle, maxWidth: 220 }}
                        />
                        <select
                          value={jobsettings.trim_paint_uom}
                          onChange={(e) => saveJobSettings('trim_paint_uom', e.target.value)}
                          style={inputStyle}
                        >
                          <option value="">Unit</option>
                          <option value="Gallon">Gallon</option>
                          <option value="Quart">Quart</option>
                        </select>
                      </div>
                    </label>
                    {needsTrimPrimer && (
                      <label style={{ display: 'grid', gap: 4 }}>
                        <div style={labelStyle}>Trim Primer</div>
                        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '220px 150px', justifyContent: 'start' }}>
                          <input
                            value={jobsettings.trim_primer_qty}
                            onChange={(e) => saveJobSettings('trim_primer_qty', e.target.value)}
                            placeholder="Qty"
                            style={{ ...inputStyle, maxWidth: 220 }}
                          />
                          <select
                            value={jobsettings.trim_primer_uom}
                            onChange={(e) => saveJobSettings('trim_primer_uom', e.target.value)}
                            style={inputStyle}
                          >
                            <option value="">Unit</option>
                            <option value="Gallon">Gallon</option>
                            <option value="Quart">Quart</option>
                          </select>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {[
                ['FinalTotal', 'Final Total'],
                ['WallsTotal', 'Walls Total'],
                ['CeilingsTotal', 'Ceilings Total'],
                ['TrimTotal', 'TRIM & DOORS TOTAL'],
                ['PreJobTotal', 'Pre-Job Total'],
              ].map(([key, label]) => (
                <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', fontWeight: 800 }}>{label}</div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>
                    {formatCurrency(outputs[key])}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 800 }}>Advanced Adjustments</div>
                <button
                  onClick={() => setAdvancedAdjustmentsOpen((v) => !v)}
                  style={btnGhost}
                  type="button"
                >
                  {advancedAdjustmentsOpen ? 'Hide' : 'Show'}
                </button>
              </div>
              {advancedAdjustmentsOpen && (
                <>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    These values write to INPUT_JobSettings and are intended for post-review adjustments.
                  </div>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Walls Extra Supplies ($)</div>
                      <input
                        value={jobsettings.extra_supplies_walls}
                        onChange={(e) => saveJobSettings('extra_supplies_walls', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Ceilings Extra Supplies ($)</div>
                      <input
                        value={jobsettings.extra_supplies_ceilings}
                        onChange={(e) => saveJobSettings('extra_supplies_ceilings', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Trim Extra Supplies ($)</div>
                      <input
                        value={jobsettings.extra_supplies_trim}
                        onChange={(e) => saveJobSettings('extra_supplies_trim', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Walls Paint Gallons Override</div>
                      <input
                        value={jobsettings.walls_paint_gal_override}
                        onChange={(e) => saveJobSettings('walls_paint_gal_override', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Ceilings Paint Gallons Override</div>
                      <input
                        value={jobsettings.ceiling_paint_gal_override}
                        onChange={(e) => saveJobSettings('ceiling_paint_gal_override', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={labelStyle}>Primer Gallons Override</div>
                      <input
                        value={jobsettings.primer_gal_override}
                        onChange={(e) => saveJobSettings('primer_gal_override', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => void runRecalc()} disabled={recalculating} style={btnPrimary}>
                      {recalculating ? 'Recalculating...' : iconLabel(Calculator, 'Apply Adjustments and Recalculate')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 10,
  fontSize: 13,
  padding: '8px 10px',
  width: '100%',
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: '#6b7280',
  textTransform: 'uppercase',
  fontWeight: 800,
}

const roomCardStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 10,
  display: 'grid',
  gap: 10,
}

const chipLabel: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  minWidth: 130,
}

const btnPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #111',
  background: '#111',
  color: '#fff',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(17,24,39,0.12)',
}

const btnGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 12,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#111',
  fontWeight: 700,
  fontSize: 12,
  textDecoration: 'none',
  cursor: 'pointer',
}

const btnDanger: CSSProperties = {
  ...btnGhost,
  border: '1px solid #fecaca',
  background: '#fff1f2',
  color: '#9f1239',
}


