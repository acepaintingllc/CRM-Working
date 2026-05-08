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
  readJsonBody: async (request: Request) => {
    try {
      return { ok: true as const, value: (await request.json()) as Record<string, unknown> }
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

import { POST } from '../jobs/[id]/send-stage/route'

function postRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/jobs/job-1/send-stage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('job send-stage route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1' })
    mockReadUuidParam.mockReturnValue({ ok: true, value: 'job-1' })
    mockNormalizeSendJobStageEmailInput.mockImplementation((body: Record<string, unknown>) => {
      if (body.stage !== 'scheduled') {
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
          stage: body.stage,
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
  })

  it('authenticates before parsing route params', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 }),
    })

    const response = await POST(postRequest({ stage: 'scheduled', idempotency_key: 'key-1' }), {
      params: { id: 'job-1' },
    })

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockSendJobStageEmail).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
  })

  it('rejects an invalid stage before calling the workflow', async () => {
    const response = await POST(postRequest({ stage: 'bad', idempotency_key: 'key-1' }), {
      params: { id: 'job-1' },
    })

    expect(response.status).toBe(400)
    expect(mockSendJobStageEmail).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Invalid stage' })
  })

  it('rejects a missing idempotency key before calling the workflow', async () => {
    const response = await POST(postRequest({ stage: 'scheduled' }), {
      params: { id: 'job-1' },
    })

    expect(response.status).toBe(400)
    expect(mockSendJobStageEmail).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Missing idempotency_key' })
  })

  it('maps blocked prerequisites to a standard error envelope', async () => {
    mockSendJobStageEmail.mockResolvedValue({
      ok: false,
      kind: 'invalid_input',
      message: 'Add at least one scheduled block before sending the scheduled email.',
      status: 400,
    })

    const response = await POST(postRequest({ stage: 'scheduled', idempotency_key: 'key-1' }), {
      params: { id: 'job-1' },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Add at least one scheduled block before sending the scheduled email.',
    })
  })

  it('returns replay envelopes with the workflow status code', async () => {
    mockSendJobStageEmail.mockResolvedValue({
      ok: true,
      status: 202,
      data: {
        status: 'replayed',
        replayed: true,
        result_status: 'pending',
        notice: 'This email request is already in progress. No duplicate email was sent.',
        job: null,
        estimateFile: null,
        estimateFiles: [],
      },
    })

    const response = await POST(postRequest({ stage: 'scheduled', idempotency_key: 'key-1' }), {
      params: { id: 'job-1' },
    })

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      data: {
        status: 'replayed',
        replayed: true,
        result_status: 'pending',
        job: null,
        estimateFile: null,
        estimateFiles: [],
      },
      notice: 'This email request is already in progress. No duplicate email was sent.',
    })
  })

  it('passes normalized input to the workflow and returns the success envelope', async () => {
    mockSendJobStageEmail.mockResolvedValue({
      ok: true,
      data: {
        status: 'sent',
        replayed: false,
        notice: 'Scheduled email sent.',
        job: { id: 'job-1', status: 'scheduled' },
        estimateFile: null,
        estimateFiles: [],
      },
    })

    const response = await POST(
      postRequest({
        stage: 'scheduled',
        subject: 'Subject',
        body: 'Body',
        idempotency_key: 'key-1',
        estimate_file_ids: [' file-1 ', 'file-1', ''],
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockSendJobStageEmail).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      input: {
        stage: 'scheduled',
        subject: 'Subject',
        body: 'Body',
        idempotencyKey: 'key-1',
        estimateFileIds: ['file-1'],
      },
    })
    await expect(response.json()).resolves.toEqual({
      data: {
        status: 'sent',
        replayed: false,
        job: { id: 'job-1', status: 'scheduled' },
        estimateFile: null,
        estimateFiles: [],
      },
      notice: 'Scheduled email sent.',
    })
  })
})
