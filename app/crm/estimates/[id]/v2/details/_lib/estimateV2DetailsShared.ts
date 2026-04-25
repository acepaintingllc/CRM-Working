import { asMaybeNumber } from '@/lib/estimator/parsing'

export function isActive(include: string | null | undefined) {
  return include !== 'N'
}

export function n(value: unknown) {
  return asMaybeNumber(value) ?? 0
}

export function sumNumbers<T>(rows: T[], getValue: (row: T) => unknown) {
  return rows.reduce((sum, row) => sum + n(getValue(row)), 0)
}

export function round1(value: number) {
  return Math.round(value * 10) / 10
}

export function formatDetailsNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

export function cleanInputNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function resolveOptionalGallonOverride(params: {
  overrideGallons: string
  roundedGallons: number
}) {
  const override = cleanInputNumber(params.overrideGallons)
  const hasOverride = params.overrideGallons.trim() !== '' && override != null

  return {
    finalGallons: hasOverride ? override : params.roundedGallons,
    hasOverride,
  }
}
