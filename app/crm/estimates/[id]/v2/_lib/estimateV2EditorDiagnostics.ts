'use client'

import type { ParsedApiResponse } from '@/lib/client/api'

type EstimateV2EditorFailureDiagnosticParams = {
  estimateId?: string | null
  endpoint: string
  method: string
  operation: string
  response: Pick<Response, 'ok' | 'status' | 'statusText'>
  parsed: ParsedApiResponse<unknown>
  message: string
  trigger?: 'manual' | 'auto'
}

function getErrorEnvelopeDiagnostic(error: unknown) {
  if (typeof error === 'string') {
    return {
      errorShape: 'string',
      errorCode: null,
      errorKeys: [],
    }
  }
  if (!error || typeof error !== 'object') {
    return {
      errorShape: error == null ? 'none' : typeof error,
      errorCode: null,
      errorKeys: [],
    }
  }

  const errorRecord = error as Record<string, unknown>
  const code = errorRecord.code
  return {
    errorShape: 'object',
    errorCode: typeof code === 'string' && code.trim() ? code : null,
    errorKeys: Object.keys(errorRecord).sort(),
  }
}

function getResponseEnvelopeDiagnostic(parsedJson: unknown) {
  if (parsedJson == null) {
    return {
      responseEnvelope: 'empty',
      errorShape: 'none',
      errorCode: null,
      errorKeys: [] as string[],
    }
  }
  if (typeof parsedJson !== 'object') {
    return {
      responseEnvelope: 'malformed',
      errorShape: typeof parsedJson,
      errorCode: null,
      errorKeys: [] as string[],
    }
  }

  const record = parsedJson as Record<string, unknown>
  if ('error' in record) {
    return {
      responseEnvelope: 'error',
      ...getErrorEnvelopeDiagnostic(record.error),
    }
  }
  if ('data' in record) {
    return {
      responseEnvelope: 'data',
      errorShape: 'none',
      errorCode: null,
      errorKeys: [] as string[],
    }
  }

  return {
    responseEnvelope: 'malformed',
    errorShape: 'none',
    errorCode: null,
    errorKeys: Object.keys(record).sort(),
  }
}

export function buildEstimateV2EditorApiFailureDiagnostic(
  params: EstimateV2EditorFailureDiagnosticParams
) {
  const envelope = getResponseEnvelopeDiagnostic(params.parsed.json)
  return {
    estimateId: params.estimateId ?? null,
    operation: params.operation,
    endpoint: params.endpoint,
    method: params.method,
    trigger: params.trigger ?? null,
    status: params.response.status,
    statusText: params.response.statusText || null,
    message: params.message,
    ...envelope,
  }
}

export function formatEstimateV2EditorApiFailureLog(
  diagnostic: ReturnType<typeof buildEstimateV2EditorApiFailureDiagnostic>
) {
  const trigger = diagnostic.trigger ? ` trigger=${diagnostic.trigger}` : ''
  const code = diagnostic.errorCode ? ` code=${diagnostic.errorCode}` : ''
  return `${diagnostic.operation} ${diagnostic.method} ${diagnostic.endpoint} failed status=${diagnostic.status}${trigger}${code}: ${diagnostic.message}`
}
