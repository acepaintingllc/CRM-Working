type PostgrestLikeError = {
  code?: string | null
  message?: string | null
}

export function hasUniqueConstraintConflict(error: PostgrestLikeError | null | undefined) {
  if (!error) return false
  if (error.code === '23505') return true
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('duplicate key value violates unique constraint')
}

export function exposeServerErrorMessage(
  errorMessage: string | null | undefined,
  isProduction: boolean,
  fallbackMessage: string
) {
  if (isProduction) return fallbackMessage
  return errorMessage?.trim() || fallbackMessage
}
