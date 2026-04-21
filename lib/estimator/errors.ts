export type EstimateV2Error = {
  message: string
  code?: string
  retryable: boolean
}

export function createEstimateV2Error(
  message: string,
  options?: {
    code?: string
    retryable?: boolean
  }
): EstimateV2Error {
  return {
    message,
    code: options?.code,
    retryable: options?.retryable ?? false,
  }
}
