import {
  buildTrimPaintInput as buildSharedTrimPaintInput,
  normalizeTrimPaintGallons,
  type TrimPaintInput,
} from '../estimator/v2CalculationShared.ts'

export type TrimPaintProduct = {
  label?: string | null
  price_per_gal?: number | null
}

export type TrimPaintProductMap = Map<string, TrimPaintProduct>

export type BuildTrimPaintInputParams = {
  jobsettings: Record<string, unknown> | null
  defaults?: Record<string, unknown> | null
  catalogs: TrimPaintProductMap | null
}

export type { TrimPaintInput }

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export { normalizeTrimPaintGallons }

export function buildTrimPaintInput(params: BuildTrimPaintInputParams): TrimPaintInput | null {
  const row = params.jobsettings
  if (!row) return null

  const productId = asText(row.trim_paint_id) || asText(params.defaults?.trim_paint_id) || null
  const product = productId ? params.catalogs?.get(productId) : undefined
  return buildSharedTrimPaintInput({ jobsettings: row, productId, product })
}
