export function safeReturnTo(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  return value
}
