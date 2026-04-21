export function fmtH(n: number | null | undefined) {
  if (!n || n === 0) return '-'
  return `${n.toFixed(1)}h`
}

export function fmtD(n: number | null | undefined) {
  if (n == null) return '-'
  return `${n.toFixed(1)}d`
}

export function fmtUSD(n: number | null | undefined) {
  if (n == null) return '-'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function fmtGallons(n: number | null | undefined) {
  if (n == null) return '-'
  return `${n.toFixed(2)} gal`
}

export function fmtNumber(n: number | null | undefined, digits = 2) {
  if (n == null) return '-'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtPct(n: number | null | undefined) {
  if (n == null) return '-'
  return `${Math.round(n * 100)}%`
}
