import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/apiRoute'
import { serviceErrorStatus } from '@/lib/server/routeError'
import type { ServiceError, ServiceResult } from '@/lib/server/serviceResult'

export function serviceErrorResponse(error: ServiceError) {
  return jsonError(error.message, serviceErrorStatus(error.kind))
}

export function serviceResultResponse<T>(
  result: ServiceResult<T>,
  toBody: (data: T) => unknown
) {
  if (!result.ok) return serviceErrorResponse(result)
  return NextResponse.json(toBody(result.data))
}
