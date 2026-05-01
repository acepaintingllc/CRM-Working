'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DetailsScopeLineVm } from '../_lib/estimateV2DetailsVm'

function materialOverrideInputKey(row: DetailsScopeLineVm) {
  return row.overrideKey || row.id
}

export function useEstimateV2DetailsMaterialTableInputState({
  rows,
  onOverride,
}: {
  rows: DetailsScopeLineVm[]
  onOverride: (row: DetailsScopeLineVm, value: string) => void
}) {
  const [focusedOverrideKey, setFocusedOverrideKeyState] = useState<string | null>(null)
  const focusedOverrideKeyRef = useRef<string | null>(null)
  const [draftOverrideValues, setDraftOverrideValues] = useState<Record<string, string>>({})

  const setFocusedOverrideKey = useCallback((value: string | null) => {
    focusedOverrideKeyRef.current = value
    setFocusedOverrideKeyState(value)
  }, [])

  useEffect(() => {
    const rowKeys = new Set(rows.map(materialOverrideInputKey))
    setDraftOverrideValues((prev) => {
      let changed = false
      const next: Record<string, string> = {}
      for (const [key, value] of Object.entries(prev)) {
        if (!rowKeys.has(key)) {
          changed = true
          continue
        }
        next[key] = value
      }
      return changed ? next : prev
    })
    if (focusedOverrideKeyRef.current && !rowKeys.has(focusedOverrideKeyRef.current)) {
      setFocusedOverrideKey(null)
    }
  }, [rows, setFocusedOverrideKey])

  const overrideDisplayValue = useCallback(
    (row: DetailsScopeLineVm) => {
      const overrideInputKey = materialOverrideInputKey(row)
      return focusedOverrideKey === overrideInputKey
        ? (draftOverrideValues[overrideInputKey] ?? row.overrideGallons)
        : row.overrideGallons
    },
    [draftOverrideValues, focusedOverrideKey]
  )

  const onFocusOverride = useCallback(
    (row: DetailsScopeLineVm) => {
      const overrideInputKey = materialOverrideInputKey(row)
      setFocusedOverrideKey(overrideInputKey)
      setDraftOverrideValues((prev) => ({
        ...prev,
        [overrideInputKey]: row.overrideGallons,
      }))
    },
    [setFocusedOverrideKey]
  )

  const onBlurOverride = useCallback(
    (row: DetailsScopeLineVm) => {
      const overrideInputKey = materialOverrideInputKey(row)
      if (focusedOverrideKeyRef.current === overrideInputKey) {
        setFocusedOverrideKey(null)
      }
      setDraftOverrideValues((prev) => {
        if (!(overrideInputKey in prev)) return prev
        const next = { ...prev }
        delete next[overrideInputKey]
        return next
      })
    },
    [setFocusedOverrideKey]
  )

  const onChangeOverride = useCallback(
    (row: DetailsScopeLineVm, value: string) => {
      const overrideInputKey = materialOverrideInputKey(row)
      setDraftOverrideValues((prev) => ({
        ...prev,
        [overrideInputKey]: value,
      }))
      onOverride(row, value)
    },
    [onOverride]
  )

  return {
    overrideDisplayValue,
    onFocusOverride,
    onBlurOverride,
    onChangeOverride,
  }
}
