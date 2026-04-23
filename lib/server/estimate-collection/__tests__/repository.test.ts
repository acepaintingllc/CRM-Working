import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  hasUniqueConstraintConflict: vi.fn(),
}))

import { createEstimateCollectionVersionRecord } from '../repository.ts'

describe('estimate collection repository', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.hasUniqueConstraintConflict.mockReset()
    mocks.hasUniqueConstraintConflict.mockReturnValue(false)
  })

  it('validates create-version input before hitting the rpc', async () => {
    await expect(
      createEstimateCollectionVersionRecord({
        orgId: 'org-1',
        userId: 'user-1',
        body: { job_id: 'bad-id' },
        copy: {
          createdNotice: 'Estimate version created.',
          defaultVersionLabel: 'Estimate Version',
        },
      })
    ).resolves.toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid job_id',
    })

    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('maps create-version input into the transactional rpc contract', async () => {
    const _deps = { rpc: mocks.rpc, hasUniqueConstraintConflict: mocks.hasUniqueConstraintConflict }
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        id: 'estimate-new',
        estimate: {
          id: 'estimate-new',
          job_id: '11111111-1111-4111-8111-111111111111',
          customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          status: 'draft',
          version_name: 'Kitchen Revision 2',
          version_state: 'draft',
          version_kind: 'revision',
          version_sort_order: 2,
          created_at: '2026-04-23T16:00:00.000Z',
          updated_at: '2026-04-23T16:00:00.000Z',
        },
      },
      error: null,
    })

    const result = await createEstimateCollectionVersionRecord({
      orgId: 'org-1',
      userId: 'user-1',
      body: {
        job_id: '11111111-1111-4111-8111-111111111111',
        customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        version_kind: 'revision',
        version_name: 'Kitchen Revision 2',
      },
      copy: {
        createdNotice: 'Estimate version created.',
        defaultVersionLabel: 'Estimate Version',
      },
      _deps,
    })

    expect(mocks.rpc).toHaveBeenCalledWith('create_estimate_version', {
      p_org_id: 'org-1',
      p_user_id: 'user-1',
      p_job_id: '11111111-1111-4111-8111-111111111111',
      p_customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_version_state: 'draft',
      p_version_kind: 'revision',
      p_version_name: 'Kitchen Revision 2',
      p_default_version_label: 'Estimate Version',
    })
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'estimate-new',
        estimate: expect.objectContaining({
          id: 'estimate-new',
          version_sort_order: 2,
        }),
      },
    })
  })

  it('maps rpc error kinds and unique-constraint failures to service results', async () => {
    const _deps = { rpc: mocks.rpc, hasUniqueConstraintConflict: mocks.hasUniqueConstraintConflict }
    mocks.rpc.mockResolvedValueOnce({
      error: { message: 'duplicate key value violates unique constraint' },
      data: null,
    })
    mocks.hasUniqueConstraintConflict.mockReturnValueOnce(true)

    await expect(
      createEstimateCollectionVersionRecord({
        orgId: 'org-1',
        userId: 'user-1',
        body: { job_id: '11111111-1111-4111-8111-111111111111' },
        copy: {
          createdNotice: 'Estimate version created.',
          defaultVersionLabel: 'Estimate Version',
        },
        _deps,
      })
    ).resolves.toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Another version was created at the same time. Please retry.',
    })

    mocks.rpc.mockResolvedValueOnce({
      data: {
        ok: false,
        error_kind: 'not_found',
        error_message: 'Job not found',
      },
      error: null,
    })

    await expect(
      createEstimateCollectionVersionRecord({
        orgId: 'org-1',
        userId: 'user-1',
        body: { job_id: '11111111-1111-4111-8111-111111111111' },
        copy: {
          createdNotice: 'Estimate version created.',
          defaultVersionLabel: 'Estimate Version',
        },
        _deps,
      })
    ).resolves.toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Job not found',
    })
  })
})
