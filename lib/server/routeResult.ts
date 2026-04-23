import { jsonError } from './apiRoute.ts'
import { serviceErrorStatus } from './routeError.ts'
import type { ServiceError, ServiceResult } from './serviceResult.ts'

export function dataResponse<T>(data: T, init?: ResponseInit) {
  return Response.json({ data }, init)
}

export function mutationResponse<T>(data: T, notice?: string | null, init?: ResponseInit) {
  return Response.json(notice ? { data, notice } : { data }, init)
}

export function serviceErrorResponse(error: ServiceError) {
  return jsonError(error.message, serviceErrorStatus(error.kind))
}

export function serviceResultResponse<T>(
  result: ServiceResult<T>,
  toBody: (data: T) => unknown
) {
  if (!result.ok) return serviceErrorResponse(result)
  return Response.json(toBody(result.data))
}

export function serviceResultDataResponse<T>(result: ServiceResult<T>, init?: ResponseInit) {
  if (!result.ok) return serviceErrorResponse(result)
  return dataResponse(result.data, init)
}

export function serviceResultMutationResponse<T>(
  result: ServiceResult<T>,
  notice?: string | null,
  init?: ResponseInit
) {
  if (!result.ok) return serviceErrorResponse(result)
  return mutationResponse(result.data, notice, init)
}
