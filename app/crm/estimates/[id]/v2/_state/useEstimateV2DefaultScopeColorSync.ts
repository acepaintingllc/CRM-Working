'use client'

import { useEffect } from 'react'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'

export function useEstimateV2DefaultScopeColorSync(params: {
  store: EstimateV2EditorStoreApi
  defaultColorCodeId: string
}) {
  const { store, defaultColorCodeId } = params

  useEffect(() => {
    if (!defaultColorCodeId) return
    store.getState().setScopes((prev) => {
      let changed = false
      const next = prev.map((scope) => {
        if (scope.colorId) return scope
        changed = true
        return { ...scope, colorId: defaultColorCodeId }
      })
      return changed ? next : prev
    })
  }, [defaultColorCodeId, store])
}
