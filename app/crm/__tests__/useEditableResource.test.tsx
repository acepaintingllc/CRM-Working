import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEditableResource } from '../_hooks/useEditableResource'

describe('useEditableResource', () => {
  it('loads initial data and tracks dirty state until save', async () => {
    const save = vi.fn(async (data: { name: string }) => ({ data, notice: 'Saved.' }))
    const { result } = renderHook(() =>
      useEditableResource({
        initialData: { name: '' },
        load: async () => ({ name: 'ACE' }),
        save,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ name: 'ACE' })
    expect(result.current.dirty).toBe(false)

    act(() => {
      result.current.setData({ name: 'Updated' })
    })

    expect(result.current.dirty).toBe(true)

    await act(async () => {
      await result.current.saveChanges()
    })

    expect(save).toHaveBeenCalledWith({ name: 'Updated' })
    expect(result.current.dirty).toBe(false)
    expect(result.current.notice).toBe('Saved.')
  })

  it('surfaces save failures without discarding local edits', async () => {
    const { result } = renderHook(() =>
      useEditableResource({
        initialData: { value: 'seed' },
        load: async () => ({ value: 'seed' }),
        save: async () => {
          throw new Error('Unable to save.')
        },
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setData({ value: 'draft' })
    })

    await act(async () => {
      await result.current.saveChanges()
    })

    expect(result.current.data).toEqual({ value: 'draft' })
    expect(result.current.error).toBe('Unable to save.')
    expect(result.current.dirty).toBe(true)
  })
})
