import { copyDriveFile, exportDriveFile } from '@/lib/server/googleDrive'
import { clearRanges, readRangeValues, writeRangeValues } from '@/lib/server/googleSheets'
import { supabaseAdmin } from '@/lib/server/org'

const FALLBACK_TEMPLATE_ID = '1zufQIEtGqP8wZoPjg203TG2HkYS9iSdvBImHC6Ok3Rs'
const WORKBOOK_BUCKET = 'estimate-workbooks'
type HeaderMap = {
  headerRow: number
  startRow: number
  indexByHeader: Map<string, number>
  indexByNormalizedHeader: Map<string, number>
}

type SheetConfig = {
  sheetName: string
  requiredHeaders: string[]
  writableHeaders: string[]
  softDelete: boolean
  optional?: boolean
  startRowOffset?: number
  minStartRow?: number
  fixedStartRow?: number
  requiredValueHeaders?: string[]
  validateRows?: (rows: Record<string, unknown>[]) => MissingInput[]
}

export type MissingInput = {
  tab: string
  header: string
  room_id?: string
  message: string
}

export class MissingInputsError extends Error {
  missing_inputs: MissingInput[]
  constructor(missingInputs: MissingInput[]) {
    super('Missing required estimate inputs')
    this.name = 'MissingInputsError'
    this.missing_inputs = missingInputs
  }
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNumberish(value: unknown) {
  return value == null || value === '' ? '' : value
}

function toSheetCell(value: unknown): string | number | boolean | null {
  if (value == null || value === '') return ''
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return String(value)
}

function toYN(value: unknown, fallback: 'Y' | 'N' = 'N') {
  const raw = String(value ?? '').trim().toUpperCase()
  if (raw === 'Y' || raw === 'N') return raw
  return fallback
}

function parseSpreadsheetIdFromPath(path: string | null | undefined) {
  const match = /sheet_([a-zA-Z0-9\-_]+)\.xlsx/.exec(String(path ?? ''))
  return match?.[1] ?? null
}

function buildSheetPath(orgId: string, estimateId: string, spreadsheetId: string) {
  return `org/${orgId}/estimates/${estimateId}/sheet_${spreadsheetId}.xlsx`
}

function sanitizeDriveName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function columnLetterFromIndex(index: number) {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function parseMaybeNumber(value: string | null | undefined) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const cleaned = raw.replace(/[$,%\s,]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : raw
}

function normalizeHeader(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeSchemaKey(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function getHeaderIndex(map: HeaderMap, header: string) {
  const exact = map.indexByHeader.get(header)
  if (exact != null) return exact
  return map.indexByNormalizedHeader.get(normalizeHeader(header))
}

function valueAt(row: string[], index: number) {
  if (index < 0 || index >= row.length) return ''
  return row[index] ?? ''
}

function findActiveJobControlTarget(values: string[][]) {
  const keyLabels = new Set([
    'activejobid',
    'activejob',
    'jobidactive',
    'currentjobid',
    'selectedjobid',
  ])

  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] ?? []
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const normalized = normalizeHeader(row[colIndex])
      if (keyLabels.has(normalized)) {
        return { row: rowIndex + 2, col: colIndex + 2 }
      }
      if (colIndex === 0 && normalized === 'jobid') {
        return { row: rowIndex + 2, col: 2 }
      }
    }
  }

  return null
}

async function writeActiveJobIdToJobControl(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
  jobId: string
}) {
  const candidateSheets = [
    'Job Control',
    'JOB CONTROL',
    'JobControl',
    'JOB_CONTROL',
    'Control',
    'CONTROL',
  ]

  for (const sheetName of candidateSheets) {
    const read = await readRangeValues({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.userId,
      spreadsheetId: params.spreadsheetId,
      range: `${sheetName}!A1:F200`,
    })
    if ('error' in read) continue

    const target = findActiveJobControlTarget(read.values)
    if (!target) continue

    const col = columnLetterFromIndex(target.col - 1)
    const write = await writeRangeValues({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.userId,
      spreadsheetId: params.spreadsheetId,
      updates: [{ range: `${sheetName}!${col}${target.row}`, values: [[params.jobId]] }],
    })
    if ('error' in write) {
      throw new Error(`Workbook read/write error: ${write.error}`)
    }
    return
  }
}

async function findHeaders(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
  sheetName: string
  requiredHeaders: string[]
  writableHeaders: string[]
}) {
  const scan = await readRangeValues({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: params.spreadsheetId,
    range: `${params.sheetName}!A1:ZZ2000`,
  })
  if ('error' in scan) {
    throw new Error(`Missing sheet/tab/header: unable to read ${params.sheetName}: ${scan.error}`)
  }

  let best: HeaderMap | null = null
  let bestScore = -1
  for (let rowIndex = 0; rowIndex < scan.values.length; rowIndex += 1) {
    const row = scan.values[rowIndex].map((cell: string) => String(cell ?? '').trim())
    if (!row.length) continue
    const map = new Map<string, number>()
    const normalizedMap = new Map<string, number>()
    row.forEach((cell: string, idx: number) => {
      if (!cell) return
      map.set(cell, idx)
      const normalized = normalizeHeader(cell)
      if (normalized && !normalizedMap.has(normalized)) {
        normalizedMap.set(normalized, idx)
      }
    })
    const candidate = {
      headerRow: rowIndex + 1,
      startRow: rowIndex + 2,
      indexByHeader: map,
      indexByNormalizedHeader: normalizedMap,
    } satisfies HeaderMap
    const requiredMatched = params.requiredHeaders.filter((h) => getHeaderIndex(candidate, h) != null)
      .length
    const searchHeaders =
      params.requiredHeaders.length > 0 ? params.requiredHeaders : params.writableHeaders
    const matchedWritable = searchHeaders.filter((h) => getHeaderIndex(candidate, h) != null).length

    if (params.requiredHeaders.length > 0 && requiredMatched !== params.requiredHeaders.length) {
      continue
    }
    if (params.requiredHeaders.length === 0 && matchedWritable < 2) {
      continue
    }

    if (matchedWritable > bestScore) {
      best = candidate
      bestScore = matchedWritable
    }
  }

  if (best) {
    // Some templates keep JobID on a different row than the main column headers.
    // Backfill JobID index by scanning the first section of the sheet when missing.
    if (getHeaderIndex(best, 'JobID') == null) {
      for (let rowIndex = 0; rowIndex < Math.min(scan.values.length, 60); rowIndex += 1) {
        const row = scan.values[rowIndex] ?? []
        for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
          if (normalizeHeader(row[colIndex]) !== 'jobid') continue
          best.indexByHeader.set('JobID', colIndex)
          if (!best.indexByNormalizedHeader.has('jobid')) {
            best.indexByNormalizedHeader.set('jobid', colIndex)
          }
          rowIndex = scan.values.length
          break
        }
      }
    }
    return best
  }
  throw new Error(`Missing sheet/tab/header: required headers not found in ${params.sheetName}`)
}

async function replaceRowsByColumns(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
  map: HeaderMap
  sheetName: string
  writableHeaders: string[]
  rows: Record<string, unknown>[]
}) {
  const startRow = params.sheetName === 'INPUT_TrimLines' ? Math.max(params.map.startRow, 6) : params.map.startRow
  const endRow = startRow + 1000
  const clearTargets = params.writableHeaders
    .map((header) => ({ header, idx: getHeaderIndex(params.map, header) }))
    .filter((entry) => entry.idx != null)
    .map((header) => {
      const col = columnLetterFromIndex(header.idx!)
      return `${params.sheetName}!${col}${startRow}:${col}${endRow}`
    })

  if (clearTargets.length) {
    const clearResult = await clearRanges({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.userId,
      spreadsheetId: params.spreadsheetId,
      ranges: clearTargets,
    })
    if ('error' in clearResult) {
      throw new Error(`Workbook read/write error: ${clearResult.error}`)
    }
  }

  if (!params.rows.length) return
  const updates = params.writableHeaders
    .map((header) => ({ header, idx: getHeaderIndex(params.map, header) }))
    .filter((entry) => entry.idx != null)
    .map((header) => {
      const col = columnLetterFromIndex(header.idx!)
      return {
        range: `${params.sheetName}!${col}${startRow}:${col}${startRow + params.rows.length - 1}`,
        values: params.rows.map((row) => [toSheetCell(row[header.header])]),
      }
    })
  if (!updates.length) return

  const writeResult = await writeRangeValues({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: params.spreadsheetId,
    updates,
  })
  if ('error' in writeResult) {
    throw new Error(`Workbook read/write error: ${writeResult.error}`)
  }
}

async function softDeleteAndAppendRows(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
  map: HeaderMap
  sheetName: string
  writableHeaders: string[]
  jobId: string
  rows: Record<string, unknown>[]
}) {
  const startRow = params.sheetName === 'INPUT_TrimLines' ? Math.max(params.map.startRow, 6) : params.map.startRow
  const activeIdx = getHeaderIndex(params.map, 'Active?') ?? getHeaderIndex(params.map, 'Active')
  const jobIdx = getHeaderIndex(params.map, 'JobID')
  if (activeIdx == null || jobIdx == null) {
    throw new Error(`Missing sheet/tab/header: ${params.sheetName} requires JobID and Active/Active?`)
  }

  const endRow = startRow + 1000
  const readRange = `${params.sheetName}!A${startRow}:${columnLetterFromIndex(
    Math.max(activeIdx, jobIdx)
  )}${endRow}`
  const existing = await readRangeValues({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: params.spreadsheetId,
    range: readRange,
  })
  if ('error' in existing) {
    throw new Error(`Workbook read/write error: ${existing.error}`)
  }

  const activeCol = columnLetterFromIndex(activeIdx)
  const deactivate = existing.values
    .map((row: string[], idx: number) => {
      const rowNo = startRow + idx
      const rowJob = asText(valueAt(row, jobIdx))
      const rowActive = asText(valueAt(row, activeIdx)).toUpperCase()
      if (rowJob !== params.jobId) return null
      if (rowActive === 'N') return null
      return { range: `${params.sheetName}!${activeCol}${rowNo}`, values: [['N']] }
    })
    .filter(Boolean) as { range: string; values: (string | number | boolean | null)[][] }[]

  if (deactivate.length) {
    const deactivated = await writeRangeValues({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.userId,
      spreadsheetId: params.spreadsheetId,
      updates: deactivate,
    })
    if ('error' in deactivated) {
      throw new Error(`Workbook read/write error: ${deactivated.error}`)
    }
  }

  if (!params.rows.length) return
  const appendStart = startRow + existing.values.length
  const updates = params.writableHeaders
    .map((header) => ({ header, idx: getHeaderIndex(params.map, header) }))
    .filter((entry) => entry.idx != null)
    .map((header) => {
      const col = columnLetterFromIndex(header.idx!)
      return {
        range: `${params.sheetName}!${col}${appendStart}:${col}${appendStart + params.rows.length - 1}`,
        values: params.rows.map((row) => [toSheetCell(row[header.header])]),
      }
    })
  const appended = await writeRangeValues({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: params.spreadsheetId,
    updates,
  })
  if ('error' in appended) {
    throw new Error(`Workbook read/write error: ${appended.error}`)
  }
}

async function ensureSpreadsheetForEstimate(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  jobId: string
  sheetFilePath: string | null
  forceNewSheet?: boolean
}) {
  const existingSpreadsheetId = parseSpreadsheetIdFromPath(params.sheetFilePath)
  if (existingSpreadsheetId && !params.forceNewSheet) {
    return {
      spreadsheetId: existingSpreadsheetId,
      sheetFilePath: params.sheetFilePath!,
    } as const
  }

  const templateId =
    process.env.GOOGLE_SHEETS_ESTIMATES_TEMPLATE_ID ??
    process.env.GOOGLE_SHEETS_ESTIMATE_TEMPLATE_ID ??
    FALLBACK_TEMPLATE_ID
  const folderId =
    process.env.GOOGLE_DRIVE_ESTIMATE_SHEETS_FOLDER_ID ??
    process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID ??
    null

  if (!templateId || !folderId) {
    throw new Error(
      'Workbook read/write error: missing template/folder env vars for estimate workbook copy'
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const fileName = sanitizeDriveName(`Estimate Workbook - ${params.jobId} - ${today}`).slice(0, 120)
  const copied = await copyDriveFile({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    templateFileId: templateId,
    folderId,
    name: fileName,
  })
  if ('error' in copied) {
    throw new Error(`Workbook read/write error: ${copied.error}`)
  }

  const sheetFilePath = buildSheetPath(params.orgId, params.estimateId, copied.file.id)
  const update = await supabaseAdmin
    .from('estimates')
    .update({ sheet_file_path: sheetFilePath })
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
  if (update.error) {
    throw new Error(`Workbook read/write error: ${update.error.message}`)
  }

  return { spreadsheetId: copied.file.id, sheetFilePath } as const
}

async function readSchemaVersion(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
}) {
  const constants = await readRangeValues({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: params.spreadsheetId,
    range: 'Constants!A1:ZZ250',
  })
  if ('error' in constants) {
    throw new Error(`Missing sheet/tab/header: ${constants.error}`)
  }

  let schema = ''
  for (const row of constants.values) {
    for (let i = 0; i < row.length; i += 1) {
      if (normalizeSchemaKey(row[i]) !== 'schemaversion') continue
      schema = asText(row[i + 1])
      if (!schema) schema = asText(row[i + 2])
      if (schema) break
    }
    if (schema) break
  }

  if (!schema) {
    throw new Error('Missing sheet/tab/header: Constants!SchemaVersion not found')
  }
  return schema
}

function mapJobSettingsRow(row: Unsafe, jobId: string) {
  if (!row) return []
  const primerFallback = asText(
    row.primer_id || row.walls_primer_id || row.ceiling_primer_id || row.trim_primer_id
  )
  return [
    {
      JobID: jobId,
      WallsPaintProductID: asText(row.walls_paint_id),
      CeilingPaintProductID: asText(row.ceiling_paint_id),
      TrimPaintProductID: asText(row.trim_paint_id),
      PrimerProductID: primerFallback,
      Wall_PrimerProductID: asText(row.walls_primer_id),
      Ceiling_PrimerProductID: asText(row.ceiling_primer_id),
      Trim_PrimerProductID: asText(row.trim_primer_id),
      LaborRateOverride_perHr: asNumberish(row.override_labor_rate),
      MarkupOverride_multiplier: asNumberish(row.override_markup),
      RoundingIncrement_hours: asNumberish(row.rounding_increment_hours),
      WorkdayHours: asNumberish(row.dayhours),
      TrimPaintQty: asNumberish(row.trim_paint_qty),
      TrimPaintUOM: asText(row.trim_paint_uom),
      TrimPrimerQty: asNumberish(row.trim_primer_qty),
      TrimPrimerUOM: asText(row.trim_primer_uom),
      Notes: asText(row.notes),
      WallsPaint_gal_override: asNumberish(row.walls_paint_gal_override),
      CeilingPaint_gal_override: asNumberish(row.ceiling_paint_gal_override),
      Primer_gal_override: asNumberish(row.primer_gal_override),
      'ExtraSupplies_Walls$': asNumberish(row.extra_supplies_walls),
      'ExtraSupplies_Ceilings$': asNumberish(row.extra_supplies_ceilings),
      'ExtraSupplies_Trim$': asNumberish(row.extra_supplies_trim),
    },
  ]
}

function mapRoomRow(row: Unsafe, jobId: string) {
  const complexityType = asText(
    row.wall_complexity_type_id || row.wallcomplexitytypeid || row.complexitytypeid || 'STANDARD'
  ).toUpperCase()
  return {
    JobID: jobId,
    RoomID: asText(row.room_id),
    'Room Name': asText(row.room_name),
    'Mode (RECT/SEG)': asText(row.mode || 'RECT').toUpperCase(),
    'Length_in (RECT)': asNumberish(row.length_in),
    'Width_in (RECT)': asNumberish(row.width_in),
    WallHeight_in: asNumberish(row.wallheight_in),
    CeilingHeight_in: asNumberish(row.ceilingheight_in),
    'CeilingSqft_override (SEG optional)': asNumberish(row.ceilingsqft_override),
    'BaseExclude_in (RECT)': asNumberish(row.baseexclude_in),
    'Walls Include': toYN(row.walls_include, 'N'),
    WallComplexityTypeID: complexityType,
    ComplexityTypeID: complexityType,
    'Walls Primer': asText(row.walls_primer),
    'Walls Topcoats': asNumberish(row.walls_topcoats),
    'Walls Prep Override': asText(row.walls_prep_override),
    'Ceiling Include': toYN(row.ceiling_include, 'N'),
    'Ceiling Primer': asText(row.ceiling_primer),
    'Ceiling Topcoats': asNumberish(row.ceiling_topcoats),
    'Ceiling Prep Level': asText(row.ceiling_prep_level || row.ceiling_prep_override),
    'Ceiling Prep Override': asText(row.ceiling_prep_override),
    'Ceiling Height Surcharge $': asNumberish(row.ceiling_height_surcharge),
    'Trim Include': toYN(row.trim_include, 'N'),
    'Trim Primer': asText(row.trim_primer),
    'Trim Topcoats': asNumberish(row.trim_topcoats),
    'Trim Prep Override': asText(row.trim_prep_override),
    'Paint Base?': toYN(row.paint_base, 'N'),
    'Paint Crown?': toYN(row.paint_crown, 'N'),
    'Ceiling Crown Check': toYN(row.paint_crown, 'N'),
    'Paint Window Casing?': toYN(row.paint_window_casing, 'N'),
    'Paint Door Casing?': toYN(row.paint_door_casing, 'N'),
    'Paint Doors?': toYN(row.paint_doors, 'N'),
    'WallColorID (A/B/C...)': asText(row.wall_color_id).toUpperCase(),
    CeilingTypeID: asText(row.ceiling_type_id),
  }
}

function mapWallsRow(row: Unsafe, jobId: string, defaultWallsPrepLevel: string) {
  const prepLevel = asText(row.walls_prep_level || row.walls_prep_override || defaultWallsPrepLevel)
  const wallSqftOverride = asNumberish(row.wall_sqft_override)
  const openingsSqft = asNumberish(row.openings_sqft)
  const notes = asText(row.walls_notes)
  const active = toYN(row.walls_include, 'N')
  return {
    JobID: jobId,
    RoomID: asText(row.room_id),
    PrepLevel: prepLevel,
    'Prep Level': prepLevel,
    WallsPrepLevel: prepLevel,
    WallSqft_override: wallSqftOverride,
    WallSqftOverride: wallSqftOverride,
    WallSqft: wallSqftOverride,
    OpeningsSqft: openingsSqft,
    OpeningsSqft_override: openingsSqft,
    OpeningsSqftOverride: openingsSqft,
    Notes: notes,
    'Active?': active,
    Active: active,
  }
}

function mapSegmentRow(row: Unsafe, jobId: string) {
  const complexityType = asText(
    row.wall_complexity_type_id || row.wallcomplexitytypeid || row.complexitytypeid || 'STANDARD'
  ).toUpperCase()
  const wallsCalcMethod = asText(
    row.walls_calc_method || row.wallscalcmethod || row.walls_calcmethod || 'REGULAR'
  ).toUpperCase() === 'PANEL'
    ? 'PANEL'
    : 'REGULAR'
  return {
    JobID: jobId,
    RoomID: asText(row.room_id),
    'Seg#': asNumberish(row.seg_no),
    SegLen_in: asNumberish(row.seglen_in),
    SegWallHeight_in: asNumberish(row.seg_wallheight_in ?? row.segwallheight_in),
    SegWallHeightIn: asNumberish(row.seg_wallheight_in ?? row.segwallheight_in),
    'SegWallHeight_in (override)': asNumberish(row.seg_wallheight_in ?? row.segwallheight_in),
    'segwallheight_in (override)': asNumberish(row.seg_wallheight_in ?? row.segwallheight_in),
    'segwallgeight_in (override)': asNumberish(row.seg_wallheight_in ?? row.segwallheight_in),
    WallsCalcMethod: wallsCalcMethod,
    WallCalcMethod: wallsCalcMethod,
    WallComplexityTypeID: complexityType,
    WallComplexityType: complexityType,
    WallComplexityID: complexityType,
    Wall_Complexity_Type_ID: complexityType,
    'Wall Complexity Type ID': complexityType,
    'Wall Complexity Type': complexityType,
    ComplexityTypeID: complexityType,
    'ComplexityTypeID (optional)': complexityType,
    ComplexityType: complexityType,
    'Complexity Type ID': complexityType,
    'Complexity Type ID (optional)': complexityType,
    'Complexity Type': complexityType,
    BaseExclude_in: asNumberish(row.baseexclude_in),
    Notes: asText(row.notes),
    'WallLabel (optional)': asText(row.wall_label),
    'WallColorOverrideID (optional)': asText(row.wall_color_override_id).toUpperCase(),
    'Active?': toYN(row.active, 'Y'),
  }
}

function mapWallPanelRow(row: Unsafe, jobId: string) {
  const complexityType = asText(
    row.wall_complexity_type_id || row.wallcomplexitytypeid || row.complexitytypeid || 'STANDARD'
  ).toUpperCase()
  const active = toYN(row.active, 'Y')
  return {
    JobID: jobId,
    RoomID: asText(row.room_id),
    'Panel#': asNumberish(row.seg_no),
    'Seg#': asNumberish(row.seg_no),
    Length_in: asNumberish(row.panel_length_in ?? row.length_in),
    PanelLength_in: asNumberish(row.panel_length_in ?? row.length_in),
    HeightBottom_in: asNumberish(row.panel_height_bottom_in ?? row.height_bottom_in),
    BottomHeight_in: asNumberish(row.panel_height_bottom_in ?? row.height_bottom_in),
    HeightTop_in: asNumberish(row.panel_height_top_in ?? row.height_top_in),
    TopHeight_in: asNumberish(row.panel_height_top_in ?? row.height_top_in),
    ComplexityTypeID: complexityType,
    'ComplexityTypeID (optional)': complexityType,
    WallLabel: asText(row.wall_label),
    WallLabel_optional: asText(row.wall_label),
    WallColorOverrideID: asText(row.wall_color_override_id).toUpperCase(),
    WallColorOverrideID_optional: asText(row.wall_color_override_id).toUpperCase(),
    BaseExclude_in: asNumberish(row.baseexclude_in),
    Notes: asText(row.notes),
    Active: active,
    'Active?': active,
  }
}

function mapCeilingSegmentRow(row: Unsafe, jobId: string) {
  const active = toYN(row.active, 'Y')
  const ceilingHeight = asNumberish(
    row.ceiling_height_in ?? row.ceilingheight_in ?? row.height_in ?? row.seg_ceiling_height_in
  )
  return {
    JobID: jobId,
    RoomID: asText(row.room_id),
    'Seg#': asNumberish(row.seg_no),
    Length_in: asNumberish(row.length_in),
    Width_in: asNumberish(row.width_in),
    Height_in: ceilingHeight,
    CeilingHeight_in: ceilingHeight,
    SegCeilingHeight_in: ceilingHeight,
    'Height_in (override)': ceilingHeight,
    'Ceiling Height (override)': ceilingHeight,
    Notes: asText(row.notes),
    Active: active,
    'Active?': active,
  }
}

function mapRollerRow(row: Unsafe, jobId: string) {
  const scope = asText(row.scope)
  const wallColorId = asText(row.wall_color_id).toUpperCase()
  const rollerSize = asNumberish(row.roller_size_in)
  const active = toYN(row.active, 'Y')
  return {
    JobID: jobId,
    Scope: scope,
    ColorID: wallColorId,
    RollerSize: rollerSize,
    Quantity: asNumberish(row.covers_qty),
    Notes: asText(row.notes),
    'Active?': active,
  }
}

function mapPreJobRow(row: Unsafe, jobId: string) {
  const tripNum = asNumberish(row.trip_num)
  const rollupScope = asText(row.rollup_scope || row.category)
  const taskTemplateId = asText(row.task_template_id)
  const manualTaskName = taskTemplateId
    ? ''
    : asText(row.manual_task_name || row.man_trip_name || row.trip_name)
  const manQty = asNumberish(row.man_qty ?? row.qty)
  const hoursEach = asNumberish(row.hours_each ?? row.man_hours_each)
  const taskNameForSheet = asText(
    row.task_name || row.task_label || row.manual_task_name || row.man_trip_name || row.trip_name || row.task || ''
  )
  const qty = asNumberish(row.qty)
  const extraSupplies = asNumberish(row.extra_supplies)
  const notes = asText(row.notes)
  const active = toYN(row.active, 'Y')
  return {
    JobID: jobId,
    TripNum: tripNum,
    RollupScope: rollupScope,
    TaskTemplateID: taskTemplateId,
    TaskName: taskNameForSheet || manualTaskName || '',
    'Task Name': taskNameForSheet || manualTaskName || '',
    ManualTaskName: manualTaskName,
    Man_TripName: manualTaskName,
    Man_Qty: manQty,
    HoursEach: hoursEach,
    Man_Hours_each: hoursEach,
    Task: taskNameForSheet || manualTaskName || '',
    Qty: qty,
    'ExtraSupplies$': extraSupplies,
    ExtraSupplies: extraSupplies,
    Notes: notes,
    'Active?': active,
  }
}

function hasPrimerUsageInRooms(rooms: Unsafe[], trimLines: Unsafe[]) {
  const isPrimerModeEnabled = (value: unknown) => {
    const raw = asText(value).toLowerCase()
    if (!raw) return false
    return !['none', 'n', 'no', 'false', '0'].includes(raw)
  }
  const roomPrimerUsage = rooms.some(
    (row) =>
      isPrimerModeEnabled(row.walls_primer) ||
      isPrimerModeEnabled(row.ceiling_primer) ||
      isPrimerModeEnabled(row.trim_primer)
  )
  const trimPrimerUsage = trimLines.some((row) => isPrimerModeEnabled(row.primer_mode))
  return roomPrimerUsage || trimPrimerUsage
}

function mapTrimLineRow(row: Unsafe, jobId: string) {
  const active = toYN(row.active, 'Y')
  const trimItemId = asText(row.trim_menu_id || row.trim_item_id)
  const unit = asText(row.unit)
  const coats = asNumberish(row.coats)
  const autoCalc = toYN(row.auto_calc, 'N')
  const primerMode = asText(row.primer_mode)
  const spotPrimePct = asNumberish(row.spot_prime_pct)
  const prepLevel = asText(row.prep_level_override)
  return {
    JobID: jobId,
    RoomID: asText(row.room_id),
    TrimMenuID: trimItemId,
    TrimItemID: trimItemId,
    ItemID: trimItemId,
    'TrimItemID (from Constants)': trimItemId,
    Qty: asNumberish(row.qty),
    Quantity: asNumberish(row.qty),
    PrimerMode: primerMode,
    SpotPrimePct: spotPrimePct,
    Coats: coats,
    PrepLevelOverride: prepLevel,
    AutoCalc: autoCalc,
    Unit: unit,
    Notes: asText(row.notes),
    'Active?': active,
    Active: active,
  }
}

function normalizeTrimCategoryKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function inferTrimCategoryFromId(trimId: string) {
  const key = trimId.toLowerCase()
  const normalized = normalizeTrimCategoryKey(trimId)
  if (
    (normalized.includes('window') || normalized.includes('win')) &&
    normalized.includes('casing')
  ) {
    return 'window_casing'
  }
  if (normalized.includes('door') && normalized.includes('casing')) return 'door_casing'
  if (key.includes('baseboard') || key.includes('base_board') || key.includes('base board')) {
    return 'baseboard'
  }
  if (normalized.includes('basebrd')) return 'baseboard'
  if (key.includes('crown')) return 'crown'
  if (normalized.includes('door') || normalized.startsWith('dr')) return 'door'
  return 'other'
}

function isDoorTrimRow(row: Unsafe, knownDoorTypeIds: Set<string>) {
  const byIdCategory = inferTrimCategoryFromId(asText(row.trim_menu_id || row.trim_item_id)) === 'door'
  if (byIdCategory) return true
  const trimId = asText(row.trim_menu_id || row.trim_item_id)
  if (trimId && knownDoorTypeIds.has(trimId)) return true
  const sides = asNumberish(row.door_sides)
  const sidesNum = Number(sides)
  return Number.isFinite(sidesNum) && sidesNum > 0
}

function mapDoorRow(row: Unsafe, jobId: string) {
  const trimItemId = asText(row.trim_menu_id || row.trim_item_id)
  const sides = asNumberish(row.door_sides)
  const primerMode = asText(row.primer_mode)
  const spotPrimePct = asNumberish(row.spot_prime_pct)
  const coats = asNumberish(row.coats)
  const prepLevel = asText(row.prep_level_override)
  return {
    JobID: jobId,
    RoomID: asText(row.room_id),
    DoorType: trimItemId,
    DoorTypeID: trimItemId,
    ItemID: trimItemId,
    Qty: asNumberish(row.qty),
    Quantity: asNumberish(row.qty),
    PrimerMode: primerMode,
    'PrimerMode (blank/Spot/Full)': primerMode,
    SpotPrimePct: spotPrimePct,
    'SpotPrimePct (0-100)': spotPrimePct,
    Coats: coats,
    PrepLevelOverride: prepLevel,
    Sides: sides,
    'Sides (0.5/1)': sides,
    Notes: asText(row.notes),
    'Active?': toYN(row.active, 'Y'),
    Active: toYN(row.active, 'Y'),
  }
}

function mapOpeningRow(row: Unsafe, jobId: string) {
  const trimItemId = asText(row.trim_menu_id || row.trim_item_id)
  const primerMode = asText(row.primer_mode)
  const spotPrimePct = asNumberish(row.spot_prime_pct)
  return {
    JobID: jobId,
    RoomID: asText(row.room_id),
    OpeningType: trimItemId,
    OpeningTypeID: trimItemId,
    ItemID: trimItemId,
    Qty: asNumberish(row.qty),
    Quantity: asNumberish(row.qty),
    PrimerMode: primerMode,
    SpotPrimePct: spotPrimePct,
    Notes: asText(row.notes),
    'Active?': toYN(row.active, 'Y'),
    Active: toYN(row.active, 'Y'),
  }
}

async function writeInputTabs(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
  jobId: string
  jobSettings: Unsafe | null
  rooms: Unsafe[]
  segments: Unsafe[]
  ceilingSegments: Unsafe[]
  rollers: Unsafe[]
  prejob: Unsafe[]
  trimLines: Unsafe[]
}) {
  // Some workbook templates read wall complexity from room rows rather than segment rows.
  // Derive a room-level complexity from the first active segment for compatibility.
  const roomComplexityById = new Map<string, string>()
  for (const seg of params.segments) {
    if (toYN(seg.active, 'Y') !== 'Y') continue
    const roomId = asText(seg.room_id)
    if (!roomId || roomComplexityById.has(roomId)) continue
    const complexity = asText(
      seg.wall_complexity_type_id || seg.wallcomplexitytypeid || seg.complexitytypeid || 'STANDARD'
    ).toUpperCase()
    roomComplexityById.set(roomId, complexity || 'STANDARD')
  }
  const roomsWithDerivedComplexity = params.rooms.map((room: Unsafe) => {
    const roomId = asText(room.room_id)
    const derived = roomComplexityById.get(roomId)
    return {
      ...room,
      wall_complexity_type_id:
        asText(room.wall_complexity_type_id).toUpperCase() || derived || 'STANDARD',
    }
  })

  const hasPrimerUsage = hasPrimerUsageInRooms(params.rooms, params.trimLines)
  const jobSettingsForSheet =
    params.jobSettings && !hasPrimerUsage
      ? {
          ...params.jobSettings,
          primer_id: null,
          walls_primer_id: null,
          ceiling_primer_id: null,
          trim_primer_id: null,
          primer_gal_override: null,
        }
      : params.jobSettings

  const configs: SheetConfig[] = [
    {
      sheetName: 'INPUT_JobSettings',
      requiredHeaders: [
        'JobID',
        'WallsPaintProductID',
        'CeilingPaintProductID',
        'TrimPaintProductID',
        'LaborRateOverride_perHr',
      ],
      writableHeaders: [
        'JobID',
        'WallsPaintProductID',
        'CeilingPaintProductID',
        'TrimPaintProductID',
        'PrimerProductID',
        'Wall_PrimerProductID',
        'Ceiling_PrimerProductID',
        'Trim_PrimerProductID',
        'LaborRateOverride_perHr',
        'MarkupOverride_multiplier',
        'RoundingIncrement_hours',
        'WorkdayHours',
        'TrimPaintQty',
        'TrimPaintUOM',
        'TrimPrimerQty',
        'TrimPrimerUOM',
        'Notes',
        'WallsPaint_gal_override',
        'CeilingPaint_gal_override',
        'Primer_gal_override',
        'ExtraSupplies_Walls$',
        'ExtraSupplies_Ceilings$',
        'ExtraSupplies_Trim$',
      ],
      softDelete: false,
      minStartRow: 6,
    },
    {
      sheetName: 'INPUT_Rooms',
      requiredHeaders: ['JobID', 'RoomID', 'Room Name'],
      writableHeaders: [
        'JobID',
        'RoomID',
        'Room Name',
        'Mode (RECT/SEG)',
        'Length_in (RECT)',
        'Width_in (RECT)',
        'WallHeight_in',
        'CeilingHeight_in',
        'CeilingSqft_override (SEG optional)',
        'BaseExclude_in (RECT)',
        'Walls Include',
        'WallComplexityTypeID',
        'ComplexityTypeID',
        'Walls Primer',
        'Walls Topcoats',
        'Walls Prep Override',
        'Ceiling Include',
        'Ceiling Primer',
        'Ceiling Topcoats',
        'Ceiling Prep Level',
        'Ceiling Prep Override',
        'Ceiling Height Surcharge $',
        'Trim Include',
        'Trim Primer',
        'Trim Topcoats',
        'Trim Prep Override',
        'Paint Base?',
        'Paint Crown?',
        'Ceiling Crown Check',
        'Paint Window Casing?',
        'Paint Door Casing?',
        'Paint Doors?',
        'WallColorID (A/B/C...)',
        'CeilingTypeID',
      ],
      softDelete: false,
      minStartRow: 4,
    },
    {
      sheetName: 'INPUT_Walls',
      requiredHeaders: ['JobID', 'RoomID'],
      writableHeaders: [
        'JobID',
        'RoomID',
        'PrepLevel',
        'Prep Level',
        'WallsPrepLevel',
        'WallSqft_override',
        'WallSqftOverride',
        'WallSqft',
        'OpeningsSqft',
        'OpeningsSqft_override',
        'OpeningsSqftOverride',
        'Notes',
        'Active?',
        'Active',
      ],
      softDelete: true,
      minStartRow: 4,
    },
    {
      sheetName: 'INPUT_Segments',
      requiredHeaders: ['JobID', 'RoomID', 'Seg#', 'Active?'],
      writableHeaders: [
        'JobID',
        'RoomID',
        'Seg#',
        'SegLen_in',
        'SegWallHeight_in',
        'SegWallHeightIn',
        'SegWallHeight_in (override)',
        'segwallheight_in (override)',
        'segwallgeight_in (override)',
        'WallsCalcMethod',
        'WallCalcMethod',
        'WallComplexityTypeID',
        'WallComplexityType',
        'WallComplexityID',
        'Wall_Complexity_Type_ID',
        'Wall Complexity Type ID',
        'Wall Complexity Type',
        'ComplexityTypeID',
        'ComplexityTypeID (optional)',
        'ComplexityType',
        'Complexity Type ID',
        'Complexity Type ID (optional)',
        'Complexity Type',
        'BaseExclude_in',
        'Notes',
        'WallLabel (optional)',
        'WallColorOverrideID (optional)',
        'Active?',
      ],
      softDelete: true,
      minStartRow: 4,
    },
    {
      sheetName: 'INPUT_WallPanels',
      requiredHeaders: ['JobID', 'RoomID', 'Panel#'],
      writableHeaders: [
        'JobID',
        'RoomID',
        'Panel#',
        'Length_in',
        'HeightBottom_in',
        'HeightTop_in',
        'ComplexityTypeID',
        'ComplexityTypeID (optional)',
        'WallLabel',
        'WallColorOverrideID',
        'BaseExclude_in',
        'Notes',
        'Active',
      ],
      softDelete: true,
      optional: true,
      minStartRow: 4,
    },
    {
      sheetName: 'INPUT_Wall_WallPanels',
      requiredHeaders: ['JobID', 'RoomID', 'Seg#'],
      writableHeaders: [
        'JobID',
        'RoomID',
        'Panel#',
        'Seg#',
        'Length_in',
        'PanelLength_in',
        'HeightBottom_in',
        'BottomHeight_in',
        'HeightTop_in',
        'TopHeight_in',
        'ComplexityTypeID',
        'ComplexityTypeID (optional)',
        'WallLabel',
        'WallColorOverrideID',
        'BaseExclude_in',
        'Notes',
        'Active',
        'Active?',
      ],
      softDelete: true,
      optional: true,
      minStartRow: 4,
    },
    {
      sheetName: 'WALL_WALLPANELS',
      requiredHeaders: ['JobID', 'RoomID', 'Seg#'],
      writableHeaders: [
        'JobID',
        'RoomID',
        'Panel#',
        'Seg#',
        'Length_in',
        'PanelLength_in',
        'HeightBottom_in',
        'BottomHeight_in',
        'HeightTop_in',
        'TopHeight_in',
        'ComplexityTypeID',
        'ComplexityTypeID (optional)',
        'WallLabel',
        'WallColorOverrideID',
        'BaseExclude_in',
        'Notes',
        'Active',
        'Active?',
      ],
      softDelete: true,
      optional: true,
      minStartRow: 4,
    },
    {
      sheetName: 'INPUT_CeilingSegments',
      requiredHeaders: ['JobID', 'RoomID', 'Seg#'],
      writableHeaders: [
        'JobID',
        'RoomID',
        'Seg#',
        'Length_in',
        'Width_in',
        'Height_in',
        'CeilingHeight_in',
        'SegCeilingHeight_in',
        'Height_in (override)',
        'Ceiling Height (override)',
        'Notes',
        'Active',
        'Active?',
      ],
      softDelete: true,
      optional: true,
      minStartRow: 4,
    },
    {
      sheetName: 'INPUT_Rollers',
      requiredHeaders: ['JobID', 'Scope', 'ColorID', 'RollerSize', 'Quantity', 'Active?'],
      writableHeaders: [
        'JobID',
        'Scope',
        'ColorID',
        'RollerSize',
        'Quantity',
        'Notes',
        'Active?',
      ],
      softDelete: true,
      minStartRow: 4,
    },
    {
      sheetName: 'INPUT_PreJobTrips',
      requiredHeaders: ['JobID', 'TripNum', 'RollupScope', 'Qty', 'Active?'],
      writableHeaders: [
        'JobID',
        'TripNum',
        'RollupScope',
        'TaskTemplateID',
        'TaskName',
        'Task Name',
        'ManualTaskName',
        'Man_TripName',
        'Man_Qty',
        'HoursEach',
        'Man_Hours_each',
        'Task',
        'Qty',
        'ExtraSupplies$',
        'ExtraSupplies',
        'Notes',
        'Active?',
      ],
      softDelete: true,
      minStartRow: 4,
      validateRows: (rows) =>
        rows.flatMap((row, idx) => {
          const issues: MissingInput[] = []
          if (!asText(row.TripNum)) {
            issues.push({
              tab: 'INPUT_PreJobTrips',
              header: 'TripNum',
              message: `Prejob row ${idx + 1}: TripNum is required`,
            })
          }
          if (!asText(row.RollupScope)) {
            issues.push({
              tab: 'INPUT_PreJobTrips',
              header: 'RollupScope',
              message: `Prejob row ${idx + 1}: RollupScope is required`,
            })
          }
          if (!asText(row.TaskTemplateID) && !asText(row.ManualTaskName) && !asText(row.Man_TripName) && !asText(row.Task)) {
            issues.push({
              tab: 'INPUT_PreJobTrips',
              header: 'ManualTaskName',
              message: `Prejob row ${idx + 1}: set TaskTemplateID or ManualTaskName`,
            })
          }
          return issues
        }),
    },
    {
      sheetName: 'INPUT_TrimLines',
      requiredHeaders: [],
      writableHeaders: [
        'JobID',
        'RoomID',
        'TrimMenuID',
        'TrimItemID',
        'ItemID',
        'TrimItemID (from Constants)',
        'Qty',
        'Quantity',
        'PrimerMode',
        'SpotPrimePct',
        'Coats',
        'PrepLevelOverride',
        'AutoCalc',
        'Unit',
        'Notes',
        'Active?',
        'Active',
      ],
      softDelete: false,
      optional: true,
      minStartRow: 6,
      fixedStartRow: 6,
    },
    {
      sheetName: 'INPUT_Doors',
      requiredHeaders: [],
      writableHeaders: [
        'JobID',
        'RoomID',
        'DoorType',
        'DoorTypeID',
        'ItemID',
        'Qty',
        'Quantity',
        'PrimerMode',
        'PrimerMode (blank/Spot/Full)',
        'SpotPrimePct',
        'SpotPrimePct (0-100)',
        'Coats',
        'PrepLevelOverride',
        'Sides',
        'Sides (0.5/1)',
        'Notes',
        'Active?',
        'Active',
      ],
      softDelete: true,
      optional: true,
      minStartRow: 4,
    },
    {
      sheetName: 'INPUT_Openings',
      requiredHeaders: [],
      writableHeaders: [
        'JobID',
        'RoomID',
        'OpeningType',
        'OpeningTypeID',
        'ItemID',
        'Qty',
        'Quantity',
        'PrimerMode',
        'SpotPrimePct',
        'Notes',
        'Active?',
        'Active',
      ],
      softDelete: true,
      optional: true,
      minStartRow: 4,
    },
  ]

  const knownDoorTypeIds = new Set(
    params.rooms
      .map((row: Unsafe) => asText(row.door_type_id))
      .filter(Boolean)
  )

  const trimLineRows = params.trimLines.map((row: Unsafe) => mapTrimLineRow(row, params.jobId))
  const trimDoorRows = params.trimLines
    .filter((row: Unsafe) => isDoorTrimRow(row, knownDoorTypeIds))
    .map((row: Unsafe) => mapDoorRow(row, params.jobId))
  const trimOpeningRows = params.trimLines
    .filter((row: Unsafe) => {
      const category = inferTrimCategoryFromId(asText(row.trim_menu_id || row.trim_item_id))
      return category === 'window_casing' || category === 'door_casing'
    })
    .map((row: Unsafe) => mapOpeningRow(row, params.jobId))

  const wallsRows = params.rooms
    .filter((row: Unsafe) => toYN(row.walls_include, 'N') === 'Y')
    .map((row: Unsafe) =>
      mapWallsRow(row, params.jobId, asText(jobSettingsForSheet?.default_walls_prep_level))
    )

  const panelRows = params.segments
    .filter(
      (row: Unsafe) =>
        asText(row.walls_calc_method || row.wallscalcmethod || row.walls_calcmethod).toUpperCase() ===
        'PANEL'
    )
    .map((row: Unsafe) => mapWallPanelRow(row, params.jobId))

  const rowsBySheet: Record<string, Record<string, unknown>[]> = {
    INPUT_JobSettings: mapJobSettingsRow(jobSettingsForSheet, params.jobId),
    INPUT_Rooms: roomsWithDerivedComplexity.map((row: Unsafe) => mapRoomRow(row, params.jobId)),
    INPUT_Walls: wallsRows,
    INPUT_Segments: params.segments
      .filter(
        (row: Unsafe) =>
          asText(row.walls_calc_method || row.wallscalcmethod || row.walls_calcmethod).toUpperCase() !==
          'PANEL'
      )
      .map((row: Unsafe) => mapSegmentRow(row, params.jobId)),
    INPUT_WallPanels: panelRows,
    INPUT_Wall_WallPanels: panelRows,
    WALL_WALLPANELS: panelRows,
    INPUT_CeilingSegments: params.ceilingSegments.map((row: Unsafe) =>
      mapCeilingSegmentRow(row, params.jobId)
    ),
    INPUT_Rollers: params.rollers.map((row: Unsafe) => mapRollerRow(row, params.jobId)),
    INPUT_PreJobTrips: params.prejob.map((row: Unsafe) => mapPreJobRow(row, params.jobId)),
    INPUT_TrimLines: trimLineRows,
    INPUT_Doors: trimDoorRows,
    INPUT_Openings: trimOpeningRows,
  }

  const prepared: {
    config: SheetConfig
    map: HeaderMap
    rows: Record<string, unknown>[]
  }[] = []
  const missingInputs: MissingInput[] = []

  for (const config of configs) {
    let map: HeaderMap | null = null
    try {
      const discovered = await findHeaders({
        origin: params.origin,
        orgId: params.orgId,
        userId: params.userId,
        spreadsheetId: params.spreadsheetId,
        sheetName: config.sheetName,
        requiredHeaders: config.requiredHeaders,
        writableHeaders: config.writableHeaders,
      })
      const mapWithOffset: HeaderMap = config.startRowOffset
        ? { ...discovered, startRow: discovered.startRow + config.startRowOffset }
        : discovered
      map =
        typeof config.minStartRow === 'number'
          ? { ...mapWithOffset, startRow: Math.max(mapWithOffset.startRow, config.minStartRow) }
          : mapWithOffset
      if (typeof config.fixedStartRow === 'number') {
        map = { ...map, startRow: config.fixedStartRow }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (config.optional && message.toLowerCase().includes('missing sheet/tab/header')) {
        continue
      }
      missingInputs.push({
        tab: config.sheetName,
        header: 'headers',
        message: message || `Missing required sheet/header for ${config.sheetName}`,
      })
      continue
    }
    if (!map) continue
    const rows = rowsBySheet[config.sheetName] ?? []
    if (config.requiredValueHeaders?.length) {
      for (const row of rows) {
        const roomId = asText(row.RoomID || row.room_id) || undefined
        for (const header of config.requiredValueHeaders) {
          if (asText(row[header])) continue
          missingInputs.push({
            tab: config.sheetName,
            header,
            room_id: roomId,
            message: roomId
              ? `${config.sheetName}: ${header} is required for room ${roomId}`
              : `${config.sheetName}: ${header} is required`,
          })
        }
      }
    }
    if (config.validateRows) {
      missingInputs.push(...config.validateRows(rows))
    }
    prepared.push({ config, map, rows })
  }

  if (missingInputs.length) {
    throw new MissingInputsError(missingInputs)
  }

  for (const item of prepared) {
    const { config, map: effectiveMap, rows } = item
    if (config.softDelete) {
      const hasJobId = getHeaderIndex(effectiveMap, 'JobID') != null
      const hasActive = getHeaderIndex(effectiveMap, 'Active?') != null
      if (hasJobId && hasActive) {
        await softDeleteAndAppendRows({
          origin: params.origin,
          orgId: params.orgId,
          userId: params.userId,
          spreadsheetId: params.spreadsheetId,
          map: effectiveMap,
          sheetName: config.sheetName,
          writableHeaders: config.writableHeaders,
          jobId: params.jobId,
          rows,
        })
      } else {
        await replaceRowsByColumns({
          origin: params.origin,
          orgId: params.orgId,
          userId: params.userId,
          spreadsheetId: params.spreadsheetId,
          map: effectiveMap,
          sheetName: config.sheetName,
          writableHeaders: config.writableHeaders,
          rows,
        })
      }
    } else {
      await replaceRowsByColumns({
        origin: params.origin,
        orgId: params.orgId,
        userId: params.userId,
        spreadsheetId: params.spreadsheetId,
        map: effectiveMap,
        sheetName: config.sheetName,
        writableHeaders: config.writableHeaders,
        rows,
      })
    }
  }
}

async function readOutputs(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
}) {
  let outputRows: string[][] = []
  for (let i = 0; i < 6; i += 1) {
    const read = await readRangeValues({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.userId,
      spreadsheetId: params.spreadsheetId,
      range: 'OUTPUT_App!A3:B30',
    })
    if ('error' in read) {
      const message = String(read.error ?? '')
      if (message.toLowerCase().includes('missing sheet/tab/header')) {
        outputRows = []
        break
      }
      throw new Error(`Workbook read/write error: ${read.error}`)
    }
    outputRows = read.values
    if (outputRows.some((row: string[]) => asText(row[0]) === 'FinalTotal')) break
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  const outputApp: Record<string, string | number | null> = {}
  for (const row of outputRows) {
    const key = asText(row[0])
    if (!key) continue
    outputApp[key] = parseMaybeNumber(asText(row[1]))
  }
  const colorRead = await readRangeValues({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: params.spreadsheetId,
    range: 'ENGINE_ColorList!A5:I120',
  })
  if ('error' in colorRead) throw new Error(`Workbook read/write error: ${colorRead.error}`)

  const header = colorRead.values[0] ?? []
  const idx = new Map<string, number>()
  header.forEach((h: string, i: number) => idx.set(asText(h), i))

  const wallColors = colorRead.values.slice(1).flatMap((row: string[]) => {
    const wallColorId = asText(valueAt(row, idx.get('WallColorID') ?? 0))
    if (!wallColorId) return []
    return [
      {
        wall_color_id: wallColorId,
        wall_sqft: parseMaybeNumber(asText(valueAt(row, idx.get('WallSqft (calc)') ?? 1))),
        roller_size_in_selected: parseMaybeNumber(
          asText(valueAt(row, idx.get('RollerSize_in (selected)') ?? 2))
        ),
        covers_qty_selected: parseMaybeNumber(
          asText(valueAt(row, idx.get('CoversQty (selected)') ?? 3))
        ),
        roller_cost_selected: parseMaybeNumber(
          asText(valueAt(row, idx.get('RollerCost$ (selected)') ?? 4))
        ),
      },
    ]
  })

  const ceilingSource = colorRead.values[1] ?? []
  const ceilingRoller = {
    roller_size_in: parseMaybeNumber(asText(valueAt(ceilingSource, 6))),
    covers_qty: parseMaybeNumber(asText(valueAt(ceilingSource, 7))),
    roller_cost: parseMaybeNumber(asText(valueAt(ceilingSource, 8))),
  }

  return {
    outputApp,
    engineColorList: {
      wall_colors: wallColors,
      ceiling_roller: ceilingRoller,
    },
  } as const
}

export async function createEstimateWorkbook(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  jobId: string
}) {
  const sheet = await ensureSpreadsheetForEstimate({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
    jobId: params.jobId,
    sheetFilePath: null,
  })
  const schemaVersion = await readSchemaVersion({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: sheet.spreadsheetId,
  })

  const exported = await exportDriveFile({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    fileId: sheet.spreadsheetId,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  if ('error' in exported) throw new Error(`Workbook read/write error: ${exported.error}`)

  const uploaded = await supabaseAdmin.storage
    .from(WORKBOOK_BUCKET)
    .upload(sheet.sheetFilePath, exported.buffer, {
      upsert: true,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  if (uploaded.error) throw new Error(`Workbook read/write error: ${uploaded.error.message}`)

  return {
    schemaVersion,
    sheetFilePath: sheet.sheetFilePath,
  } as const
}

export async function recalculateEstimateSpreadsheet(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  forceNewSheet?: boolean
}) {
  const estimateRes = await supabaseAdmin
    .from('estimates')
    .select('id, org_id, job_id, sheet_schema_version, sheet_file_path')
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
    .maybeSingle()
  if (estimateRes.error) throw new Error(`Workbook read/write error: ${estimateRes.error.message}`)
  if (!estimateRes.data) throw new Error('Workbook read/write error: estimate not found')

  const estimate = estimateRes.data
  const sheet = await ensureSpreadsheetForEstimate({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
    jobId: estimate.job_id,
    sheetFilePath: estimate.sheet_file_path,
    forceNewSheet: params.forceNewSheet,
  })

  const schemaVersion = await readSchemaVersion({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: sheet.spreadsheetId,
  })
  if (
    estimate.sheet_schema_version &&
    asText(estimate.sheet_schema_version) !== asText(schemaVersion)
  ) {
    throw new Error(
      `Schema version mismatch: expected '${estimate.sheet_schema_version}', found '${schemaVersion}' in Constants!SchemaVersion`
    )
  }

  const [jobSettings, rooms, segments, ceilingSegments, rollers, prejob, trimLines] = await Promise.all([
    supabaseAdmin
      .from('estimate_jobsettings')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .maybeSingle(),
    supabaseAdmin
      .from('estimate_rooms')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_ceiling_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_rollers')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_prejob')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_trim_items')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .order('sort_order', { ascending: true }),
  ])

  if (jobSettings.error) throw new Error(`Workbook read/write error: ${jobSettings.error.message}`)
  if (rooms.error) throw new Error(`Workbook read/write error: ${rooms.error.message}`)
  if (segments.error) throw new Error(`Workbook read/write error: ${segments.error.message}`)
  if (ceilingSegments.error) throw new Error(`Workbook read/write error: ${ceilingSegments.error.message}`)
  if (rollers.error) throw new Error(`Workbook read/write error: ${rollers.error.message}`)
  if (prejob.error) throw new Error(`Workbook read/write error: ${prejob.error.message}`)
  if (trimLines.error) throw new Error(`Workbook read/write error: ${trimLines.error.message}`)

  await writeInputTabs({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: sheet.spreadsheetId,
    jobId: estimate.job_id,
    jobSettings: jobSettings.data,
    rooms: rooms.data ?? [],
    segments: (segments.data ?? []).filter((r) => toYN(r.active, 'Y') === 'Y'),
    ceilingSegments: (ceilingSegments.data ?? []).filter((r) => toYN(r.active, 'Y') === 'Y'),
    rollers: (rollers.data ?? []).filter((r) => toYN(r.active, 'Y') === 'Y'),
    prejob: (prejob.data ?? []).filter((r) => toYN(r.active, 'Y') === 'Y'),
    trimLines: (trimLines.data ?? []).filter((r) => toYN(r.active, 'Y') === 'Y'),
  })

  await writeActiveJobIdToJobControl({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: sheet.spreadsheetId,
    jobId: estimate.job_id,
  })

  const outputs = await readOutputs({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: sheet.spreadsheetId,
  })

  const exported = await exportDriveFile({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    fileId: sheet.spreadsheetId,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  if ('error' in exported) throw new Error(`Workbook read/write error: ${exported.error}`)

  const uploaded = await supabaseAdmin.storage
    .from(WORKBOOK_BUCKET)
    .upload(sheet.sheetFilePath, exported.buffer, {
      upsert: true,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  if (uploaded.error) throw new Error(`Workbook read/write error: ${uploaded.error.message}`)

  const latestOutput = {
    updated_at: new Date().toISOString(),
    schema_version: schemaVersion,
    output_app: outputs.outputApp,
    engine_color_list: outputs.engineColorList,
  }

  const update = await supabaseAdmin
    .from('estimates')
    .update({
      sheet_schema_version: schemaVersion,
      sheet_file_path: sheet.sheetFilePath,
      latest_output_json: latestOutput,
      status: 'recalculated',
    })
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
  if (update.error) throw new Error(`Workbook read/write error: ${update.error.message}`)

  return latestOutput
}

