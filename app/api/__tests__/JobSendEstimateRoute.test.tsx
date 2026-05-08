import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockNormalizeSendJobStageEmailInput,
  mockSendJobStageEmail,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockNormalizeSendJobStageEmailInput: vi.fn(),
  mockSendJobStageEmail: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  resolveParams: mockResolveParams,
  readUuidParam: mockReadUuidParam,
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
  readJsonBody: async (request: Request, options?: { allowEmpty?: boolean }) => {
    const contentType = request.headers.get('content-type') ?? ''
    const raw = await request.text()
    if (options?.allowEmpty && !raw.trim()) {
      return { ok: true as const, value: null }
    }
    if (!contentType.includes('application/json')) {
      return {
        ok: false as const,
        response: new Response(JSON.stringify({ error: 'Expected application/json body.' }), {
          status: 415,
        }),
      }
    }
    try {
      return { ok: true as const, value: JSON.parse(raw) as Record<string, unknown> }
    } catch {
      return {
        ok: false as const,
        response: new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 }),
      }
    }
  },
}))

vi.mock('@/lib/server/jobStageEmailWorkflow', () => ({
  normalizeSendJobStageEmailInput: mockNormalizeSendJobStageEmailInput,
  sendJobStageEmail: mockSendJobStageEmail,
}))

import { POST as postSendEstimate } from '../jobs/[id]/send-estimate/route'
import { POST as postSendStage } from '../jobs/[id]/send-stage/route'

function jsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('job send-estimate compatibility route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1' })
    mockReadUuidParam.mockReturnValue({ ok: true, value: 'job-1' })
    mockNormalizeSendJobStageEmailInput.mockImplementation((body: Record<string, unknown>) => {
      const stage = typeof body.stage === 'string' ? body.stage : ''
      if (stage !== 'estimate_sent') {
        return { ok: false, kind: 'invalid_input', message: 'Invalid stage' }
      }
      const idempotencyKey =
        typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : ''
      if (!idempotencyKey) {
        return { ok: false, kind: 'invalid_input', message: 'Missing idempotency_key' }
      }
      return {
        ok: true,
        data: {
          stage,
          subject: typeof body.subject === 'string' ? body.subject : undefined,
          body: typeof body.body === 'string' ? body.body : undefined,
          idempotencyKey,
          estimateFileIds: Array.from(
            new Set(
              (Array.isArray(body.estimate_file_ids) ? body.estimate_file_ids : [])
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.trim())
                .filter(Boolean)
            )
          ),
        },
      }
    })
    mockSendJobStageEmail.mockResolvedValue({
      ok: true,
      data: {
        status: 'sent',
        replayed: false,
        notice: 'Quote email sent.',
        job: { id: 'job-1', status: 'estimate_sent' },
        estimateFile: { id: 'file-1', name: 'Quote.pdf' },
        estimateFiles: [{ id: 'file-1', name: 'Quote.pdf' }],
      },
    })
  })

  it('authenticates before parsing route params', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 }),
    })

    const response = await postSendEstimate(
      jsonRequest('http://localhost/api/jobs/job-1/send-estimate', {}),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockSendJobStageEmail).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
  })

  it('delegates legacy quote-send input to the same canonical workflow as send-stage', async () => {
    const legacyResponse = await postSendEstimate(
      jsonRequest('http://localhost/api/jobs/job-1/send-estimate', {
        subject: 'Quote',
        body: 'Body',
        estimate_file_id: 'file-1',
        idempotency_key: 'key-1',
      }),
      { params: { id: 'job-1' } }
    )

    const canonicalResponse = await postSendStage(
      jsonRequest('http://localhost/api/jobs/job-1/send-stage', {
        stage: 'estimate_sent',
        subject: 'Quote',
        body: 'Body',
        estimate_file_ids: ['file-1'],
        idempotency_key: 'key-1',
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockSendJobStageEmail).toHaveBeenNthCalledWith(1, {
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      input: {
        stage: 'estimate_sent',
        subject: 'Quote',
        body: 'Body',
        idempotencyKey: 'key-1',
        estimateFileIds: ['file-1'],
      },
    })
    expect(mockSendJobStageEmail.mock.calls[0][0]).toEqual(mockSendJobStageEmail.mock.calls[1][0])
    expect(legacyResponse.status).toBe(canonicalResponse.status)
    await expect(legacyResponse.json()).resolves.toEqual(await canonicalResponse.json())
  })

  it('generates a canonical idempotency key for empty legacy requests', async () => {
    const response = await postSendEstimate(
      new Request('http://localhost/api/jobs/job-1/send-estimate', { method: 'POST' }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(200)
    expect(mockSendJobStageEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          stage: 'estimate_sent',
          idempotencyKey: expect.stringMatching(/^legacy-send-estimate:job:job-1:/),
          estimateFileIds: [],
        }),
      })
    )
  })

  it('keeps multipart uploads out of the compatibility path', async () => {
    const response = await postSendEstimate(
      new Request('http://localhost/api/jobs/job-1/send-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=x' },
        body: 'not-json',
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(415)
    expect(mockSendJobStageEmail).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Expected application/json body.' })
  })
})
