'use client'

import { useCallback, useEffect, useRef } from 'react'

export function useEstimateV2BeforeUnload(params: { loading: boolean; shouldGuard: boolean }) {
  const { loading, shouldGuard } = params
  const stateRef = useRef({ loading, shouldGuard })

  useEffect(() => {
    stateRef.current = { loading, shouldGuard }
  }, [loading, shouldGuard])

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (stateRef.current.loading || !stateRef.current.shouldGuard) return
    event.preventDefault()
    event.returnValue = ''
  }, [])

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [handleBeforeUnload])
}
