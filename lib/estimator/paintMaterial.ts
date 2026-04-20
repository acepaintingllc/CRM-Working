import { round4 } from './wallsHelpers.ts'

export type PaintMaterialScopeRow = {
  scope_key: string
  scope_id: string | null
  room_id: string
  paint_product_id: string | null
  paint_product_label: string | null
  paint_price_per_gal: number | null
  raw_paint_gallons: number | null
  paint_material_group_key?: string | null
  allocated_paint_gallons?: number | null
  allocated_paint_material_cost?: number | null
  raw_paint_material_cost?: number | null
}

export type PaintMaterialGroup = {
  group_key: string
  paint_product_id: string | null
  paint_product_label: string | null
  raw_paint_gallons: number
  rounded_paint_gallons: number
  unit_price: number
  total_paint_cost: number
  contributing_scopes: Array<{
    scope_key: string
    scope_id: string | null
    room_id: string
    raw_paint_gallons: number
    allocated_paint_gallons: number
    allocated_paint_cost: number
    weight: number
  }>
}

function roundWholeGallons(rawGallons: number) {
  if (rawGallons <= 0) return 0
  return Math.ceil(rawGallons - Number.EPSILON)
}

export function allocatePaintMaterialRollups<T extends PaintMaterialScopeRow>(scopes: T[]) {
  const grouped = new Map<string, T[]>()
  for (const scope of scopes) {
    if (scope.paint_product_id) {
      const key = scope.paint_product_id
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)?.push(scope)
      continue
    }
    const fallbackKey = `scope:${scope.scope_key}`
    grouped.set(fallbackKey, [scope])
  }

  const groups: PaintMaterialGroup[] = []
  for (const [groupKey, groupScopes] of grouped.entries()) {
    const rawTotal = round4(groupScopes.reduce((sum, scope) => sum + (scope.raw_paint_gallons ?? 0), 0))
    const unitPrice = groupScopes[0]?.paint_price_per_gal ?? 0
    const roundedGallons = roundWholeGallons(rawTotal)
    const totalPaintCost = round4(roundedGallons * unitPrice)
    const paintProductId = groupScopes[0]?.paint_product_id ?? null
    const paintProductLabel = groupScopes[0]?.paint_product_label ?? null

    let allocatedGallonsRemaining = round4(roundedGallons)
    let allocatedCostRemaining = round4(totalPaintCost)
    const contributing_scopes = groupScopes.map((scope, index) => {
      const rawGallons = scope.raw_paint_gallons ?? 0
      const isLast = index === groupScopes.length - 1
      const weight = rawTotal > 0 ? rawGallons / rawTotal : 1 / groupScopes.length
      const allocatedGallons = isLast ? allocatedGallonsRemaining : round4(roundedGallons * weight)
      const allocatedCost = isLast ? allocatedCostRemaining : round4(totalPaintCost * weight)
      allocatedGallonsRemaining = round4(allocatedGallonsRemaining - allocatedGallons)
      allocatedCostRemaining = round4(allocatedCostRemaining - allocatedCost)

      scope.paint_material_group_key = groupKey
      scope.allocated_paint_gallons = allocatedGallons
      scope.allocated_paint_material_cost = allocatedCost
      scope.raw_paint_material_cost = round4(rawGallons * unitPrice)
      scope.paint_product_label = paintProductLabel

      return {
        scope_key: scope.scope_key,
        scope_id: scope.scope_id,
        room_id: scope.room_id,
        raw_paint_gallons: round4(rawGallons),
        allocated_paint_gallons: allocatedGallons,
        allocated_paint_cost: allocatedCost,
        weight: rawTotal > 0 ? round4(rawGallons / rawTotal) : round4(1 / groupScopes.length),
      }
    })

    groups.push({
      group_key: groupKey,
      paint_product_id: paintProductId,
      paint_product_label: paintProductLabel,
      raw_paint_gallons: rawTotal,
      rounded_paint_gallons: roundedGallons,
      unit_price: unitPrice,
      total_paint_cost: totalPaintCost,
      contributing_scopes,
    })
  }

  return groups.sort((a, b) => a.group_key.localeCompare(b.group_key))
}
