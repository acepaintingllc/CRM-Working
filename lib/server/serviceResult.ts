export type ServiceErrorKind =
  | 'invalid_input'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'server_error'

export type ServiceError = {
  ok: false
  kind: ServiceErrorKind
  message: string
}

export type ServiceSuccess<T> = {
  ok: true
  data: T
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceError

export function okResult<T>(data: T): ServiceSuccess<T> {
  return { ok: true, data }
}

export function errorResult(kind: ServiceErrorKind, message: string): ServiceError {
  return { ok: false, kind, message }
}
