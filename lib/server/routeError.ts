import type { ServiceError } from '@/lib/server/serviceResult'

export function serviceErrorStatus(kind: ServiceError['kind']) {
  switch (kind) {
    case 'invalid_input':
      return 400
    case 'forbidden':
      return 403
    case 'not_found':
      return 404
    case 'conflict':
      return 409
    case 'server_error':
    default:
      return 500
  }
}
