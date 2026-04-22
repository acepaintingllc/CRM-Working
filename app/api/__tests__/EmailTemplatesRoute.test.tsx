import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockListEmailTemplates,
  mockNormalizeSaveEmailTemplateInput,
  mockSaveEmailTemplate,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockListEmailTemplates: vi.fn(),
  mockNormalizeSaveEmailTemplateInput: vi.fn(),
  mockSaveEmailTemplate: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => {
  return {
    requireSessionUserOrg: mockRequireSessionUserOrg,
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
  }
})

vi.mock('@/lib/emailTemplates/service', () => ({
  listEmailTemplates: mockListEmailTemplates,
  normalizeSaveEmailTemplateInput: mockNormalizeSaveEmailTemplateInput,
  saveEmailTemplate: mockSaveEmailTemplate,
}))

import { GET, PUT } from '../email-templates/route'

describe('email templates route', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockListEmailTemplates.mockReset()
    mockNormalizeSaveEmailTemplateInput.mockReset()
    mockSaveEmailTemplate.mockReset()
    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
  })

  it('returns the standard data envelope for GET', async () => {
    mockListEmailTemplates.mockResolvedValue({
      ok: true,
      data: [{ stage: 'estimate_sent', subject: 'Hi', body: 'Body' }],
    })

    const response = await GET()

    await expect(response.json()).resolves.toEqual({
      data: [{ stage: 'estimate_sent', subject: 'Hi', body: 'Body' }],
    })
  })

  it('returns the standard mutation envelope for PUT', async () => {
    mockNormalizeSaveEmailTemplateInput.mockReturnValue({
      ok: true,
      data: { stage: 'estimate_sent', subject: 'Hi', body: 'Body' },
    })
    mockSaveEmailTemplate.mockResolvedValue({
      ok: true,
      data: { stage: 'estimate_sent', subject: 'Hi', body: 'Body' },
    })

    const response = await PUT(
      new Request('http://localhost/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'estimate_sent', subject: 'Hi', body: 'Body' }),
      })
    )

    await expect(response.json()).resolves.toEqual({
      data: { stage: 'estimate_sent', subject: 'Hi', body: 'Body' },
      notice: 'Email template saved.',
    })
  })

  it('maps auth failures through the shared session guard', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 }),
    })

    const response = await GET()
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
  })
})
