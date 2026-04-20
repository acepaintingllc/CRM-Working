export type TrimPaintProduct = {
  label?: string | null
  price_per_gal?: number | null
}

export type TrimPaintProductMap = Map<string, TrimPaintProduct>

export type BuildTrimPaintInputParams = {
  jobsettings: Record<string, unknown> | null
  catalogs: TrimPaintProductMap | null
}

export type TrimPaintInput = {
  paint_product_id: string | null
  paint_product_label: string | null
  gallons: number
  quarts: number
  normalized_gallons: number
  paint_cost: number
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeTrimPaintGallons(gallons: unknown, quarts: unknown) {
  const gallonsValue = asNullableNumber(gallons) ?? 0
  const quartsValue = asNullableNumber(quarts) ?? 0
  return Math.max(gallonsValue + quartsValue / 4, 0)
}

export function buildTrimPaintInput(params: BuildTrimPaintInputParams): TrimPaintInput | null {
  const row = params.jobsettings
  if (!row) return null

  const productId = asText(row.trim_paint_id) || null
  const product = productId ? params.catalogs?.get(productId) : undefined
  const gallons = asNullableNumber(row.trim_paint_gallons)
  const quarts = asNullableNumber(row.trim_paint_quarts)
  const legacyQty = asNullableNumber(row.trim_paint_qty)
  const legacyUnit = asText(row.trim_paint_uom).toLowerCase()

  const normalizedGallons =
    gallons != null || quarts != null
      ? normalizeTrimPaintGallons(gallons, quarts)
      : legacyQty != null
        ? legacyUnit === 'quart'
          ? legacyQty / 4
          : legacyQty
        : 0

  const unitPrice = product?.price_per_gal ?? null
  const paintCost = normalizedGallons * (unitPrice ?? 0)
  const wholeGallons = gallons != null ? gallons : Math.floor(normalizedGallons)
  const remainingQuarts = quarts != null ? quarts : Math.max(Math.round((normalizedGallons - wholeGallons) * 4), 0)

  return {
    paint_product_id: productId,
    paint_product_label: product?.label ?? null,
    gallons: wholeGallons,
    quarts: remainingQuarts,
    normalized_gallons: normalizedGallons,
    paint_cost: paintCost,
  }
}
