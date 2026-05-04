import { describe, expect, it } from 'vitest'
import {
  buildEstimateV2EditorApiFailureDiagnostic,
  formatEstimateV2EditorApiFailureLog,
} from '../estimateV2EditorDiagnostics'

describe('estimateV2EditorDiagnostics', () => {
  it('builds sanitized diagnostics from object error envelopes', () => {
    const diagnostic = buildEstimateV2EditorApiFailureDiagnostic({
      estimateId: 'estimate-1',
      endpoint: '/api/estimates/estimate-1',
      method: 'PUT',
      operation: 'save',
      trigger: 'manual',
      response: {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      },
      parsed: {
        json: {
          error: {
            code: 'INVALID_ESTIMATE_DRAFT',
            message: 'Validation failed.',
            privateDetail: 'do not log this value',
          },
        },
        text: JSON.stringify({
          error: {
            code: 'INVALID_ESTIMATE_DRAFT',
            message: 'Validation failed.',
            privateDetail: 'do not log this value',
          },
        }),
      },
      message: 'Validation failed.',
    })

    expect(diagnostic).toMatchObject({
      estimateId: 'estimate-1',
      endpoint: '/api/estimates/estimate-1',
      method: 'PUT',
      operation: 'save',
      trigger: 'manual',
      status: 400,
      statusText: 'Bad Request',
      message: 'Validation failed.',
      responseEnvelope: 'error',
      errorShape: 'object',
      errorCode: 'INVALID_ESTIMATE_DRAFT',
      errorKeys: ['code', 'message', 'privateDetail'],
    })
    expect(JSON.stringify(diagnostic)).not.toContain('do not log this value')
    expect(formatEstimateV2EditorApiFailureLog(diagnostic)).toBe(
      'save PUT /api/estimates/estimate-1 failed status=400 trigger=manual code=INVALID_ESTIMATE_DRAFT: Validation failed.'
    )
  })
})
