import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEditableResource } from '../_hooks/useEditableResource'

type NullableNameAmount = {
  name: string | null
  amount: string
}

describe('useEditableResource', () => {
  it('uses the default comparator for unchanged and changed values', async () => {
    const { result } = renderHook(() =>
      useEditableResource({
        initialData: { name: '' },
        load: async () => ({ name: 'ACE' }),
        save: async (data) => ({ data }),
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ name: 'ACE' })
    expect(result.current.dirty).toBe(false)

    act(() => {
      result.current.setData({ name: 'Updated' })
    })

    expect(result.current.dirty).toBe(true)
  })

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

  it('clears notices after local edits', async () => {
    const { result } = renderHook(() =>
      useEditableResource({
        initialData: { name: '' },
        load: async () => ({ name: 'ACE' }),
        save: async (data) => ({ data, notice: 'Saved.' }),
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setData({ name: 'Updated' })
    })

    await act(async () => {
      await result.current.saveChanges()
    })

    expect(result.current.notice).toBe('Saved.')

    act(() => {
      result.current.setData({ name: 'Updated again' })
    })

    expect(result.current.notice).toBeNull()
  })

  it('uses a custom comparator for normalized-equal values', async () => {
    const isDirty = vi.fn(
      (current: NullableNameAmount, snapshot: NullableNameAmount) => {
        const normalize = (value: NullableNameAmount) => ({
          name: (value.name ?? '').trim(),
          amount: value.amount.trim(),
        })

        return JSON.stringify(normalize(current)) !== JSON.stringify(normalize(snapshot))
      }
    )

    const { result } = renderHook(() =>
      useEditableResource<NullableNameAmount>({
        initialData: { name: null, amount: '' },
        load: async () => ({ name: null, amount: '' }),
        save: async (data) => ({ data }),
        isDirty,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setData({ name: '', amount: '  ' })
    })

    expect(result.current.dirty).toBe(false)
    expect(isDirty).toHaveBeenCalled()
  })

  it('supports custom comparison for nested objects and arrays', async () => {
    const { result } = renderHook(() =>
      useEditableResource({
        initialData: { tags: [], meta: { enabled: false } },
        load: async () => ({ tags: ['a'], meta: { enabled: true } }),
        save: async (data) => ({ data }),
        isDirty: (current, snapshot) =>
          current.tags.join('|') !== snapshot.tags.join('|') ||
          current.meta.enabled !== snapshot.meta.enabled,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.dirty).toBe(false)

    act(() => {
      result.current.setData({ tags: ['a', 'b'], meta: { enabled: true } })
    })

    expect(result.current.dirty).toBe(true)
  })

  it('resets snapshot and dirty state after reload with a custom comparator', async () => {
    let nextLoad = { name: 'ACE', amount: '10' }
    const { result } = renderHook(() =>
      useEditableResource({
        initialData: { name: '', amount: '' },
        load: async () => nextLoad,
        save: async (data) => ({ data }),
        isDirty: (current, snapshot) => current.name.trim() !== snapshot.name.trim(),
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setData({ name: 'Updated', amount: '99' })
    })

    expect(result.current.dirty).toBe(true)

    nextLoad = { name: 'Reloaded', amount: '25' }

    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.data).toEqual({ name: 'Reloaded', amount: '25' })
    expect(result.current.dirty).toBe(false)
  })

  it('resets snapshot after save with a custom comparator', async () => {
    const { result } = renderHook(() =>
      useEditableResource({
        initialData: { amount: '' },
        load: async () => ({ amount: '' }),
        save: async () => ({ data: { amount: '10' }, notice: 'Saved normalized.' }),
        isDirty: (current, snapshot) => current.amount.trim() !== snapshot.amount.trim(),
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setData({ amount: ' 10 ' })
    })

    expect(result.current.dirty).toBe(true)

    await act(async () => {
      await result.current.saveChanges()
    })

    expect(result.current.data).toEqual({ amount: '10' })
    expect(result.current.dirty).toBe(false)
    expect(result.current.notice).toBe('Saved normalized.')
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

  it('keeps local edits dirty after save failures with a custom comparator', async () => {
    const { result } = renderHook(() =>
      useEditableResource({
        initialData: { amount: '' },
        load: async () => ({ amount: '' }),
        save: async () => {
          throw new Error('Unable to save.')
        },
        isDirty: (current, snapshot) => current.amount.trim() !== snapshot.amount.trim(),
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setData({ amount: ' 10 ' })
    })

    await act(async () => {
      await result.current.saveChanges()
    })

    expect(result.current.data).toEqual({ amount: ' 10 ' })
    expect(result.current.error).toBe('Unable to save.')
    expect(result.current.dirty).toBe(true)
  })
})
