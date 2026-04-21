export type HeightFactorBand = {
  min_height_ft: number | null
  max_height_ft: number | null
  labor_multiplier: number | null
}

type NormalizedHeightFactorBand = {
  min_height_ft: number | null
  max_height_ft: number | null
  labor_multiplier: number
}

function asPositiveNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

function normalizeBands(
  bands: readonly HeightFactorBand[] | null | undefined
): NormalizedHeightFactorBand[] {
  return (bands ?? [])
    .map((band) => {
      const labor_multiplier = asPositiveNumber(band.labor_multiplier)
      if (labor_multiplier == null) return null
      return {
        min_height_ft: asPositiveNumber(band.min_height_ft),
        max_height_ft: asPositiveNumber(band.max_height_ft),
        labor_multiplier,
      }
    })
    .filter((band): band is NormalizedHeightFactorBand => band != null)
}

function compareBandPriority(a: NormalizedHeightFactorBand, b: NormalizedHeightFactorBand) {
  const aMin = a.min_height_ft ?? Number.NEGATIVE_INFINITY
  const bMin = b.min_height_ft ?? Number.NEGATIVE_INFINITY
  if (aMin !== bMin) return bMin - aMin

  const aMax = a.max_height_ft ?? Number.POSITIVE_INFINITY
  const bMax = b.max_height_ft ?? Number.POSITIVE_INFINITY
  if (aMax !== bMax) return aMax - bMax

  return b.labor_multiplier - a.labor_multiplier
}

export function resolveHeightFactorMultiplier(
  heightFt: number | null | undefined,
  bands: readonly HeightFactorBand[] | null | undefined,
  fallback = 1
) {
  const normalizedHeightFt = asPositiveNumber(heightFt)
  if (normalizedHeightFt == null) return fallback

  const normalizedBands = normalizeBands(bands)
  if (normalizedBands.length === 0) return fallback

  const directMatches = normalizedBands
    .filter((band) => {
      const minOk = band.min_height_ft == null || normalizedHeightFt >= band.min_height_ft
      const maxOk = band.max_height_ft == null || normalizedHeightFt <= band.max_height_ft
      return minOk && maxOk
    })
    .sort(compareBandPriority)
  if (directMatches.length > 0) return directMatches[0].labor_multiplier

  const priorBands = normalizedBands
    .filter((band) => band.min_height_ft != null && normalizedHeightFt >= band.min_height_ft)
    .sort(compareBandPriority)
  if (priorBands.length > 0) return priorBands[0].labor_multiplier

  const nextBands = normalizedBands
    .filter((band) => band.max_height_ft != null && normalizedHeightFt <= band.max_height_ft)
    .sort(compareBandPriority)
  if (nextBands.length > 0) return nextBands[nextBands.length - 1].labor_multiplier

  return fallback
}

export function resolveHeightFactorMultiplierFromInches(
  heightIn: number | null | undefined,
  bands: readonly HeightFactorBand[] | null | undefined,
  fallback = 1
) {
  const normalizedHeightIn = asPositiveNumber(heightIn)
  if (normalizedHeightIn == null) return fallback
  return resolveHeightFactorMultiplier(normalizedHeightIn / 12, bands, fallback)
}
